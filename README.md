# TenderShield

**Privacy-preserving procurement & bidding on Midnight — Level 2: browser DApp**

TenderShield is a **privacy-preserving tender** on the Midnight Network. A contracting
authority opens a tender with a public eligibility rule; bidders then go through a
zero-knowledge circuit that **proves eligibility without revealing the vendor's private
figures**. This is the Level 2 web build: a Vite + React browser dApp that connects the
Lace wallet, reads the public tender ledger, and runs the real `submitEligibleBid` circuit
against a deployed TenderShield contract.

## The idea (one paragraph)

Public procurement collides two requirements: **openness** (everyone must be able to
verify the winner was eligible) and **disclosure** (firms don't want to broadcast revenue,
headcount or turnover to every competitor). TenderShield lets a contracting authority
publish a tender with a public eligibility threshold; bidders **prove** they meet it inside
a circuit. The smart contract records only a cryptographic commitment to the winning bid —
verifiable by anyone, with the underlying figures never published. This build adds a
browser UI that demonstrates the full flow end-to-end on the Midnight devnet.

## What each level does

| Level | Build | Deliverable |
| --- | --- | --- |
| **1 — New Moon** | Node/test harness + Compact contract | Circuit compilation, privacy-preserved eligibility circuit, deploy + tests |
| **2 — Waxing Crescent** | Browser (Vite + React) dApp | Wallet connect (Lace), live ledger read, in-browser circuit call, `Deploy New` (fresh tender) — **this repo** |

## Public state vs private witness

| Ledger (public, on-chain) | Witness (private, inside the circuit) |
| --- | --- |
| `tenderId` — public tender identifier | `vendorId` — vendor identity |
| `minTurnover` — public eligibility threshold | `annualTurnover` — the vendor's actual figure |
| `status` — `OPEN / CLOSED / AWARDED` | `opening` — commitment nonce / random secret |
| `turnoverCommitment` — public hash commitment | — |

Only the public commitment ever reaches the chain. The vendor's turnover, identity, and
the "opening" used to open the commitment all stay **private inside the circuit**. The dApp
never renders or logs them — they exist only as in-memory witnesses for the proof.

## Browser architecture (how it's wired)

- **Vite + React (TypeScript)** frontend in `src/`, built with `vite build` → static
  `dist/` (deployable unchanged to Vercel).
- **Midnight.js `DAppConnector` providers**, assembled from:
  - `FetchZkConfigProvider` — loads ZKIR + proving/verifying keys from the app origin
    (`/keys`, `/zkir`), copied from `managed/` by `scripts/copy-web-artifacts.mjs`.
  - `httpClientProofProvider` — talks to a **proof server** the wallet routes to
    (configured inside Lace; `http://localhost:6300` by default).
  - `indexerPublicDataProvider` — reads the public ledger from the configured indexer.
  - In-memory private state provider (scoped to the tender's own contract address, so
    multiple tenders never share private state).
- **Wallet detection** enumerates `window.midnight` for any DApp-Connector v4-compatible
  wallet (Lace, or any wallet exposing the v4 API) — compatible wallets are accepted
  automatically.
- **Privacy enforcement in the UI**: private inputs (`annualTurnover`, `vendorId`,
  `opening`) are module-level constants, never put in React state, never rendered. Only the
  public requirement, the resulting `status` transition, and the public `turnoverCommitment`
  appear on screen. The ZK built-in panel states this explicitly as "Privacy by design".

## Prerequisites

- **Node.js ≥ 22** (tested on 24), npm.
- **Docker Desktop** (engine running) for the local devnet (`npm run test:local`).
- **Lace wallet for Midnight** (or any v4-compatible wallet), funded with tDUST/tNIGHT on
  Preprod, with a proof server configured (default `http://localhost:6300`).
- WSL with an Ubuntu distro *(Windows only)* — `compact compile` runs inside WSL because
  the Compact toolchain has no Windows binary. See `scripts/`.

## Setup

```bash
npm install

# Start the local Midnight devnet (node + indexer + proof server):
docker compose up -d --wait

# Compile the contract (WSL on Windows):
npm run compile:windows        # or: compact compile managed/tendershield/contract tendershield.compact

# Run the Level 1 test suite (full circuit + deploy against the devnet):
npm run test:local
```

## Run the browser dApp

```bash
# Build + serve the frontend with Vite (recommended for local dev over the devnet):
npm run build:web            # type-checks the web tree, copies ZK artifacts, vite build
npm run preview:web          # serve dist/ (port 4173)

# ...or during development:
npm run dev:web              # Vite dev server (port 3000)
```

Configure the network and services via `.env` (copy `.env.example`):

```env
VITE_NETWORK_ID=preprod
VITE_INDEXER_URL=https://indexer.preprod.midnight.network/api/v4/graphql
VITE_INDEXER_WS_URL=wss://indexer.preprod.midnight.network/api/v4/graphql
VITE_PROOF_SERVER_URL=http://localhost:6300
# Optional: pre-set a tender contract address so the app skips "Deploy New":
VITE_TENDERSHIELD_CONTRACT_ADDRESS=
```

Two ways to get a tender on chain from the browser:

1. **Join by address** — paste a `64-char hex` contract address into the "Join Tender"
   field (the app validates it).
2. **Deploy New** — with the wallet connected, the app deploys a fresh TenderShield
   contract from the browser and copies its address. This is the recommended path for a
   repeatable demo (each tender can be AWARDED once; a fresh deploy re-runs the flow).

## Verified deployment address

The following address was produced by an actual Level 1 preview deploy and is **publicly
indexed** (query it yourself via the indexer's GraphQL `contractAction(address:)`):

| Network | Contract address | Notes |
| --- | --- | --- |
| **Preview** (verified deploy) | `73469c3917ed8b4b6d30f342d35d24054fdb2f7a34fdc5ba24e69420e1cb084d` | Live; indexer returns `ContractDeploy`. |
| **Local devnet** | `f09a4b72156067f353c53a3cf06706dd1145f406f6f13d73421a9de6c85a6742` | From `npm run test:local` deploy. |
| **Preprod** | *(deploy in browser or `npm run deploy:preprod`, then record here)* | Wallet connected + tDUST/tNIGHT required. |

> The dApp reads this from `VITE_TENDERSHIELD_CONTRACT_ADDRESS`; if that's empty, use the
> in-app **Deploy New** / **Join by address** controls. A fresh browser deploy always
> produces its own unique 64-char hex address.

## Project structure

```
contracts/tendershield.compact   Compact contract source
managed/tendershield/            generated artifacts (compiler/, contract/, keys/, zkir/)
src/                             browser dApp
  lib/                           midnight.ts, ledger.ts, tenderContract.ts, utils.ts, fetch-zk-config
  hooks/                         useMidnight, useLedger
  components/                    WalletConnect, CircuitCall, LedgerPanel, StatusMessage
  App.tsx / main.tsx             app shell
public/keys public/zkir          copied ZK artifacts (from managed/, browser-served)
scripts/copy-web-artifacts.mjs   copies ZKIR + proving/verifying keys into public/
vite.config.ts                   Vite + wasm + react config
vercel.json                      Vercel build config for the web app
```

## Verification & test results

- **`npm run build:web`** — green. Vite production build emits a browser-compatible bundle
  (native ESM + top-level await, wasm loaded via `vite-plugin-wasm`/`wasm-module-resolver`).
- **`npm run preview:web`** — the built `dist/` serves with HTTP 200.
- **Unit tests** (`vitest`, `src/lib/*.test.ts`) — pass for the web helpers.

## Troubleshooting (Windows)

- **No wallet detected** — the dApp looks for any v4-compatible `window.midnight` wallet.
  If Lace isn't detected: unlock the wallet, or use any other Midnight wallet exposing the
  DApp Connector API.
- **Proof failed to prove / server unreachable** — the proof server must be running and
  Lace's proof-server URI set (default `http://localhost:6300`, for Preprod verify the
  pointing). If using a remote Midnight devnet, the indexer/proof nodes are provided by the
  network; locally, `docker compose up -d`.
- **Indexer has no network / `fetch failed` on `:8088`** — recreate the indexer container:
  `docker compose up -d --force-recreate indexer`.
- **First devnet boot is slow** — the proof-server image downloads its ZK proving keys on
  first start; wait for it to report healthy before running tests.

## License / notes

Challenge entry — nothing here is production software. All values shown on the local devnet
are test data. The Preprod row in the table is intentionally left as a documented directive
(a real deploys produces a unique address) rather than a fabricated placeholder.
