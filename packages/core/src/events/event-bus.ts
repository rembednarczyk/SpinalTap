type Handler<T> = (payload: T) => void;

/**
 * Minimal typed, synchronous event bus. Handlers run in subscription order within
 * the emitting call, which keeps a simulation step deterministic.
 */
export class EventBus<Events extends { [K in keyof Events]: unknown }> {
  private readonly handlers = new Map<keyof Events, Handler<never>[]>();

  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(type, list);
    return () => {
      const current = this.handlers.get(type);
      if (!current) return;
      const idx = current.indexOf(handler as Handler<never>);
      if (idx >= 0) current.splice(idx, 1);
    };
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const list = this.handlers.get(type);
    if (!list) return;
    for (const handler of [...list]) (handler as Handler<Events[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
