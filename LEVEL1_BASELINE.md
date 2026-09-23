# LEVEL1_BASELINE.md — TenderShield Level 1 state (input for Level 2)

This file records exactly what Level 1 already gives us, so Level 2 (Waxing
Crescent: Frontend Integration) builds on it without rewriting the contract.

## What Level 1 already implements

A Compact smart contract for **privacy-preserving procurement/bidding**,
compiled with `compact 0.31.1` (language `0.23.0`, runtime `0.16.0`) and
verified against the **Midnight local devnet** and **Midnight Preview**:

- Contract source: `contracts/tendershield.compact`
- TS bridge (Node-only): `contracts/index.ts`
- Generated artifacts (committed): `managed/tendershield/`
- Full vitest suite: `tests/tendershield.test.ts`, `tests/deploy.test.ts`
- Local devnet: `compose.yml` (node :9944, indexer :8088, proof-server :6300)
- CI: `.github/workflows/ci.yaml` (ubuntu, toolchain 0.31.1, devnet, tests)
- Remote deploy scripts: `npm run deploy:preview`, `npm run deploy:preprod`

The contract publishes a tender with public parameters (`tenderId`,
`minTurnover`, `status`) and a cryptographic commitment
(`turnoverCommitment`). An eligible bidder proves eligibility *inside a ZK
circuit*; the vendor's real figures never reach the ledger.

## Contract address

| Network | Address | Verified |
| --- | --- | --- |
| Midnight Preview | `baecf02476ec56f454dd540d72541c50968452c40f6571c27396ebcdcef68b59` | ✅ public indexer returns `ContractDeploy` |
| Local (undeployed) | `f09a4b72156067f353c53a3cf06706dd1145f406f6f13d73421a9de6c85a6742` | ✅ local indexer returns `ContractDeploy` |
| Midnight Preprod | **pending Level 2** (**none deployed so far**) | — |

## Available circuits

| Circuit | Signature | Effect |
| --- | --- | --- |
| `submitEligibleBid` | `(vendorId: Bytes<32>, annualTurnover: Uint<64>, opening: Bytes<32>) -> []` | asserts `status == OPEN`, asserts `annualTurnover >= minTurnover`, writes `turnoverCommitment = persistentCommit([vendorId, turnover], opening)`, sets `status = AWARDED` |
| `closeTender` | `() -> []` | asserts `status == OPEN`, sets `status = CLOSED` |

No witnesses/vacant witnesses: `Witnesses<PS>` is empty in the generated
bindings.

## Ledger (public, on-chain) state

| Field | Type | Meaning |
| --- | --- | --- |
| `tenderId` | `Bytes<32>` | public tender identifier (constructor `disclose`) |
| `minTurnover` | `Uint<64>` | eligibility threshold (public by design) |
| `status` | enum `OPEN | CLOSED | AWARDED` | lifecycle state |
| `turnoverCommitment` | `Bytes<32>` | SHA-256-style commitment to the winning vendor's values |

## Private witnesses (never on-chain)

| Input | Meaning |
| --- | --- |
| `vendorId` | vendor identity (hidden) |
| `annualTurnover` | vendor's actual financial figure (hidden) |
| `opening` | commitment random nonce (hidden) |

Only the *state transition* is verifiable; neither `annualTurnover`, the
`vendorId`, nor the `opening` can be recovered from `turnoverCommitment`.

## Which circuit is demonstrated in Level 2

**`submitEligibleBid`** — it is the privacy showpiece of TenderShield:

- private: `vendorId`, `annualTurnover`, `opening`
- public/observable: `minTurnover` (requirement), proof success, resulting
  `status = AWARDED`, and a `turnoverCommitment` on-chain
- proved without revealing: `annualTurnover >= minTurnover`

> Lifecycle note: this circuit is **single-shot** per tender — it asserts
> `status == OPEN` and transitions to `AWARDED`. A demo contract can award a
> successful bid **once**; repeat demonstrations need a freshly deployed
> tender (exactly like the official Midnight leaderboard demo's "Deploy New").

## What Level 2 is adding

- React + Vite + TypeScript frontend (browser DApp) in the same repo
- Lace wallet connection via `@midnight-ntwrk/dapp-connector-api` (v4.0.1)
- Midnight.js providers assembled in the browser
  - `FetchZkConfigProvider` (ZKIR + proving/verifying keys served from `public/`)
  - `httpClientProofProvider` (proof server URI from the wallet config)
  - `indexerPublicDataProvider` (indexer URIs from the wallet config)
  - in-memory private state provider
  - wallet/midnight provider bridge via `balanceUnsealedTransaction` /
    `submitTransaction`
- Real `submitEligibleBid` circuit call from the browser against a **Preprod**
  TenderShield contract (existing or freshly deployed)
- Privacy-by-design UI: the private turnover is never rendered
- Observed on-chain result: commitment recorded + tender `AWARDED`

## References

- Compact contract: `contracts/tendershield.compact`
- Generated bindings: `managed/tendershield/contract/index.d.ts`
- Level 1 README: `README.md` (pre-Level-2 state)