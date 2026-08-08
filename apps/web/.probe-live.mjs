import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

const BASE = process.argv[2] ?? "https://thearcanum.in";
const procs = process.argv.slice(3);
const account = privateKeyToAccount(generatePrivateKey());
console.log("probe wallet:", account.address);

const cookies = new Map();
function storeCookies(res) {
  const sc = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of sc) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    cookies.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
const cookieHeader = () => [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

const nres = await fetch(`${BASE}/api/auth/nonce`);
storeCookies(nres);
const { nonce } = await nres.json();
console.log("nonce ok:", !!nonce);

const message = createSiweMessage({
  address: account.address,
  chainId: 5042002,
  domain: new URL(BASE).host,
  nonce,
  uri: BASE,
  version: "1",
});
const signature = await account.signMessage({ message });
const vres = await fetch(`${BASE}/api/auth/verify`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookieHeader() },
  body: JSON.stringify({ message, signature }),
});
storeCookies(vres);
const vbody = await vres.json().catch(() => ({}));
console.log("verify status:", vres.status, JSON.stringify(vbody).slice(0, 200));
if (vres.status !== 200) process.exit(1);

const sres = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookieHeader() } });
console.log(
  "session:",
  sres.status,
  JSON.stringify(await sres.json().catch(() => null)).slice(0, 200),
);

for (const p of procs) {
  const [name, rawInput] = p.split("#");
  let url = `${BASE}/api/trpc/${name}`;
  if (rawInput) url += `?input=${encodeURIComponent(rawInput)}`;
  const r = await fetch(url, { headers: { cookie: cookieHeader() } });
  const text = await r.text();
  console.log(`trpc ${name}: ${r.status} ${text.slice(0, 260)}`);
}
