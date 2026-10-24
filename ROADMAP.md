# Eunomia Roadmap

Eunomia runs on **Stellar mainnet, in beta**, and is growing into **mainnet agent-payments infrastructure on Stellar**. Milestones are sequenced, not dated — each one unlocks the next, and each is verifiable on-chain or in the repo.

## M1 — Traction *(shipped, before mainnet)*

- [x] Bounded treasury — payee whitelist + per-task & daily limits enforced on-chain
- [x] Per-user product: connect a wallet → deploy your own treasury → fund → whitelist → spend
- [x] ZK compliance layer — Circom/Groth16 proofs, hardened on-chain BN254 verifier (policy binding + replay guard)
- [x] Analytics & monitoring + in-app feedback + on-chain activity logging (proof of usage)
- [x] 10+ real user wallets with on-chain interactions (risein Journey-to-Mastery Level 4) — 18 external testers, 16 with on-chain proof, 17 tester-deployed treasuries (as of 2026-09-19)
- [x] Published user-feedback summary — [`DEPLOYMENT.md` → Retired testnet history](DEPLOYMENT.md#retired-testnet-history)

## M2 — Agent infrastructure *(shipped 2026-07-07)*

Closing the gap between "a human signs every payment" and "an agent spends autonomously, safely":

- [x] **Session-key agent signing** — time-bound, spend-capped agent credentials per user treasury (`agent ≠ admin`), instant revocation; the agent's session key signs payments with zero wallet popups
- [x] **Contract lifecycle** — pause/freeze switch, agent-key rotation, admin withdraw, limit updates (the contract stays deliberately non-upgradeable; the exit is pause + withdraw)
- [x] **On-chain treasury registry** — discovery & recovery by owner wallet (no client-side-only state)
- [x] **Rolling daily-limit window** — closed the fixed-UTC-day 2× boundary spend (hourly buckets)

## M2.5 — Anyone can start, any agent can connect *(shipped 2026-08 → 09)*

What stood between a working contract and a product a stranger can use in one sitting:

- [x] **Passkey onboarding** — Face ID / fingerprint / PIN controls a Stellar smart wallet that owns the treasury; a fail-closed relay sponsors fees, so a new user needs no wallet and no seed phrase
- [x] **One-signature setup** — the treasury factory deploys, sets the policy, approves payees, starts the Leash, funds and registers, atomically
- [x] **`eunomia-mcp` on npm** — an MCP server + SDK: any MCP agent (Claude included) checks its budget, pays, settles x402 payment requirements and asks the owner for exceptions; refusals arrive with the contract's own error codes. The agent's key is made on its own machine; the owner signs only a cap and a deadline — in the same signature that creates the treasury, if they wish
- [x] **A SEP-6 fiat ramp, proven** — TRY in at a locked rate, USDC into the treasury, and back out to an IBAN, against a sandbox anchor. Retired from the app at the mainnet cutover until a production anchor is in place (M4)
- [x] **Proofs bound to chain state** — the ZK attestation re-reads limits, payee root and the period total from the treasury itself; a fabricated batch is rejected on-chain
- [x] **Third security review** — full scope, every finding tracked in [`SECURITY.md`](SECURITY.md)
- [x] **The dashboard reports what the rules did** — latest verdict, decision ledger, budget meter, Leash

## M3 — Mainnet beta *(in progress)*

Real money, bounded twice: by the owner's rules, and by a deposit cap on every treasury while the code is reviewed but not externally audited.

- [x] **Treasury v4** — monthly budget, payee caps, task budgets, and a deposit cap fixed at creation
- [x] **Review of what shipped since the last round** — the treasury factory, `eunomia-mcp` and the relay; its high and medium findings are closed, the rest are tracked in [`SECURITY.md`](SECURITY.md)
- [x] **A relay that cannot be drained** — rate limits per IP and per wallet, a per-call fee cap, a fee-account floor and a daily fee budget
- [x] **Mainnet only** — the app is built for one network and refuses to build without a pinned RPC; no keys, no demo and no test-network endpoint can ship in the bundle; the agent always brings its own key
- [x] **Mainnet USDC** — Circle's USDC, deposited from the owner's wallet through the treasury's capped `deposit`
- [ ] **Mainnet deployment** — the factory and the registry, with the beta's deposit cap
- [ ] Fee sponsorship for agent accounts (today the agent's key pays its own fees)
- [ ] An **external audit**, before the deposit cap goes
- [ ] Multi-party **trusted-setup ceremony** for the ZK circuit (replacing the single-party dev setup), then the verifier on mainnet

## M4 — Ecosystem integrations

- [ ] Production **ERC-8004 reputation** ([trionlabs/stellar-8004](https://github.com/trionlabs/stellar-8004)) — earned reputation replaces the stand-in oracle, with a separate, lower cap for reputation-admitted payees (SECURITY.md, M4)
- [ ] **A production SEP-6 anchor** — TRY in and out with real bank rails and real KYC. The client was proven against a sandbox; the counterparty is the work. With **SEP-45** on the anchor's side, so a smart wallet signs in itself
- [ ] **x402 at scale** — the bounded buyer and `eunomia-mcp`'s `pay` settle x402 requirements today; next is the service side: paying real, USDC-priced agent-facing APIs from a treasury, and a directory of them
- [ ] **The agent's refusals in the owner's ledger** — payments made through `eunomia-mcp` already appear in the decision ledger (read from the treasury's own events); refusals met in simulation leave no trace on chain, so they need their own path, beside the exception requests
- [ ] **Agent-platform skills** (OpenClaw / ClawHub) — packaged on top of `eunomia-mcp`, so agents on those platforms pick a treasury up conversationally
- [ ] ZK compliance wired into the payment flow (confidential-by-default option), composing with OpenZeppelin Confidential Tokens via `ComplianceHooks`
- [ ] More on-ramps: the same SEP-6 client against anchors in other currencies

## M5 — Growth & sustainability

- [ ] 50+ active user wallets (risein Level 5-7 targets)
- [ ] Revenue model validated with real users (candidates: fee on treasury operations, premium policy features) — decided by usage data, not assumption
- [ ] Ecosystem partnerships formalized (Stellar Türkiye, Trion Labs, anchors, agent-platform integrations)

---

**Where we are:** M1, M2 and M2.5 are shipped; M3 is in progress — the app, the relay and `eunomia-mcp` are mainnet-only, and the contracts' mainnet deployment is the next step. Progress is tracked in the commit history, [`CHANGELOG.md`](CHANGELOG.md) and [`DEPLOYMENT.md`](DEPLOYMENT.md).
