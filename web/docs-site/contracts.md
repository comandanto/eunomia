# Contracts & Addresses

Network: **Stellar mainnet** (`Public Global Stellar Network ; September 2015`), in beta.

## Current contracts

| Contract | Address / hash |
| --- | --- |
| **Treasury factory** (one owner signature: deploy + rules + payees + Leash + funding + registry; it has no admin and keeps no authority over what it creates) | [`CBO5F4MR…FUPEB`](https://stellar.expert/explorer/public/contract/CBO5F4MRST2BH4W3SSXSQXKFBTK5Y5AWNTVDH47KO65MXJTBTYSFUPEB) |
| **Treasury v4 wasm** (what the factory instantiates) | `c11a5c63e610be259cdcf23d276fdf6f3069fdc6069c4d713b52d556f24238ec` |
| **Treasury Registry** (cross-device backup) | [`CCQQBCR5…DZTNXB`](https://stellar.expert/explorer/public/contract/CCQQBCR55OZKAGHNIWOOX265XTYITLOAXITLTPJTZNYEOJYT2QDZTNXB) |
| **XLM** (Stellar Asset Contract) | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| **Circle USDC** (asset contract of `USDC:GA5ZSEJY…KZVN`) | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

Every treasury carries a **deposit cap**, fixed by the factory at creation, for the length of
the beta: 500 XLM for an XLM treasury, 100 USDC for a USDC one. The factory creates
treasuries of those two tokens only. The compliance verifier (ZK) is not deployed on mainnet in the beta.

Contract test suites: treasury **91** · factory **17** · registry · verifier · policy
(`cargo test`, run in CI). What each version proved on chain before mainnet is summarised in
[`DEPLOYMENT.md`](https://github.com/eunomia-finance/eunomia/blob/main/DEPLOYMENT.md#retired-testnet-history).

## Error codes

A rejected payment is the product working — these are the reasons a call reverts:

| # | Error | Meaning |
| --- | --- | --- |
| 1 | `InvalidAmount` | Zero/negative amount |
| 2 | `PayeeNotWhitelisted` | Destination was never approved |
| 3 | `ExceedsTaskLimit` | Above the per-payment cap |
| 4 | `ExceedsDailyLimit` | Above what's left of the rolling 24h cap |
| 5 | `BelowReputationThreshold` | Reputation gate not cleared |
| 6 | `InsufficientFreeBalance` | Escrow-locked funds can't be spent |
| 7-8 | `EscrowNotFound` / `DeadlineNotReached` | Escrow lifecycle guards |
| 9 | `Paused` | Owner froze spending (withdraw still works) |
| 10 | `ExceedsSessionLimit` | Above the Leash's own cap |
| 11 | `InvalidLimits` | Rules must satisfy `0 < per-payment ≤ daily` |
| 12 | `InvalidDeadline` | Escrow deadline in the past |
| 13 | — | Not the treasury's: the token contract's `TrustlineMissing`, surfaced with the token's own numbering |
| 14 | `ExceedsPayeeCap` | Above what this payee may receive this month |
| 15 | `ExceedsMonthlyLimit` | Above what's left of the monthly budget |
| 16 | `ExceedsDepositCap` | A deposit would take the treasury over its beta cap |
| 17 | `PayeeOutsideTaskBudget` | The agent's task budget does not name this payee |

## ERC-8004 registries (integration target)

Production reputation targets [trionlabs/stellar-8004](https://github.com/trionlabs/stellar-8004)
(SDK: `@trionlabs/8004-sdk`). A treasury's reputation gate names a registry by address; it is
off unless the owner sets one.
