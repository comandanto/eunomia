# Compliance Circuit - Audit Notes

> Originally a self-review pass of the ZK surface dated 2026-07-09 (Turkish, written against N=8).
> Translated to English and re-pointed at the current code: `compliance.circom`
> (`Compliance(16, 8, 64)`, see `circuits.json`) and `contracts/compliance_verifier/src/lib.rs`.
> Line numbers are for the tree this file ships in and drift; search for the named symbols if they do.

## Done right (keep these, no regressions)

- **Range-check before compare** (`compliance.circom:90-95`): `Num2Bits(nBits)` pins each amount to
  64 bits before it is compared with `perTaskLimit`, which closes the mod-p negative-wrap bypass.
  The total gets the same treatment at `compliance.circom:116-123` (`nBits + 4` bits).
- **CSPRNG salt** (`circuits/scripts/prove.ts:62`, `packages/prover/src/salt.ts`): the commitment
  `Poseidon(amount, payee, salt)` only hides the amount if the salt is unpredictable; a weak salt
  would let a small amount space be brute-forced.
- **Replay guard** (`compliance_verifier/src/lib.rs:346-369`): a period must be closed, recent, and
  strictly after the treasury's last attested period (`PeriodNotClosed`, `PeriodTooOld`,
  `PeriodNotAdvancing`). `periodId` has no constraint in the circuit ("public binding only") but is
  still safe: it is a Groth16 public input, so a proof cannot be moved to another period.
- **Policy binding** (`lib.rs:310-343`): limits and whitelist root in the proof must equal what the
  treasury itself reports, otherwise `PolicyMismatch`. Without this the verifier would only say
  "the agent obeyed a policy of its own choosing".
- **Spend binding** (`compliance.circom:125-128`, `lib.rs:373-380`): the batch total must equal the
  period total the verifier reads from the treasury's storage (`SpendMismatch`).
- **Padding is safe** (`prove.ts:53-60`): empty slots use amount 0 and a real whitelisted payee, so
  the Merkle and commitment checks stay consistent and nothing dummy leaks.

## Findings

### 1. (Architecture, most important) commitments vs. real treasury movements

The circuit proves that a compliant batch exists whose total equals the period's on-chain spend. It
does not prove that each commitment is a payment the treasury actually made: the treasury never sees
or stores a Poseidon commitment, `pay()` emits a plaintext `(paid, task_id) -> (to, amount)` event
(`contracts/treasury/src/lib.rs:593`), and the prover builds the batch from its own JSON
(`buildInput`). The "commitment time" comment in `create_escrow` refers to locking funds, not to
the ZK commitments; the name clash is a dead end.

What the attestation therefore means today: "a batch that sums to the period's real spend and obeys
the anchored policy", not "these were the individual payments". The `periodSpent` binding narrows
the gap (the batch cannot invent or omit value) but does not close it. It is not a funds-safety
issue, since funds are bounded by the contract. Direction for a full fix: a commitment accumulator
updated at `pay()` time, with the verifier checking the batch against that set.

### 2. Public limits not range-checked: resolved

The circuit compares `perTaskLimit` with `LessEqThan(nBits)` (64 bits) and the total with
`dailyLimit` using `LessEqThan(nBits + 4)` (68 bits). The verifier rejects limits outside those
ranges (`fits_bits(&daily, 68)`, `fits_bits(&per_task, 64)`, `LimitExceedsCircuitRange`,
`lib.rs:331-332`).

### 3. N=16 and the total's bit width: false alarm

`Num2Bits(64)` bounds an amount by `2^64 - 1`, so at N=16 the maximum total is
`16 * (2^64 - 1) = 2^68 - 16 < 2^68` and fits `Num2Bits(68)`. The margin is N units. If N grows
past 16, widen both the `Num2Bits` and `LessEqThan` on the total to `nBits + 5`
(`compliance.circom:111-115`).
