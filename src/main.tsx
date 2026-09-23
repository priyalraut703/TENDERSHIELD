// Buffer polyfill: Midnight.js / onchain-runtime wallet SDKs rely on Node's
// Buffer globals. Required before importing the app modules.
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './App.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found — check index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);