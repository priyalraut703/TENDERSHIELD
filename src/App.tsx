import { useCallback, useState } from 'react';
import { CircuitCall } from './components/CircuitCall.js';
import { ErrorBanner } from './components/StatusMessage.js';
import { LedgerPanel } from './components/LedgerPanel.js';
import { WalletConnect } from './components/WalletConnect.js';
import { useLedger } from './hooks/useLedger.js';
import {
  CONFIGURED_CONTRACT,
  useMidnight,
} from './hooks/useMidnight.js';
import { isHexContractAddress, truncateAddress } from './lib/utils.js';

const DEFAULT_MIN_TURNOVER = 5_000_000n;

export default function App() {
  const midnight = useMidnight();
  const [refreshKey, setRefreshKey] = useState(0);
  const [joinInput, setJoinInput] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ledger = useLedger(midnight.contractAddress, midnight.indexerUrl, refreshKey);

  const handleDeploy = useCallback(async () => {
    if (!midnight.providers) return;
    setDeploying(true);
    setDeployError(null);
    try {
      await midnight.deployFresh(DEFAULT_MIN_TURNOVER);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeploying(false);
    }
  }, [midnight]);

  const handleJoin = useCallback(() => {
    const valid = midnight.setContractAddress(joinInput.trim());
    if (valid) {
      setJoinInput('');
      setRefreshKey((k) => k + 1);
    }
  }, [joinInput, midnight]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(midnight.contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — nothing to do
    }
  }, [midnight.contractAddress]);

  return (
    <div className="ts-app">
      <header className="ts-header">
        <div className="ts-header-inner">
          <div className="ts-brand">
            <span className="ts-shield">TS</span>
            <div>
              <h1>TenderShield</h1>
              <p>Private bids. Verifiable trust.</p>
            </div>
          </div>
          <span className="ts-network-badge">{midnight.networkId}</span>
        </div>
      </header>

      <main className="ts-main">
        {(midnight.error || deployError) && <ErrorBanner message={midnight.error ?? deployError!} onDismiss={midnight.clearError} />}

        <section className="ts-hero">
          <p>
            TenderShield runs a <strong>privacy-preserving tender</strong> on the Midnight Network. A
            vendor proves it meets an eligibility requirement <em>inside a zero-knowledge circuit</em> —
            the real figures never reach the chain and are never shown by this app.
          </p>
        </section>

        <div className="ts-grid">
          <WalletConnect midnight={midnight} />
          <LedgerPanel ledger={ledger} />
        </div>

        <CircuitCall midnight={midnight} ledger={ledger} onTxSuccess={() => setRefreshKey((k) => k + 1)} />

        <section className="ts-card">
          <h2>Tender</h2>
          {CONFIGURED_CONTRACT ? (
            <p className="ts-muted">Using the configured Preprod contract address.</p>
          ) : null}
          {midnight.contractAddress ? (
            <div className="ts-contract-row">
              <code title={midnight.contractAddress}>{truncateAddress(midnight.contractAddress, 20, 10)}</code>
              <button type="button" className="ts-btn ts-btn-ghost" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <StatusMessageMuted />
          )}

          <div className="ts-contract-actions">
            <div className="ts-join">
              <input
                type="text"
                placeholder="Tender contract address (64 hex chars)"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
              />
              <button
                type="button"
                className="ts-btn"
                onClick={handleJoin}
                disabled={!isHexContractAddress(joinInput.trim())}
              >
                Join Tender
              </button>
            </div>

            <div className="ts-deploy">
              {midnight.walletState === 'connected' && midnight.providers ? (
                <button
                  type="button"
                  className="ts-btn"
                  onClick={() => void handleDeploy()}
                  disabled={deploying}
                >
                  {deploying ? 'Deploying fresh tender…' : 'Deploy New TenderShield'}
                </button>
              ) : (
                <span className="ts-muted">Connect the wallet to deploy a fresh tender.</span>
              )}
            </div>
          </div>
          <p className="ts-ledger-note">
            Each TenderShield tender can be <strong>AWARDED once</strong> — after a successful
            eligibility proof the tender is no longer OPEN. Deploy a fresh tender to repeat the
            demo.
          </p>
        </section>

        <section className="ts-card ts-about">
          <h2>What an observer can and cannot see</h2>
          <div className="ts-three">
            <div>
              <h3 className="ts-pill ts-pill-private">Private</h3>
              <ul>
                <li>Vendor identity (vendorId)</li>
                <li>Exact annual turnover</li>
                <li>Commitment nonce (opening)</li>
              </ul>
            </div>
            <div>
              <h3 className="ts-pill ts-pill-public">Public / observable</h3>
              <ul>
                <li>Tender ID</li>
                <li>Eligibility rule (minTurnover)</li>
                <li>Status OPEN → AWARDED</li>
                <li>turnoverCommitment digest</li>
              </ul>
            </div>
            <div>
              <h3 className="ts-pill ts-pill-proof">Proved without revealing</h3>
              <ul>
                <li>annualTurnover ≥ minTurnover</li>
                <li>…while the number itself stays in the circuit</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="ts-footer">
        <p>
          TenderShield — Midnight Builder Challenge Level 2 (Waxing Crescent). Built with Compact,
          Midnight.js and the DApp Connector API.
        </p>
      </footer>
    </div>
  );
}

function StatusMessageMuted() {
  return <p className="ts-muted">No contract selected. Join a tender by address or deploy a fresh one.</p>;
}