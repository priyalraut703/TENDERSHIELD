// Minimal browser shim for 'isomorphic-ws', used by the Midnight indexer public
// data provider for its GraphQL subscriptions. The npm browser entry only ships
// a default export; provide the named `WebSocket` binding Vite/Rollup expects.
const ws: typeof WebSocket | undefined =
  typeof globalThis !== 'undefined' ? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket : undefined;

export default ws;
export { ws as WebSocket };