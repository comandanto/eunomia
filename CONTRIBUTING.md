# Contributing to Eunomia

Thanks for helping. This file covers local setup, the checks CI runs, and how we write
commits and pull requests. Eunomia is on Stellar mainnet in beta, so changes to the
contracts or to anything that signs or moves funds get a careful review.

## Security issues

Do not open a public issue for a vulnerability. Follow [`SECURITY.md`](SECURITY.md)
(GitHub private vulnerability reporting, or the email listed there).

## Repository layout

| Path | What it is |
|------|------------|
| `contracts/` | Soroban contracts (Rust workspace: treasury, policy, factory, registry, reputation oracle, compliance verifier) |
| `web/` | The app and docs site (Vite, React, vitest) |
| `packages/mcp` | `eunomia-mcp`, the MCP server for agents |
| `packages/x402`, `packages/prover` | x402 gate and payer, and the salt and payee-field prover helpers |
| `packages/*-client` | Generated contract clients (see "Generated copies" below) |
| `circuits/` | Circom compliance circuit and its witness tests |
| `workers/chain-indexer` | Cloudflare worker that indexes chain events |

## Local setup and tests

The commands below are the ones CI runs (`.github/workflows/ci.yml`). CI uses Node 22.
Run `npm install` in the directory first.

**Contracts** (needs a stable Rust toolchain), from the repository root:

```sh
cargo test --workspace
```

**Web**, in `web/`:

```sh
npm install
npm run lint
npm test
npm run build
```

`npm run build` also runs the `check:no-secrets` gate. CI builds with stand-in values for
`EUNOMIA_RPC_URL`, `EUNOMIA_FACTORY_ID` and `EUNOMIA_REGISTRY_ID`; see the `Build` step in
`ci.yml` for the shape, and `web/.env.example` for the app's other settings.

**MCP server**, in `packages/mcp/`:

```sh
npm install
npm test
npm run build
```

**x402 and prover**, in `packages/x402/` and `packages/prover/`:

```sh
npm install
npm test
```

**Chain indexer**, in `workers/chain-indexer/`:

```sh
npm install
npm test
npm run typecheck
```

**Circuits**, in `circuits/`: the tests compile `compliance.circom`, so the `circom`
binary (v2.2.3 in CI) must be on your `PATH`.

```sh
npm install
npm test
```

## Generated copies

`web/` and `packages/mcp` carry byte-identical copies of some files so each can be built
and published on its own, and CI fails if they drift. After changing a contract binding,
build the wasm and run `npm run generate` in the matching `packages/*-client` (needs the
`stellar` CLI; it also syncs the web copy). In
`packages/mcp/`, `npm run check:bindings` and `npm run check:codec` verify the copies and
`npm run sync:bindings` refreshes the treasury binding.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`,
  for example `fix(mcp): pin the package version in printed client configs`. Common types
  here are `feat`, `fix`, `docs`, `chore`, `ci`, `test` and `refactor`; the scope is the
  area you touched (`contracts`, `web`, `mcp`, `circuits`, `deploy`, ...).
- Keep a pull request to one change, and reference the issue it resolves (`Closes #123`).
- Add or update tests with the change, and run the checks for every area you touched.
- Fill in the pull request template honestly. Mark a checklist item `n/a` with a reason
  if it does not apply.

## Licence

The repository is under the [MIT licence](LICENSE), with one exception: `packages/mcp`
(`eunomia-mcp`) is Apache-2.0 and ships its own [`LICENSE`](packages/mcp/LICENSE). By
contributing you agree that your contribution is licensed under the licence of the part of
the tree you change.
