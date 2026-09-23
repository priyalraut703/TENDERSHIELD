import type { LedgerResult } from '../hooks/useLedger.js';
import { STATUS_LABEL, TenderStatus } from '../lib/ledger.js';
import { formatTurnover, isEmptyCommitment, truncateAddress } from '../lib/utils.js';
import { StatusMessage } from './StatusMessage.js';

export function LedgerPanel({ ledger }: { ledger: LedgerResult }) {
  const { state, loading, error } = ledger;

  if (!state && loading) {
    return (
      <section className="ts-card">
        <h2>Contract Ledger</h2>
        <StatusMessage tone="muted">Reading public state from the indexer…</StatusMessage>
      </section>
    );
  }

  if (error && !state) {
    return (
      <section className="ts-card">
        <h2>Contract Ledger</h2>
        <StatusMessage tone="error">{error}</StatusMessage>
      </section>
    );
  }

  if (!state) {
    return (
      <section className="ts-card">
        <h2>Contract Ledger</h2>
        <StatusMessage tone="muted">
          No contract configured yet. Provide an address or deploy a fresh TenderShield.
        </StatusMessage>
      </section>
    );
  }

  const statusOpen = state.status === TenderStatus.OPEN;
  const awarded = state.status === TenderStatus.AWARDED;
  const commitmentRecorded = !isEmptyCommitment(state.turnoverCommitment);

  return (
    <section className="ts-card">
      <h2>Contract Ledger</h2>
      <dl className="ts-ledger">
        <div>
          <dt>Contract</dt>
          <dd>
            <code title={state.contractAddress}>{truncateAddress(state.contractAddress)}</code>
          </dd>
        </div>
        <div>
          <dt>Tender ID</dt>
          <dd>
            <code>{state.tenderIdHex.slice(0, 16)}…</code>
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`ts-badge ${statusOpen ? 'ts-badge-open' : awarded ? 'ts-badge-awarded' : 'ts-badge-closed'}`}>
              {STATUS_LABEL[state.status]}
            </span>
          </dd>
        </div>
        <div>
          <dt>Eligibility</dt>
          <dd>Annual turnover ≥ ₹{formatTurnover(state.minTurnover)}</dd>
        </div>
        <div>
          <dt>Turnover commitment</dt>
          <dd>
            {commitmentRecorded ? <code>{state.commitmentHex}</code> : <em>empty (no bid yet)</em>}
          </dd>
        </div>
      </dl>
      <p className="ts-ledger-note">
        Everything above is <strong>public</strong> on-chain state. The vendor's private figures are
        not part of it.
      </p>
    </section>
  );
}