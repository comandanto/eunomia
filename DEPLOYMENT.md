# Eunomia — Deployment

Network: **Stellar mainnet** (`Public Global Stellar Network ; September 2015`) — the only one
the app, the relay, the indexer and `eunomia-mcp` run on.

## Mainnet contracts

Set at deploy. Until then the app refuses to build and the relay and indexer refuse to run
(both fail closed on the empty settings below).

| Item | Value |
|---|---|
| Treasury v4 wasm | `c11a5c63e610be259cdcf23d276fdf6f3069fdc6069c4d713b52d556f24238ec` (the code `web/src/lib/treasuryWasm.ts` pins; uploaded at deploy) |
| **Treasury factory** | set at deploy → `EUNOMIA_FACTORY_ID`, `RELAY_FACTORY_ID` |
| **Treasury registry** | set at deploy → `EUNOMIA_REGISTRY_ID`, `RELAY_ALLOWED_CONTRACTS`, the indexer's `REGISTRY_ID` |
| Deposit caps (beta) | the factory's constructor, one per token: **500 XLM** and **100 USDC** (about the same in dollars on 2026-10-24); any other token is refused |
| Passkey smart-wallet wasm | `fdefad64b96837147e1c333e51f537b696eab925e9f147e63d597c04e3c903f0` (`passkey-kit`; admitted by the relay through `RELAY_ALLOWED_WASM`) |
| XLM (SAC) | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| Circle USDC (SAC of `USDC:GA5ZSEJY…KZVN`) | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

The factory has no admin: the treasury wasm, the registry and the accepted tokens with their
deposit caps are pinned at its own deploy (v4.1: a single cap had meant 100 XLM and 100 USDC
alike, two bounds about six times apart). Raising a cap means a new factory; a treasury keeps
the cap it was born with. The registry refuses to list a treasury whose admin is not the
owner, and has `unregister` (review H2); the app also checks that a treasury it opens runs the
shipped wasm, since a contract can claim any admin. The compliance verifier (ZK) is not part of the beta; see `SECURITY.md`.

## Treasury v4 — what every treasury enforces

Monthly budget, payee caps, task budgets and a deposit cap on top of the v3 policy gate.
`cargo test -p treasury` → 91, `cargo test -p treasury_factory` → 12.

- **Monthly budget** — `set_monthly_limit`; agent-moved value per UTC calendar month
  (`month_of`: integer civil-from-days, no host call), charged at escrow commitment.
- **Payee cap** — `set_payee_cap`; most one payee may receive per month. Narrows, never
  approves. Capping the agent's own float address bounds money that left the treasury.
- **Task budget** — `set_task_budget(agent, valid_until, limit, payees)`: a Leash restricted
  to ≤16 named payees; `set_session` and `revoke_session` clear the scope.
- **Deposit cap** — a constructor argument with no setter; `deposit` refuses to take the
  balance over it. A bare SAC transfer to the address cannot be refused by any contract, so
  the cap binds every client that funds through `deposit` — the app and the factory do.

## Error codes

`1` InvalidAmount · `2` PayeeNotWhitelisted · `3` ExceedsTaskLimit · `4` ExceedsDailyLimit ·
`5` BelowReputationThreshold · `6` InsufficientFreeBalance · `7` EscrowNotFound · `8` DeadlineNotReached ·
`9` Paused · `10` ExceedsSessionLimit · `11` InvalidLimits · `12` InvalidDeadline ·
`14` ExceedsPayeeCap · `15` ExceedsMonthlyLimit · `16` ExceedsDepositCap · `17` PayeeOutsideTaskBudget.
13 is skipped on purpose: it is the token contract's `TrustlineMissing`, and a failure inside
the token surfaces with the token's own numbering.

## The app and its relay — Cloudflare

`web/wrangler.jsonc` + `web/worker/index.ts`: the built app as Workers static assets,
`/api/relay` handled by the host-neutral `src/lib/relayHandler.ts`, and `/api/rpc` by
`src/lib/rpcProxy.ts`. Deploy: `npm run deploy:cf`.

- **Build settings.** `npm run build` refuses to start until `EUNOMIA_RPC_URL`,
  `EUNOMIA_FACTORY_ID` and `EUNOMIA_REGISTRY_ID` are set (`web/src/networks.ts`). For a
  deployed build the RPC is the app's own `https://<host>/api/rpc`.
- **The RPC behind a key (2026-10-24).** The provider (Validation Cloud, free plan) is reached
  through a URL that carries the account key, so it is the worker secret `RELAY_RPC_URL` and
  never enters the bundle. `/api/rpc` forwards one JSON-RPC call per request, only the methods
  the app uses (reads, `simulateTransaction`, `sendTransaction`), at most 64 KB, behind
  `RPC_LIMITER` (300 a minute per IP), and fails closed without the secret or the limiter. It
  adds no authority: anything sent through it could go to any public RPC. The chain indexer
  takes the same URL as its secret `RPC_URL`. `check:no-secrets` fails any bundle that carries a secret
  seed, a test-network endpoint or the retired demo's addresses; CI builds with stand-in ids
  on every push.
- **What the relay pays for.** `RELAY_FACTORY_ID`, the contracts in `RELAY_ALLOWED_CONTRACTS`,
  and contracts running a wasm we ship (the treasury, in code; the passkey wallet, through
  `RELAY_ALLOWED_WASM`). No native-XLM transfers: a treasury is funded through its own
  `deposit`. `RELAY_RPC_URL` (a secret) and `RELAY_DAILY_BUDGET_XLM` are required, and nothing is
  sponsored without both limiters and the budget bound. The fee account is `RELAY_SECRET`.
- **Rate limits.** `RELAY_LIMITER`: 20 requests a minute per client IP; `RELAY_WALLET_LIMITER`:
  10 a minute per signing wallet; each per Cloudflare location. Cloudflare documents them as
  permissive and eventually consistent; a 120-request burst returned 10 × 429. They slow a
  caller down; they do not bound the bill.
- **Fee limits (2026-10-22, review M2).** Every transaction is priced before it is sent
  (inclusion fee plus the padded resource fee: the most it may cost) and refused when it
  costs more than `RELAY_MAX_FEE_XLM` (default 1; a factory create measured 0.32 XLM of
  resource fee), would leave the fee account under `RELAY_MIN_BALANCE_XLM` (default 5; logged
  as `fee account below floor`, the line to alert on), or would take the UTC day past
  `RELAY_DAILY_BUDGET_XLM`. The day's total lives in one Durable Object (`RELAY_BUDGET`,
  `worker/relayBudget.ts`) so every instance charges the same counter; an unreachable counter
  refuses. A send rejected `txBadSeq` (two requests on the same fee-account sequence) is
  rebuilt on the fresh sequence, up to three sends, charged once.
- **Strict CSP** (`scripts/headers.mjs` → `dist/_headers`): `script-src 'self'` plus the hash
  of every inline script in the build (the docs' page-hash map changes with the docs, so the
  hashes are computed after `vite build`, CRLF-normalised the way the browser parses them),
  `connect-src` limited to Stellar, the pinned RPC's origin, Supabase, WalletConnect and the
  analytics beacon, `frame-ancestors 'none'`.
- **USDC deposits (2026-10-23).** A USDC treasury is funded the way an XLM one is: the owner's
  wallet (classic or passkey) calls the treasury's `deposit`, which moves the treasury's own
  token under the same cap. The fund form shows the wallet's USDC first, read from the SAC (a
  missing trustline reads as 0). A failed deposit is worded by `depositErr`: only #1 and #16
  are the treasury's, every other code is the token's. Each token has its own cap in the
  factory (v4.1), so the bound is the same in dollars whichever token a treasury holds.
- **No test network, no keys in the app (2026-10-24).** The guided demo, its embedded agent
  key, the in-browser Leash key, friendbot, the faucet and the TRY anchor sandbox are gone
  from the code; the Leash is always the agent's own key, registered by its public half.

Moving eunomia.finance itself is a DNS change (Porkbun → Cloudflare) and the last step.

## Usage metrics — chain indexer

`activity` only sees what the web app logs; payments an agent makes through eunomia-mcp never
reach it. `workers/chain-indexer` is a Cloudflare Worker that, every 15 minutes, pages Stellar
RPC events for the registry (`regd`) and every known treasury (`paid`, `session`, `revoked`,
`withdrawn`, escrow, payee and limit changes) into Supabase (migration `0006_chain_events`),
each row labelled `mainnet`. A stored cursor continues where the last run stopped — the RPC
keeps only ~7 days of events.

- Weekly numbers: `select * from chain_weekly;` (new treasuries, sessions, payments, paying
  treasuries, repeat treasuries = paid on 2+ distinct days).
- Deploy: set `RPC_URL` and `REGISTRY_ID` in `wrangler.jsonc`, then `cd workers/chain-indexer &&
  npm i && npx wrangler secret put SUPABASE_URL && npx wrangler secret put
  SUPABASE_SERVICE_ROLE_KEY && npx wrangler deploy`.

## Retired testnet history

Everything below ran on Stellar testnet before the mainnet beta (2026-07 → 2026-10-23). The
test network is no longer used by any part of Eunomia and its state is wiped on SDF's resets;
the transaction-level record (addresses, hashes, ledgers) is in this file's git history up to
2026-10-23. What was measured there:

- **Policy gate on chain.** A rogue payment to a non-whitelisted address reverted with
  `#2`; over-cap payments with `#3` / `#4`; a paused treasury refused with `#9` while
  `admin_withdraw` still worked; a lowered per-payment limit applied to the very next call.
- **Agent sessions (v3).** The session key was the only spender while active (the root
  agent's signature stopped authorising `pay`), over-cap refused with `#10`, revoke restored
  the root agent. Escrow commitments counted against the daily limit at creation (v3.3).
- **Reputation and escrow (v2).** A non-whitelisted payee above the reputation threshold was
  paid; escrow released on approval and refunded after its deadline.
- **Treasury factory.** One owner signature created a treasury with policy, payee, Leash,
  funding and registry entry — from a wallet and from a passkey on the live site, where the
  authenticator's counter moved by exactly one across the create step.
- **v4.** A payee cap refused the payment past it (`#14`), the deposit cap refused one stroop
  over (`#16`), a task budget refused a payee it did not name (`#17`), a monthly budget set to
  exactly what was spent refused one stroop more (`#15`), and the factory's address
  prediction matched the deployed treasury.
- **eunomia-mcp.** The agent's own key paid in budget over MCP, was refused in simulation with
  the contract's codes, recorded one refusal on the ledger (`--record-rejection`, `#3`), filed
  an exception request that turned `approved` once the owner approved the payee, and closed it
  with the payment. 0.3.0 funded a float, bought from an x402 seller settled by the official
  `@x402/stellar` facilitator, was refused a payee outside its task budget and over its payee
  cap, and swept the rest back.
- **ZK compliance.** The verifier refused a valid proof of a fabricated batch
  (`SpendMismatch`), an open period and a replay, and attested a closed period of real agent
  payments whose total equalled the treasury's `period_spent`.
- **Relay on Cloudflare.** A passkey call relayed through the worker confirmed on the ledger.
- **Testers.** 18 external testers (16 with on-chain proof: 12 wallets registered in the
  registry, 9 of which funded their treasury, plus 4 from before the registry existed; 2 who
  explored and reported back), 17 treasuries they deployed, 22 funding and payment
  transactions, 16 payments the contract refused; 14 feedback responses averaging 4.9 / 5.
  Our own and end-to-end wallets were excluded (`docs/metrics/e2e-exclude.json`); the
  cumulative count is `docs/metrics/registered-users.json`.
