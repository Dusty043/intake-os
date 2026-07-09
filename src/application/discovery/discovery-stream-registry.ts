// Bridges the synchronous POST /discovery/:id/message pipeline to a separately
// subscribed SSE stream. The orchestrator publishes stage events as it works;
// zero or more listeners (SSE connections) receive them, keyed by session ID.
//
// ponytail: in-memory Map, single-process only — fine for this app's current
// single-instance deployment. If horizontally scaled later, swap the Map for a
// shared pub/sub (Redis) behind the same subscribe/publish/hasSubscribers API.

export type DiscoveryStreamEvent =
  | { type: "stage-start"; stage: string }
  | { type: "token"; stage: string; text: string }
  | { type: "stage-end"; stage: string }
  | { type: "error"; stage: string; message: string };

export type DiscoveryStreamListener = (event: DiscoveryStreamEvent) => void;

export class DiscoveryStreamRegistry {
  private readonly listenersBySession = new Map<string, Set<DiscoveryStreamListener>>();

  subscribe(sessionId: string, listener: DiscoveryStreamListener): () => void {
    let listeners = this.listenersBySession.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      this.listenersBySession.set(sessionId, listeners);
    }
    listeners.add(listener);
    return () => this.unsubscribe(sessionId, listener);
  }

  publish(sessionId: string, event: DiscoveryStreamEvent): void {
    const listeners = this.listenersBySession.get(sessionId);
    if (!listeners) return; // no subscriber — publishing is a safe no-op
    for (const listener of listeners) listener(event);
  }

  hasSubscribers(sessionId: string): boolean {
    return (this.listenersBySession.get(sessionId)?.size ?? 0) > 0;
  }

  private unsubscribe(sessionId: string, listener: DiscoveryStreamListener): void {
    const listeners = this.listenersBySession.get(sessionId);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) this.listenersBySession.delete(sessionId);
  }
}
