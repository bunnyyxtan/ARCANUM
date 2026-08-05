declare module "ponder:registry" {
  export const ponder: {
    on: (
      name: string,
      handler: (input: {
        event: {
          args: Record<string, unknown>;
          transaction: { hash: `0x${string}` };
          block: { number: bigint; timestamp: bigint };
        };
      }) => Promise<void> | void,
    ) => void;
  };
}

declare module "ponder:api" {
  export const db: unknown;
}

declare module "ponder:schema" {
  const schema: Record<string, unknown>;
  export default schema;
}
