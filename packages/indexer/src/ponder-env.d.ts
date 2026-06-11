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
