import { useCallback, useEffect, useRef, useState } from 'react';
import type { Configuration, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

import {
  buildProviders,
  connectWallet,
  deployTender,
  findWallet,
  type TenderShieldProviders,
} from '../lib/midnight.js';
import { friendlyError, isHexContractAddress } from '../lib/utils.js';

const NETWORK_ID = import.meta.env.VITE_NETWORK_ID ?? 'preprod';
export const CONFIGURED_CONTRACT = import.meta.env.VITE_TENDERSHIELD_CONTRACT_ADDRESS?.trim() ?? '';
export const DEFAULT_PROOF_SERVER =
  import.meta.env.VITE_PROOF_SERVER_URL ?? 'http://localhost:6300';
export const INDEXER_URL =
  import.meta.env.VITE_INDEXER_URL ?? 'https://indexer.preprod.midnight.network/api/v4/graphql';

export type WalletState =
  | 'detecting'
  | 'no-wallet'
  | 'ready'
  | 'connecting'
  | 'connected'
  | 'error';

const STORAGE_KEY = 'tendershield.contractAddress';

function loadStoredContract(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isHexContractAddress(stored)) return stored;
  } catch {
    // localStorage unavailable; ignore.
  }
  return '';
}

function persistContract(address: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, address);
  } catch {
    // ignore storage errors
  }
}

export interface UseMidnightResult {
  networkId: string;
  indexerUrl: string;
  walletState: WalletState;
  walletName?: string;
  address?: string;
  providers?: TenderShieldProviders;
  configuration?: Configuration;
  proofServerBehindNote: boolean;
  error?: string;
  contractAddress: string;
  setContractAddress: (address: string) => boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  deployFresh: (minTurnover: bigint) => Promise<string>;
  clearError: () => void;
}

export function useMidnight(): UseMidnightResult {
  const [walletState, setWalletState] = useState<WalletState>('detecting');
  const [walletName, setWalletName] = useState<string>();
  const [address, setAddress] = useState<string>();
  const [providers, setProviders] = useState<TenderShieldProviders>();
  const [configuration, setConfiguration] = useState<Configuration>();
  const [error, setError] = useState<string>();
  const [contractAddress, setContractAddressState] = useState<string>(() =>
    CONFIGURED_CONTRACT || loadStoredContract(),
  );

  const walletApiRef = useRef<InitialAPI | null>(null);
  const connectingRef = useRef(false);

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setError(undefined);
    setWalletState('connecting');
    try {
      const wallet = await findWallet();
      if (!wallet) {
        setWalletState('no-wallet');
        throw new Error(
          'No compatible Midnight wallet detected. Install the Lace wallet for Midnight, unlock it, and refresh the page.',
        );
      }
      walletApiRef.current = wallet;
      setWalletName(wallet.name);

      const connected = await connectWallet(wallet, NETWORK_ID);
      const config = await connected.getConfiguration();
      const { unshieldedAddress } = await connected.getUnshieldedAddress();
      const nextProviders = await buildProviders(connected, {
        networkId: NETWORK_ID,
        fallbackProofServerUrl: DEFAULT_PROOF_SERVER,
      });

      setConfiguration(config);
      setAddress(unshieldedAddress);
      setProviders(nextProviders);
      setWalletState('connected');
    } catch (err) {
      setError(friendlyError(err));
      setWalletState(walletApiRef.current ? 'error' : 'no-wallet');
    } finally {
      connectingRef.current = false;
    }
  }, []);

  const disconnect = useCallback(() => {
    walletApiRef.current = null;
    setProviders(undefined);
    setConfiguration(undefined);
    setAddress(undefined);
    setWalletState('ready');
    setError(undefined);
  }, []);

  const setContractAddress = useCallback((addr: string): boolean => {
    if (isHexContractAddress(addr)) {
      persistContract(addr);
      setContractAddressState(addr);
      setError(undefined);
      return true;
    }
    setError('Invalid contract address. A TenderShield address is 64 hexadecimal characters.');
    return false;
  }, []);

  const deployFresh = useCallback(
    async (minTurnover: bigint): Promise<string> => {
      if (!providers) throw new Error('Connect the wallet before deploying a tender.');
      setError(undefined);
      const tenderId = new Uint8Array(32);
      crypto.getRandomValues(tenderId);
      const address = await deployTender(providers, { tenderId, minTurnover });
      persistContract(address);
      setContractAddressState(address);
      return address;
    },
    [providers],
  );

  const clearError = useCallback(() => setError(undefined), []);

  // Wallet detection: a compatible extension may inject a moment after load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const wallet = await findWallet(2500);
      if (cancelled) return;
      if (wallet) {
        walletApiRef.current = wallet;
        setWalletName(wallet.name);
        setWalletState('ready');
      } else {
        setWalletState((current) => (current === 'detecting' ? 'no-wallet' : current));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    networkId: NETWORK_ID,
    indexerUrl: INDEXER_URL,
    walletState,
    walletName,
    address,
    providers,
    configuration,
    proofServerBehindNote: !configuration?.proverServerUri,
    error,
    contractAddress,
    setContractAddress,
    connect,
    disconnect,
    deployFresh,
    clearError,
  };
}