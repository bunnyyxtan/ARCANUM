import { constants as cryptoConstants, generateKeyPairSync, privateDecrypt } from "node:crypto";

import {
  type Hex,
  type TransactionSerializable,
  type TransactionSerializableEIP1559,
  type TransactionSerialized,
  createWalletClient,
  custom,
  encodeFunctionData,
  keccak256,
  numberToHex,
  parseTransaction,
  parseUnits,
  recoverTransactionAddress,
  stringToHex,
  verifyMessage,
  verifyTypedData,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { GuardedWalletAbi } from "@arcanum/contracts";

import { arcTestnet } from "./chains";
import { CircleSignerError, circleWalletAccount } from "./circle";

const API_KEY = "TEST_API_KEY:0123456789abcdef:fedcba9876543210";
const ENTITY_SECRET = "7f".repeat(32);
const WALLET_ID = "c4d1da72-111e-4d52-bdbf-2e74a2d803d5";
const GUARDED_WALLET = "0x9f044588539DC7FD7C2e666dE55557abC3539b32";
const VENDOR = "0x97c5000000000000000000000000000000000e75";

interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

interface FakeCircleOptions {
  /** Key Circle "holds"; defaults to the wallet's key. Use another key to fake a rogue signer. */
  signWith?: Hex;
  /** Rewrite the parsed transaction before it is signed, to fake a signer that changes fields. */
  rewriteTransaction?: (tx: TransactionSerializableEIP1559) => TransactionSerializableEIP1559;
  /** Return this body (and status) for every signing call instead of signing. */
  respond?: { status: number; body: unknown };
  /** Fail the public key fetch this many times before serving it. */
  publicKeyFailures?: number;
}

/**
 * A stand-in for Circle's API: checks the bearer token, decrypts the entity
 * secret ciphertext the way Circle would, refuses a reused ciphertext, and
 * signs with a real key so the adapter's recovery checks are exercised.
 */
function fakeCircle(walletKey: Hex, options: FakeCircleOptions = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const hsm = privateKeyToAccount(options.signWith ?? walletKey);
  const requests: RecordedRequest[] = [];
  const ciphertexts = new Set<string>();
  let publicKeyFailures = options.publicKeyFailures ?? 0;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [
        k.toLowerCase(),
        v,
      ]),
    );
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    requests.push({ method: init?.method ?? "GET", path: url.pathname, headers, body });

    if (headers.authorization !== `Bearer ${API_KEY}`) {
      return json(401, { code: 401, message: "Malformed authorization." });
    }
    if (url.pathname === "/v1/w3s/config/entity/publicKey") {
      if (publicKeyFailures > 0) {
        publicKeyFailures -= 1;
        return json(500, { code: 500, message: "Try again." });
      }
      return json(200, { data: { publicKey: publicKeyPem } });
    }

    const ciphertext = body?.entitySecretCiphertext;
    if (typeof ciphertext !== "string" || ciphertexts.has(ciphertext)) {
      return json(400, { code: 156004, message: "Reused entity secret ciphertext." });
    }
    ciphertexts.add(ciphertext);
    const secret = privateDecrypt(
      { key: privateKey, padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      Buffer.from(ciphertext, "base64"),
    ).toString("hex");
    if (secret !== ENTITY_SECRET) {
      return json(400, { code: 156003, message: "Invalid entity secret." });
    }
    if (options.respond) {
      return json(options.respond.status, options.respond.body);
    }

    switch (url.pathname) {
      case "/v1/w3s/developer/sign/message": {
        const message = String(body?.message);
        const signature = await hsm.signMessage({
          message: body?.encodedByHex ? { raw: message as Hex } : message,
        });
        return json(200, { data: { signature } });
      }
      case "/v1/w3s/developer/sign/transaction": {
        const raw = JSON.parse(String(body?.transaction)) as Record<
          string,
          string | number | undefined
        >;
        const tx: TransactionSerializableEIP1559 = {
          type: "eip1559",
          chainId: Number(raw.chainId),
          nonce: Number(raw.nonce),
          to: raw.to as Hex,
          value: BigInt(String(raw.value ?? 0)),
          gas: BigInt(String(raw.gas)),
          maxFeePerGas: BigInt(String(raw.maxFeePerGas)),
          maxPriorityFeePerGas: BigInt(String(raw.maxPriorityFeePerGas)),
          data: (raw.data as Hex | undefined) ?? "0x",
        };
        const signedTransaction = await hsm.signTransaction(
          options.rewriteTransaction ? options.rewriteTransaction(tx) : tx,
        );
        return json(200, {
          data: { signature: "0x", signedTransaction, txHash: keccak256(signedTransaction) },
        });
      }
      case "/v1/w3s/developer/sign/typedData": {
        const typedData = JSON.parse(String(body?.data));
        const signature = await hsm.signTypedData(typedData);
        return json(200, { data: { signature } });
      }
      default:
        return json(404, { code: 404, message: "Not found." });
    }
  };

  return { fetch: fetchImpl, requests, ciphertexts };
}

function setup(options: FakeCircleOptions = {}) {
  const walletKey = generatePrivateKey();
  const wallet = privateKeyToAccount(walletKey);
  const circle = fakeCircle(walletKey, options);
  const account = circleWalletAccount({
    apiKey: API_KEY,
    entitySecret: ENTITY_SECRET,
    walletId: WALLET_ID,
    address: wallet.address,
    fetch: circle.fetch,
  });
  return { account, wallet, circle };
}

const preparedTransaction = {
  chainId: arcTestnet.id,
  nonce: 7,
  to: GUARDED_WALLET,
  value: 0n,
  data: encodeFunctionData({
    abi: GuardedWalletAbi,
    functionName: "executeUSDC",
    args: [VENDOR, parseUnits("5", 6), stringToHex("demo")],
  }),
  gas: 120_000n,
  maxFeePerGas: 2_000_000_000n,
  maxPriorityFeePerGas: 1_500_000_000n,
} satisfies TransactionSerializableEIP1559;

async function expectCircleError(promise: Promise<unknown>, code: CircleSignerError["code"]) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(CircleSignerError);
  expect((error as CircleSignerError).code).toBe(code);
  return error as CircleSignerError;
}

describe("circleWalletAccount", () => {
  it("is a viem local account at the Circle wallet's address", () => {
    const { account, wallet } = setup();

    expect(account.address).toBe(wallet.address);
    expect(account.type).toBe("local");
    expect(account.source).toBe("custom");
  });

  it("signs a text message through Circle as EIP-191 and returns a verifiable signature", async () => {
    const { account, wallet, circle } = setup();
    const message = "Arcanum payment intent\nreference: invoice-1";

    const signature = await account.signMessage({ message });

    expect(await verifyMessage({ address: wallet.address, message, signature })).toBe(true);
    const request = circle.requests.find((r) => r.path === "/v1/w3s/developer/sign/message");
    expect(request?.body).toMatchObject({
      walletId: WALLET_ID,
      message,
      encodedByHex: false,
      memo: "Arcanum agent signer",
    });
  });

  it("sends raw bytes as hex with encodedByHex", async () => {
    const { account, wallet, circle } = setup();
    const raw = new Uint8Array([1, 2, 3, 255]);

    const signature = await account.signMessage({ message: { raw } });

    expect(await verifyMessage({ address: wallet.address, message: { raw }, signature })).toBe(
      true,
    );
    const request = circle.requests.find((r) => r.path === "/v1/w3s/developer/sign/message");
    expect(request?.body).toMatchObject({ message: "0x010203ff", encodedByHex: true });
  });

  it("encrypts the entity secret freshly for every call and fetches the public key once", async () => {
    const { account, circle } = setup();

    await account.signMessage({ message: "one" });
    await account.signMessage({ message: "two" });
    await account.signMessage({ message: "three" });

    const keyFetches = circle.requests.filter((r) => r.path === "/v1/w3s/config/entity/publicKey");
    expect(keyFetches).toHaveLength(1);
    expect(keyFetches[0]?.headers.authorization).toBe(`Bearer ${API_KEY}`);
    expect(keyFetches[0]?.body).toBeNull();
    expect(circle.ciphertexts.size).toBe(3);
  });

  it("does not cache a failed public key fetch", async () => {
    const { account, circle } = setup({ publicKeyFailures: 1 });

    const error = await expectCircleError(
      account.signMessage({ message: "one" }),
      "CIRCLE_API_ERROR",
    );
    expect(error.status).toBe(500);
    await expect(account.signMessage({ message: "two" })).resolves.toMatch(/^0x/);

    const keyFetches = circle.requests.filter((r) => r.path === "/v1/w3s/config/entity/publicKey");
    expect(keyFetches).toHaveLength(2);
  });

  it("refuses a message signature that does not recover to the wallet", async () => {
    const { account } = setup({ signWith: generatePrivateKey() });

    await expectCircleError(account.signMessage({ message: "hello" }), "SIGNATURE_MISMATCH");
  });

  it("signs an executeUSDC transaction through Circle's transaction JSON", async () => {
    const { account, wallet, circle } = setup();

    const signed = await account.signTransaction(preparedTransaction);

    expect(
      await recoverTransactionAddress({ serializedTransaction: signed as TransactionSerialized }),
    ).toBe(wallet.address);
    const parsed = parseTransaction(signed);
    expect(parsed.to?.toLowerCase()).toBe(GUARDED_WALLET.toLowerCase());
    expect(parsed.data).toBe(preparedTransaction.data);
    expect(parsed.nonce).toBe(7);

    const request = circle.requests.find((r) => r.path === "/v1/w3s/developer/sign/transaction");
    expect(request?.body?.walletId).toBe(WALLET_ID);
    expect(JSON.parse(String(request?.body?.transaction))).toEqual({
      chainId: arcTestnet.id,
      nonce: 7,
      to: GUARDED_WALLET,
      value: "0",
      gas: "120000",
      maxFeePerGas: "2000000000",
      maxPriorityFeePerGas: "1500000000",
      data: preparedTransaction.data,
    });
  });

  it("leaves data out of a plain transfer and still verifies the signed bytes", async () => {
    const { account, circle } = setup();

    const signed = await account.signTransaction({
      chainId: arcTestnet.id,
      nonce: 0,
      to: VENDOR,
      value: parseUnits("0.05", 18),
      gas: 21_000n,
      maxFeePerGas: 2_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
    });

    expect(parseTransaction(signed).value).toBe(parseUnits("0.05", 18));
    const request = circle.requests.find((r) => r.path === "/v1/w3s/developer/sign/transaction");
    expect(JSON.parse(String(request?.body?.transaction))).not.toHaveProperty("data");
  });

  it("refuses a signed transaction whose fields differ from the request", async () => {
    const rewrites: Array<
      [string, (tx: TransactionSerializableEIP1559) => TransactionSerializableEIP1559]
    > = [
      ["recipient", (tx) => ({ ...tx, to: VENDOR })],
      ["value", (tx) => ({ ...tx, value: 1n })],
      ["calldata", (tx) => ({ ...tx, data: "0x" })],
      ["nonce", (tx) => ({ ...tx, nonce: (tx.nonce ?? 0) + 1 })],
      ["gas", (tx) => ({ ...tx, gas: (tx.gas ?? 0n) * 2n })],
      ["maxFeePerGas", (tx) => ({ ...tx, maxFeePerGas: (tx.maxFeePerGas ?? 0n) + 1n })],
      ["chainId", (tx) => ({ ...tx, chainId: 1 })],
      ["accessList", (tx) => ({ ...tx, accessList: [{ address: VENDOR, storageKeys: [] }] })],
    ];

    for (const [name, rewriteTransaction] of rewrites) {
      const { account } = setup({ rewriteTransaction });
      const error = await expectCircleError(
        account.signTransaction(preparedTransaction),
        "TRANSACTION_MISMATCH",
      );
      expect(error.message, name).toContain("nothing was sent");
    }
  });

  it("refuses a transaction signed by another key even when the fields match", async () => {
    const { account } = setup({ signWith: generatePrivateKey() });

    await expectCircleError(account.signTransaction(preparedTransaction), "SIGNATURE_MISMATCH");
  });

  it("refuses transactions it cannot express to Circle instead of dropping fields", async () => {
    const { account, circle } = setup();

    await expectCircleError(
      account.signTransaction({
        ...preparedTransaction,
        type: "legacy",
        gasPrice: 1n,
      } as unknown as TransactionSerializable),
      "UNSUPPORTED_TRANSACTION",
    );
    await expectCircleError(
      account.signTransaction({
        ...preparedTransaction,
        accessList: [{ address: VENDOR, storageKeys: [] }],
      }),
      "UNSUPPORTED_TRANSACTION",
    );
    await expectCircleError(
      account.signTransaction({ ...preparedTransaction, nonce: undefined }),
      "UNSUPPORTED_TRANSACTION",
    );
    await expectCircleError(
      account.signTransaction({ ...preparedTransaction, to: undefined }),
      "UNSUPPORTED_TRANSACTION",
    );
    expect(circle.requests).toHaveLength(0);
  });

  it("surfaces Circle errors without the API key or entity secret", async () => {
    const { account } = setup({
      respond: { status: 403, body: { code: 156001, message: "Wallet is not active." } },
    });

    const error = await expectCircleError(
      account.signMessage({ message: "x" }),
      "CIRCLE_API_ERROR",
    );

    expect(error.status).toBe(403);
    expect(error.circleCode).toBe(156001);
    expect(error.message).toContain("Wallet is not active.");
    expect(error.message).not.toContain(API_KEY);
    expect(error.message).not.toContain(ENTITY_SECRET);
  });

  it("redacts the API key and entity secret from Circle and transport error text", async () => {
    const echo = `denied for ${API_KEY} with secret ${ENTITY_SECRET}`;
    const { account } = setup({ respond: { status: 400, body: { code: 400, message: echo } } });
    const fromCircle = await expectCircleError(
      account.signMessage({ message: "x" }),
      "CIRCLE_API_ERROR",
    );
    expect(fromCircle.message).toContain("[api key]");
    expect(fromCircle.message).toContain("[entity secret]");
    expect(fromCircle.message).not.toContain(API_KEY);
    expect(fromCircle.message).not.toContain(ENTITY_SECRET);

    const offline = circleWalletAccount({
      apiKey: API_KEY,
      entitySecret: ENTITY_SECRET,
      walletId: WALLET_ID,
      address: privateKeyToAccount(generatePrivateKey()).address,
      fetch: async () => {
        throw new Error(`socket closed while sending Bearer ${API_KEY}`);
      },
    });
    const fromTransport = await expectCircleError(
      offline.signMessage({ message: "x" }),
      "CIRCLE_API_ERROR",
    );
    expect(fromTransport.message).toContain("socket closed");
    expect(fromTransport.message).not.toContain(API_KEY);
  });

  it("rejects a response that is not a 65-byte signature", async () => {
    const { account } = setup({ respond: { status: 200, body: { data: { signature: "nope" } } } });

    await expectCircleError(account.signMessage({ message: "x" }), "MALFORMED_RESPONSE");
  });

  it("rejects a malformed entity secret before any network call", () => {
    const { wallet, circle } = setup();

    expect(() =>
      circleWalletAccount({
        apiKey: API_KEY,
        entitySecret: "not-hex",
        walletId: WALLET_ID,
        address: wallet.address,
        fetch: circle.fetch,
      }),
    ).toThrow(CircleSignerError);
    expect(circle.requests).toHaveLength(0);
  });

  it("signs typed data with EIP712Domain spelled out and verifies it", async () => {
    const { account, wallet, circle } = setup();
    const typedData = {
      domain: { name: "Arcanum", version: "1", chainId: arcTestnet.id },
      types: {
        Mandate: [
          { name: "vendor", type: "address" },
          { name: "purpose", type: "string" },
        ],
      },
      primaryType: "Mandate",
      message: { vendor: VENDOR, purpose: "quota" },
    } as const;

    const signature = await account.signTypedData(typedData);

    expect(await verifyTypedData({ ...typedData, address: wallet.address, signature })).toBe(true);
    const request = circle.requests.find((r) => r.path === "/v1/w3s/developer/sign/typedData");
    const sent = JSON.parse(String(request?.body?.data));
    expect(sent.types.EIP712Domain).toEqual([
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
    ]);
    expect(sent.primaryType).toBe("Mandate");
  });

  it("refuses a typed data signature from another key", async () => {
    const { account } = setup({ signWith: generatePrivateKey() });

    await expectCircleError(
      account.signTypedData({
        domain: { name: "Arcanum", chainId: arcTestnet.id },
        types: { Note: [{ name: "text", type: "string" }] },
        primaryType: "Note",
        message: { text: "hi" },
      }),
      "SIGNATURE_MISMATCH",
    );
  });

  it("drives writeContract end to end: viem prepares, Circle signs, viem broadcasts the same bytes", async () => {
    const { account, wallet } = setup();
    const rpc: Array<{ method: string; params: unknown }> = [];
    let broadcast: Hex | undefined;
    const transport = custom({
      request: async ({ method, params }: { method: string; params?: unknown }) => {
        rpc.push({ method, params });
        switch (method) {
          case "eth_chainId":
            return numberToHex(arcTestnet.id);
          case "eth_getTransactionCount":
            return "0x7";
          case "eth_estimateGas":
            return numberToHex(120_000n);
          case "eth_getBlockByNumber":
            return { number: "0x1", baseFeePerGas: numberToHex(1_000_000_000n), transactions: [] };
          case "eth_maxPriorityFeePerGas":
            return numberToHex(1_500_000_000n);
          case "eth_sendRawTransaction":
            broadcast = (params as [Hex])[0];
            return keccak256(broadcast);
          default:
            throw new Error(`unexpected rpc ${method}`);
        }
      },
    });
    const client = createWalletClient({ account, chain: arcTestnet, transport });

    const hash = await client.writeContract({
      address: GUARDED_WALLET,
      abi: GuardedWalletAbi,
      functionName: "executeUSDC",
      args: [VENDOR, parseUnits("5", 6), stringToHex("demo")],
    });

    expect(broadcast).toBeDefined();
    expect(hash).toBe(keccak256(broadcast as Hex));
    const parsed = parseTransaction(broadcast as Hex);
    expect(parsed.type).toBe("eip1559");
    expect(parsed.chainId).toBe(arcTestnet.id);
    expect(parsed.nonce).toBe(7);
    expect(parsed.to?.toLowerCase()).toBe(GUARDED_WALLET.toLowerCase());
    expect(parsed.data).toBe(preparedTransaction.data);
    expect(
      await recoverTransactionAddress({
        serializedTransaction: broadcast as TransactionSerialized,
      }),
    ).toBe(wallet.address);
    expect(
      rpc.some((call) => call.method === "eth_sign" || call.method === "eth_sendTransaction"),
    ).toBe(false);
  });
});
