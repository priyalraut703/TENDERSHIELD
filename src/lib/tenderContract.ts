import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import type { Contract as JsContract } from '@midnight-ntwrk/compact-js/effect/Contract';
import type { Types } from 'effect';
import {
  Contract as GeneratedContract,
  ledger,
  type Ledger,
} from '../../managed/tendershield/contract/index.js';

// Browser-safe bridge to the compiled TenderShield contract.
// Unlike contracts/index.ts (Node/tests), this does NOT attach compiled file
// assets — the browser loads ZKIR + proving/verifying keys via the
// FetchZkConfigProvider (served from <origin>/keys and <origin>/zkir).

export { ledger };
export type { Ledger };

export type TenderShieldContract = JsContract<any>;

export const Contract: Types.Ctor<TenderShieldContract> =
  GeneratedContract as unknown as Types.Ctor<TenderShieldContract>;

// No compiled-file assets are attached on purpose (browser ZK config lookup).
// The residual context type is clamped to `never` so it type-checks against
// deployContract / submitCallTx, which expect a compiled contract without paths.
export const CompiledTenderShieldContract = CompiledContract.make(
  'TenderShield',
  Contract,
).pipe(CompiledContract.withVacantWitnesses) as CompiledContract.CompiledContract<
    TenderShieldContract,
    any,
    never
  >;