# Agent Framework Outreach

Subject: Drop-in governance layer for agents on Arc

Hi `[Name]`,

We built Arcanum for teams whose agents need real USDC wallets on Arc.

It is a drop-in governance layer: the agent routes transfers through a GuardedWallet contract, and the contract enforces spend caps, vendor allowlists, escalation, and anomaly defense before funds move.

I would like to ship an integration recipe for your framework so builders can add Arcanum to an Arc agent in a few minutes. The SDK is small, MIT-licensed, and talks directly to Arc RPC through viem. No hosted API is required.

If useful, I can open a draft recipe and collect feedback from your community before publishing.

Docs: `apps/docs/pages/sdk/typescript.mdx` in `https://github.com/bunnyyxtan/ARCANUM`

Ranbir
