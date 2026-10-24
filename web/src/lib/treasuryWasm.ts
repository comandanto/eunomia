// The treasury WASM the app instantiates for every new user treasury.
//
// Deliberately dependency-free: both the browser bundle and the serverless relay import it,
// and the relay runs outside Vite, where anything reaching `import.meta.env` breaks.
//
// v4 (2026-10-19): a calendar-month budget, monthly caps per payee, task budgets (a Leash
// limited to named payees) and a deposit cap fixed at deploy. Error codes 14-17. Carries
// v3.5's MAX_BATCH ceiling and the surfaces a compliance proof binds to forward unchanged.
//
// Contracts are immutable: a treasury keeps running the code it was born with. When this hash
// moves, the old one has to stay admitted by the relay (see relayGuard.allowedWasmHashes), or
// every owner of an older treasury loses the passkey path into their own funds.
export const TREASURY_WASM_HASH =
  "c11a5c63e610be259cdcf23d276fdf6f3069fdc6069c4d713b52d556f24238ec";

/** Treasury code this app deployed in the past and must keep able to spend. Mainnet starts at
 *  v4, so there is none yet. Append here when the shipped hash moves; never replace. */
export const LEGACY_TREASURY_WASM_HASHES: string[] = [];
