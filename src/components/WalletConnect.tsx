import type { UseMidnightResult } from '../hooks/useMidnight.js';
import { truncateAddress } from '../lib/utils.js';
import { StatusMessage } from './StatusMessage.js';

const LACE_INSTALL_URL =
  'https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk';

export function WalletConnect({ midnight }: { midnight: UseMidnightResult }) {
  const { walletState, walletName, address, networkId } = midnight;

  const render = () => {
    switch (walletState) {
      case 'detecting':
        return <StatusMessage tone="muted">Detecting Midnight wallet…</StatusMessage>;
      case 'no-wallet':
        return (
          <div className="ts-wallet-empty">
            <p>
              No compatible Midnight wallet detected. Install the <strong>Lace wallet for
              Midnight</strong> and refresh this page.
            </p>
            <a className="ts-btn" href={LACE_INSTALL_URL} target="_blank" rel="noopener noreferrer">
              Install Lace Wallet
            </a>
          </div>
        );
      case 'connecting':
        return (
          <StatusMessage tone="info">
            Waiting for the wallet — approve the connection in the extension.
          </StatusMessage>
        );
      case 'connected':
        return (
          <div className="ts-wallet-connected">
            <div className="ts-wallet-row">
              <span className="ts-badge ts-badge-ok">✓ Connected</span>
              <span className="ts-wallet-name">{walletName ?? 'Midnight wallet'}</span>
            </div>
            <p className="ts-wallet-address">
              Address: <code title={address}>{truncateAddress(address ?? '', 20, 10)}</code>
            </p>
            <p className="ts-wallet-network">
              Network: <strong>{networkId}</strong>
            </p>
            {midnight.proofServerBehindNote && (
              <StatusMessage tone="muted">
                The wallet did not report a proof server. Set it to{' '}
                <code>http://localhost:6300</code> in the Lace wallet so circuit proofs can be
                generated.
              </StatusMessage>
            )}
            <button type="button" className="ts-btn ts-btn-ghost" onClick={midnight.disconnect}>
              Disconnect
            </button>
          </div>
        );
      case 'error':
        return (
          <div className="ts-wallet-error">
            <StatusMessage tone="error">{midnight.error}</StatusMessage>
            <button type="button" className="ts-btn" onClick={midnight.connect}>
              Try again
            </button>
          </div>
        );
      default: // 'ready'
        return (
          <StatusMessage tone="muted">{walletName ?? 'Midnight'} wallet detected.</StatusMessage>
        );
    }
  };

  return (
    <section className="ts-card ts-wallet">
      <h2>Wallet</h2>
      {walletState === 'ready' && (
        <button type="button" className="ts-btn ts-btn-primary" onClick={midnight.connect}>
          Connect Lace Wallet
        </button>
      )}
      {render()}
    </section>
  );
}