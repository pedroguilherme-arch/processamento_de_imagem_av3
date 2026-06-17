// shared/events.ts - EventEmitter tipado genérico

/**
 * Mapa de eventos: chave é o nome do evento, valor é o tipo do payload.
 */
export type EventMap = { [key: string]: unknown };

/**
 * Tipo de função listener para um evento específico.
 */
export type Listener<T> = (data: T) => void;

/**
 * EventEmitter genérico com tipagem forte.
 * Permite comunicação desacoplada entre módulos via eventos tipados.
 *
 * @example
 * ```typescript
 * interface MyEvents {
 *   stateChange: { previous: string; current: string };
 *   error: { message: string };
 * }
 *
 * const emitter = new EventEmitter<MyEvents>();
 * emitter.on('stateChange', (data) => console.log(data.current));
 * emitter.emit('stateChange', { previous: 'idle', current: 'charging' });
 * ```
 */
export class EventEmitter<T extends Record<string, any> = EventMap> {
  private listeners = new Map<keyof T, Set<Listener<unknown>>>();

  /**
   * Registra um listener para um evento específico.
   */
  on<K extends keyof T>(event: K, listener: Listener<T[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>);
  }

  /**
   * Remove um listener previamente registrado.
   */
  off<K extends keyof T>(event: K, listener: Listener<T[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as Listener<unknown>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emite um evento, notificando todos os listeners registrados.
   */
  emit<K extends keyof T>(event: K, data: T[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        listener(data);
      }
    }
  }

  /**
   * Remove todos os listeners de um evento específico, ou todos se nenhum evento for especificado.
   */
  removeAllListeners<K extends keyof T>(event?: K): void {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Retorna o número de listeners registrados para um evento.
   */
  listenerCount<K extends keyof T>(event: K): number {
    const set = this.listeners.get(event);
    return set ? set.size : 0;
  }
}
