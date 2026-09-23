import { useState } from 'react';
import type { UseMidnightResult } from '../hooks/useMidnight.js';
import type { LedgerResult } from '../hooks/useLedger.js';
import { TenderStatus } from '../lib/ledger.js';
import { submitEligibleBid } from '../lib/midnight.js';
import { formatTurnover, friendlyError, randomBytes32, toBytes32 } from '../lib/utils.js';
import { ErrorBanner, StatusMessage } from './StatusMessage.js';

// ── Private inputs of the eligibility proof ────────────────────────────────
// These values are consumed ONLY inside the submitEligibleBid circuit. They are
// deliberately never stored in React state and never rendered anywhere, so the
// UI cannot leak them. Only the public requirement and the resulting on-chain
// state (status → AWARDED, turnoverCommitment) are observable.
const PRIVATE_VENDOR_ID = 'tendershield-vendor-0x9f2c';

function pickPrivateTurnover(threshold: bigint): bigint {
  // Simulate the vendor's real annual turnover: strictly above the public
  // eligibility threshold. Purely a private witness of the ZK proof.
  return threshold + 2_000_000n;
}

type Stage = 'idle' | 'working' | 'success' | 'error';

export function CircuitCall({
  midnight,
  ledger,
  onTxSuccess,
}: {
  midnight: UseMidnightResult;
  ledger: LedgerResult;
  onTxSuccess: () => void;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [workingNote, setWorkingNote] = useState('Generating zero-knowledge proof…');
  const [error, setError] = useState<string | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  const state = ledger.state;
  const connected = midnight.walletState === 'connected' && !!midnight.providers;
  const isOpen = state?.status === TenderStatus.OPEN;
  const canProve = connected && !!midnight.contractAddress && isOpen && stage !== 'working';

  const runProof = async () => {
    if (!midnight.providers || !midnight.contractAddress || !state) return;
    setStage('working');
    setError(null);
    setWorkingNote('Generating zero-knowledge proof…');
    try {
      // PRIVATE inputs — used only for the circuit, never displayed.
      const vendorId = toBytes32(PRIVATE_VENDOR_ID);
      const annualTurnover = pickPrivateTurnover(state.minTurnover);
      const opening = randomBytes32();

      const result = await submitEligibleBid(midnight.providers, midnight.contractAddress, {
        vendorId,
        annualTurnover,
        opening,
      });
      setLastTxId(result.txId);
      setStage('success');
      onTxSuccess();
    } catch (err) {
      setError(friendlyError(err));
      setStage('error');
    }
  };

  return (
    <section className="ts-card">
      <h2>Eligibility Proof</h2>

      {!midnight.contractAddress ? (
        <StatusMessage tone="muted">
          Configure or deploy a TenderShield contract first (below) to call the
          <code> submitEligibleBid </code> circuit.
        </StatusMessage>
      ) : (
        <>
          {state ? (
            <p className="ts-requirement">
              Eligibility requirement (public):{' '}
              <strong>annual turnover ≥ ₹{formatTurnover(state.minTurnover)}</strong>
            </p>
          ) : (
            <StatusMessage tone="muted">Loading public tender parameters…</StatusMessage>
          )}

          {connected && !isOpen && state && (
            <StatusMessage tone="muted">
              This tender is {state.status === TenderStatus.AWARDED ? 'already AWARDED' : 'CLOSED'} —
              <code> submitEligibleBid </code> can run once per tender. Deploy a fresh TenderShield
              below to run the demo again.
            </StatusMessage>
          )}

          {!connected && (
            <StatusMessage tone="muted">
              Connect the Lace wallet to prove eligibility and submit the bid transaction.
            </StatusMessage>
          )}

          {!connected && !midnight.providers && (
            <StatusMessage tone="info">
              After connecting, the proof runs through your wallet's proof server and your public
              address funds the transaction fees (tDUST/tNIGHT).
            </StatusMessage>
          )}

          {connected && isOpen && (
            <button
              type="button"
              className="ts-btn ts-btn-primary ts-btn-prove"
              onClick={() => void runProof()}
              disabled={!canProve}
            >
              {stage === 'working' ? workingNote : 'Prove Eligibility'}
            </button>
          )}

          {connected && isOpen && stage === 'working' && (
            <StatusMessage tone="info">
              <strong>{workingNote}</strong> This may take a minute: ZK proof → wallet balancing →
              submission to Preprod. Watch the wallet popup.
            </StatusMessage>
          )}

          {stage === 'success' && (
            <div className="ts-result">
              <StatusMessage tone="success">
                ✓ Eligibility proved without revealing your private input.
              </StatusMessage>
              <p>
                Transaction:{' '}
                <code title={lastTxId ?? ''}>{lastTxId?.slice(0, 24)}…</code>
              </p>
              <p>
                On-chain: the tender transitions to <strong>AWARDED</strong> and a{' '}
                <strong>commitment</strong> is recorded — your turnover and identity stay private.
              </p>
            </div>
          )}

          {stage === 'error' && error && (
            <ErrorBanner message={error} onDismiss={() => setStage('idle')} />
          )}

          <div className="ts-privacy-note">
            <h3>Privacy by design</h3>
            <ul>
              <li>
                <span className="ts-pill ts-pill-private">PRIVATE</span> vendor identity, annual
                turnover, commitment nonce — never displayed, never logged.
              </li>
              <li>
                <span className="ts-pill ts-pill-public">PUBLIC</span> tender ID, eligibility
                requirement, resulting status and commitment.
              </li>
              <li>
                <span className="ts-pill ts-pill-proof">PROVED</span> your turnover meets the
                requirement — without revealing the number.
              </li>
            </ul>
          </div>
        </>
      )}
    </section>
  );
}