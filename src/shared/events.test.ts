import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from './events';

interface TestEvents {
  message: { text: string };
  count: number;
  empty: undefined;
}

describe('EventEmitter', () => {
  it('calls listener when event is emitted', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('message', listener);
    emitter.emit('message', { text: 'hello' });

    expect(listener).toHaveBeenCalledWith({ text: 'hello' });
  });

  it('supports multiple listeners for the same event', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    emitter.on('count', listener1);
    emitter.on('count', listener2);
    emitter.emit('count', 42);

    expect(listener1).toHaveBeenCalledWith(42);
    expect(listener2).toHaveBeenCalledWith(42);
  });

  it('does not call listener after off()', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('message', listener);
    emitter.off('message', listener);
    emitter.emit('message', { text: 'ignored' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('does not call listeners for other events', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('message', listener);
    emitter.emit('count', 5);

    expect(listener).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears specific event', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('message', listener);
    emitter.removeAllListeners('message');
    emitter.emit('message', { text: 'ignored' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('removeAllListeners with no args clears all events', () => {
    const emitter = new EventEmitter<TestEvents>();
    const msgListener = vi.fn();
    const countListener = vi.fn();

    emitter.on('message', msgListener);
    emitter.on('count', countListener);
    emitter.removeAllListeners();
    emitter.emit('message', { text: 'ignored' });
    emitter.emit('count', 0);

    expect(msgListener).not.toHaveBeenCalled();
    expect(countListener).not.toHaveBeenCalled();
  });

  it('listenerCount returns correct count', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    expect(emitter.listenerCount('message')).toBe(0);

    emitter.on('message', listener1);
    expect(emitter.listenerCount('message')).toBe(1);

    emitter.on('message', listener2);
    expect(emitter.listenerCount('message')).toBe(2);

    emitter.off('message', listener1);
    expect(emitter.listenerCount('message')).toBe(1);
  });

  it('handles emit with no listeners gracefully', () => {
    const emitter = new EventEmitter<TestEvents>();
    expect(() => emitter.emit('message', { text: 'no one listening' })).not.toThrow();
  });

  it('handles off with non-existent listener gracefully', () => {
    const emitter = new EventEmitter<TestEvents>();
    const listener = vi.fn();
    expect(() => emitter.off('message', listener)).not.toThrow();
  });
});
