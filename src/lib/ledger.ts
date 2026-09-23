import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  ledger,
  type Ledger,
  TenderStatus,
} from '../../managed/tendershield/contract/index.js';
import { isHexContractAddress, fromHex } from './utils.js';

export { TenderStatus };

export interface LedgerWindow {
  status: string;
  fields?: TenderShieldLedgerState;
  error?: string;
}

export interface TenderShieldLedgerState {
  contractAddress: string;
  tenderId: Uint8Array;
  status: TenderStatus;
  minTurnover: bigint;
  turnoverCommitment: Uint8Array;
  commitmentHex: string;
  tenderIdHex: string;
}

const CONTRACT_STATE_QUERY = `
  query ContractState($address: HexEncoded!) {
    contractAction(address: $address) {
      state
    }
  }
`;

// Reads the PUBLIC on-chain ledger of a TenderShield contract directly from the
// indexer GraphQL API. No wallet connection is required for this read.
export async function fetchLedgerState(
  contractAddress: string,
  indexerUrl: string,
): Promise<TenderShieldLedgerState | null> {
  if (!isHexContractAddress(contractAddress)) {
    throw new Error('Contract address must be 64 hexadecimal characters.');
  }

  const res = await fetch(indexerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: CONTRACT_STATE_QUERY,
      variables: { address: contractAddress },
    }),
  });

  if (!res.ok) {
    throw new Error(`Indexer request failed with HTTP ${res.status}.`);
  }

  const gql = (await res.json()) as {
    errors?: Array<{ message?: string }>;
    data?: { contractAction?: { state?: string } | null };
  };

  if (gql.errors?.length) {
    throw new Error(gql.errors[0]?.message ?? 'Indexer query failed.');
  }

  const stateHex = gql.data?.contractAction?.state;
  if (!stateHex) {
    throw new Error('Contract not found on the selected network.');
  }

  const contractState = ContractState.deserialize(fromHex(stateHex));
  const state = ledger(contractState.data) as ProcessedLedger;

  return {
    contractAddress,
    tenderId: state.tenderId,
    status: state.status,
    minTurnover: state.minTurnover,
    turnoverCommitment: state.turnoverCommitment,
    commitmentHex: bytesToHex(state.turnoverCommitment),
    tenderIdHex: bytesToHex(state.tenderId),
  };
}

type ProcessedLedger = Pick<Ledger, 'tenderId' | 'status' | 'minTurnover' | 'turnoverCommitment'>;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const STATUS_LABEL: Record<TenderStatus, string> = {
  [TenderStatus.OPEN]: 'OPEN',
  [TenderStatus.CLOSED]: 'CLOSED',
  [TenderStatus.AWARDED]: 'AWARDED',
};