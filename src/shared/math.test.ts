import { describe, it, expect } from 'vitest';
import { distance2D, normalize2D, lerp, clamp, midpoint, Vec2 } from './math';

describe('distance2D', () => {
  it('returns 0 for identical points', () => {
    const p: Vec2 = { x: 3, y: 4 };
    expect(distance2D(p, p)).toBe(0);
  });

  it('calculates distance for a 3-4-5 triangle', () => {
    const a: Vec2 = { x: 0, y: 0 };
    const b: Vec2 = { x: 3, y: 4 };
    expect(distance2D(a, b)).toBe(5);
  });

  it('is symmetric', () => {
    const a: Vec2 = { x: 1, y: 2 };
    const b: Vec2 = { x: 4, y: 6 };
    expect(distance2D(a, b)).toBe(distance2D(b, a));
  });

  it('handles negative coordinates', () => {
    const a: Vec2 = { x: -1, y: -1 };
    const b: Vec2 = { x: 2, y: 3 };
    expect(distance2D(a, b)).toBe(5);
  });
});

describe('normalize2D', () => {
  it('normalizes a vector to unit length', () => {
    const v: Vec2 = { x: 3, y: 4 };
    const result = normalize2D(v);
    const length = Math.sqrt(result.x * result.x + result.y * result.y);
    expect(length).toBeCloseTo(1);
  });

  it('preserves direction', () => {
    const v: Vec2 = { x: 3, y: 4 };
    const result = normalize2D(v);
    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.8);
  });

  it('returns zero vector for zero input', () => {
    const v: Vec2 = { x: 0, y: 0 };
    const result = normalize2D(v);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('handles unit axis vectors', () => {
    const v: Vec2 = { x: 1, y: 0 };
    const result = normalize2D(v);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
  });
});

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns b when t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint when t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('handles negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });
});

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max when above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('midpoint', () => {
  it('returns the midpoint between two points', () => {
    const a: Vec2 = { x: 0, y: 0 };
    const b: Vec2 = { x: 10, y: 10 };
    const result = midpoint(a, b);
    expect(result.x).toBe(5);
    expect(result.y).toBe(5);
  });

  it('returns the same point when both inputs are identical', () => {
    const p: Vec2 = { x: 7, y: 3 };
    const result = midpoint(p, p);
    expect(result.x).toBe(7);
    expect(result.y).toBe(3);
  });

  it('handles negative coordinates', () => {
    const a: Vec2 = { x: -4, y: -2 };
    const b: Vec2 = { x: 4, y: 2 };
    const result = midpoint(a, b);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});
