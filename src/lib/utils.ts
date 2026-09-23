// Small pure helpers shared by the TenderShield browser DApp.
// These functions are intentionally free of DOM/wallet imports so they can be
// unit-tested under vitest (Node environment).

export function toBytes32(text: string): Uint8Array {
  const out = new Uint8Array(32);
  const encoded = new TextEncoder().encode(text);
  out.set(encoded.slice(0, 32));
  return out;
}

export function randomBytes32(): Uint8Array {
  const out = new Uint8Array(32);
  crypto.getRandomValues(out);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.substr(i, 2), 16);
  }
  return out;
}

export function truncateAddress(address: string, head = 14, tail = 8): string {
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

// Formats a Uint<64> turnover value for display using Indian digit grouping.
// Works directly on the bigint string to stay safe beyond Number.MAX_SAFE_INTEGER.
export function formatTurnover(value: bigint): string {
  const digits = value.toString();
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${grouped},${last3}`;
}

export function isHexContractAddress(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

// Returns true when every byte of a 32-byte commitment is zero.
export function isEmptyCommitment(commitment: Uint8Array): boolean {
  return commitment.every((b) => b === 0);
}

export function friendlyError(error: unknown): string {
  const message = extractErrorMessage(error);
  if (!message) return 'An unexpected error occurred. Check the browser console for details.';

  if (message.includes('User rejected') || /rejected/i.test(message)) {
    return 'Connection or transaction cancelled in the wallet.';
  }
  if (message.includes('Tender is not open for bids')) {
    return 'This tender is no longer OPEN. It may already be AWARDED or CLOSED — deploy a fresh TenderShield tender to run the demo again.';
  }
  if (
    message.includes('meet the minimum annual turnover') ||
    message.includes('eligibility')
  ) {
    return 'The vendor did not satisfy the eligibility requirement — the proof was rejected.';
  }
  if (
    message.includes('Failed to fetch') ||
    message.includes('Failed Proof Server') ||
    message.includes('proof server') ||
    message.includes('connect ECONNREFUSED')
  ) {
    return 'Could not reach the proof server. Check that it is running and that your wallet points to it (http://localhost:6300 by default).';
  }
  if (message.includes('mismatched verifier keys')) {
    return 'Contract version mismatch between the app and the deployed tender.';
  }
  if (message.includes('tDUST') || message.includes('Dust') || message.includes('DUST')) {
    return 'The wallet needs tDUST (and tNIGHT) to pay the transaction fee. Generate tDUST in the Lace wallet Tokens tab.';
  }
  if (message.includes('network')) {
    return `Wallet/network mismatch: ${message}`;
  }
  return message;
}

function extractErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  const failure = (error as { cause?: { failure?: { message?: string; cause?: { message?: string } }; message?: string } }).cause;
  if (failure) {
    if (failure.failure?.message) return failure.failure.message;
    if (failure.failure?.cause?.message) return failure.failure.cause.message;
    if (failure.message) return failure.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export { extractErrorMessage };