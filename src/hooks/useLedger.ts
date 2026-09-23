import { useCallback, useEffect, useState } from 'react';
import { fetchLedgerState, type TenderShieldLedgerState } from '../lib/ledger.js';

export interface LedgerResult {
  state: TenderShieldLedgerState | null;
  loading: boolean;
  error: string | null;
  lastRefresh: number;
  refresh: () => Promise<void>;
}

// Polls the PUBLIC ledger of the configured TenderShield contract from the
// indexer. No wallet connection required. `refreshKey` can be incremented to
// force an immediate refetch (e.g. after a successful circuit call).
export function useLedger(
  contractAddress: string,
  indexerUrl: string,
  refreshKey = 0,
  pollIntervalMs = 10_000,
): LedgerResult {
  const [state, setState] = useState<TenderShieldLedgerState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);

  const refresh = useCallback(async () => {
    if (!contractAddress) return;
    setLoading(true);
    try {
      const next = await fetchLedgerState(contractAddress, indexerUrl);
      setState(next);
      setError(null);
      setLastRefresh(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [contractAddress, indexerUrl]);

  useEffect(() => {
    if (!contractAddress) {
      setState(null);
      setError(null);
      return;
    }
    void refresh();
    const interval = setInterval(() => void refresh(), pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs, refreshKey]);

  return { state, loading, error, lastRefresh, refresh };
}