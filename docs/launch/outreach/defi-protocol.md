# DeFi Protocol Outreach

Subject: On-chain guardrails for your Arc agents

Hi `[Name]`,

If your keeper or liquidator agents are signing USDC transfers on Arc, Arcanum adds on-chain spend ceilings and anomaly defense around that path while leaving your bot logic intact.

The agent calls `arc.executeUSDC()` instead of a direct transfer. The GuardedWallet contract checks policy, vendor allowlists, daily caps, and escalation thresholds before funds move. Within policy, execution is immediate. Above policy, the transfer waits for signer quorum.

Everything is MIT, self-hostable, and non-custodial. The server never holds signer keys.

I would love to show the Arc testnet demo and see where this could support your agent operations.

Docs: `https://thearcanum.in/docs`

Ranbir
