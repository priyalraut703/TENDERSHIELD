import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { Configuration } from '@midnight-ntwrk/dapp-connector-api';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type FinalizedTransaction, type TransactionId, Proof, SignatureEnabled, Binding, Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { MidnightProviders, UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import semver from 'semver';

import { inMemoryPrivateStateProvider } from './in-memory-private-state-provider.js';
import { CompiledTenderShieldContract, type TenderShieldContract } from './tenderContract.js';

export type TenderShieldCircuits = 'submitEligibleBid' | 'closeTender';

export type TenderShieldProviders = MidnightProviders<any>;

export const TENDER_SHIELD_PRIVATE_STATE_ID = 'tendershield-private-state';

// DApp Connector API versions the app is compatible with. Wallets inject
// their ExtendedAPI under window.midnight.{uuid} (docs: api-reference/dapp-connector).
const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

export function getInjectedWallets(): InitialAPI[] {
  if (typeof window === 'undefined' || !window.midnight) return [];
  return Object.values(window.midnight).filter(
    (wallet): wallet is InitialAPI => !!wallet && typeof wallet === 'object' && 'apiVersion' in wallet,
  );
}

export function getFirstCompatibleWallet(): InitialAPI | undefined {
  return getInjectedWallets().find((wallet) =>
    semver.satisfies(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION, { includePrerelease: true }),
  );
}

// Midnight extensions may inject a moment after page load; poll briefly.
export async function findWallet(timeoutMs = 4000, pollMs = 150): Promise<InitialAPI | null> {
  const start = Date.now();
  for (;;) {
    const wallet = getFirstCompatibleWallet();
    if (wallet) return wallet;
    if (Date.now() - start > timeoutMs) return null;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

export async function connectWallet(
  wallet: InitialAPI,
  networkId: string,
): Promise<ConnectedAPI> {
  const connected: ConnectedAPI = await wallet.connect(networkId);
  const status = await connected.getConnectionStatus();
  if (status.status !== 'connected') {
    throw new Error('Wallet connection lost before setup finished.');
  }
  if (status.networkId !== networkId) {
    throw new Error(
      `Wrong network: wallet is on '${status.networkId}' but this app requires '${networkId}'. ` +
        `Switch the Lace wallet network and try again.`,
    );
  }
  return connected;
}

export async function getWalletServiceConfig(connected: ConnectedAPI): Promise<Configuration> {
  return connected.getConfiguration();
}

// Builds the six Midnight.js providers in the browser. The indexer, node and
// proof-server URIs come from the WALLET's configuration (user preference);
// circuit artifacts (ZKIR + prover/verifier keys) are fetched from our own
// origin where scripts/copy-web-artifacts.mjs places them under /keys and /zkir.
export async function buildProviders(
  connected: ConnectedAPI,
  options: { networkId: string; fallbackProofServerUrl: string },
): Promise<TenderShieldProviders> {
  setNetworkId(options.networkId);

  const configuration = await connected.getConfiguration();
  const shielded = await connected.getShieldedAddresses();
  const zkConfigProvider = new FetchZkConfigProvider<TenderShieldCircuits>(
    window.location.origin,
    fetch.bind(window),
  );
  const proofServerUri = configuration.proverServerUri ?? options.fallbackProofServerUrl;

  return {
    privateStateProvider: inMemoryPrivateStateProvider<string, any>(),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proofServerUri, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(
      configuration.indexerUri,
      configuration.indexerWsUri,
    ),
    walletProvider: {
      getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const received = await connected.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          'signature',
          'proof',
          'binding',
          fromHex(received.tx),
        );
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await connected.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };
}

export interface DeployTenderArgs {
  tenderId: Uint8Array;
  minTurnover: bigint;
}

export async function deployTender(
  providers: TenderShieldProviders,
  args: DeployTenderArgs,
): Promise<string> {
  const deployed = await deployContract<TenderShieldContract>(providers, {
    compiledContract: CompiledTenderShieldContract,
    privateStateId: TENDER_SHIELD_PRIVATE_STATE_ID,
    initialPrivateState: {},
    args: [args.tenderId, args.minTurnover],
  });
  return deployed.deployTxData.public.contractAddress;
}

export interface SubmitBidArgs {
  vendorId: Uint8Array;
  annualTurnover: bigint;
  opening: Uint8Array;
}

export interface SubmitBidResult {
  txId: string;
  txHash?: string;
}

// Calls the deployed tender's submitEligibleBid circuit. vendorId and
// annualTurnover are PRIVATE inputs of the proof — callers must never render
// or log them.
export async function submitEligibleBid(
  providers: TenderShieldProviders,
  contractAddress: string,
  args: SubmitBidArgs,
): Promise<SubmitBidResult> {
  const result = await submitCallTx<TenderShieldContract, 'submitEligibleBid'>(providers, {
    compiledContract: CompiledTenderShieldContract,
    contractAddress,
    privateStateId: TENDER_SHIELD_PRIVATE_STATE_ID,
    circuitId: 'submitEligibleBid',
    args: [args.vendorId, args.annualTurnover, args.opening],
  });
  return { txId: result.public.txId, txHash: result.public.txHash };
}

export async function closeTender(
  providers: TenderShieldProviders,
  contractAddress: string,
): Promise<SubmitBidResult> {
  const result = await submitCallTx<TenderShieldContract, 'closeTender'>(providers, {
    compiledContract: CompiledTenderShieldContract,
    contractAddress,
    privateStateId: TENDER_SHIELD_PRIVATE_STATE_ID,
    circuitId: 'closeTender',
    args: [],
  });
  return { txId: result.public.txId, txHash: result.public.txHash };
}