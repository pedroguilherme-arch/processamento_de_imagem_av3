import { describe, it, expect } from 'vitest';
import { Target } from './Target';

// ─────────────────────────────────────────────────────────────────────────────
// Target — movimento, ricochete e estado
// ─────────────────────────────────────────────────────────────────────────────

describe('Target — movimento e ricochete', () => {
  const W = 800;
  const H = 600;

  it('se move na direção da velocidade', () => {
    const t = new Target(1, { x: 400, y: 300 }, { x: 100, y: 0 }, 20, 100, 0);
    t.update(1000, W, H); // 1 segundo
    expect(t.position.x).toBeCloseTo(500);
    expect(t.position.y).toBeCloseTo(300);
  });

  it('se move em diagonal corretamente', () => {
    const t = new Target(2, { x: 400, y: 300 }, { x: 60, y: -80 }, 20, 100, 0);
    t.update(500, W, H); // 0.5 segundo
    expect(t.position.x).toBeCloseTo(430);
    expect(t.position.y).toBeCloseTo(260);
  });

  it('ricochete na borda direita inverte velocidade X', () => {
    const t = new Target(3, { x: 790, y: 300 }, { x: 200, y: 0 }, 20, 100, 0);
    t.update(100, W, H);
    expect(t.velocity.x).toBeLessThan(0); // inverteu
    expect(t.position.x).toBeLessThanOrEqual(W - 20);
  });

  it('ricochete na borda esquerda inverte velocidade X', () => {
    const t = new Target(4, { x: 10, y: 300 }, { x: -200, y: 0 }, 20, 100, 0);
    t.update(100, W, H);
    expect(t.velocity.x).toBeGreaterThan(0);
    expect(t.position.x).toBeGreaterThanOrEqual(20);
  });

  it('ricochete na borda superior inverte velocidade Y', () => {
    const t = new Target(5, { x: 400, y: 10 }, { x: 0, y: -200 }, 20, 100, 0);
    t.update(100, W, H);
    expect(t.velocity.y).toBeGreaterThan(0);
    expect(t.position.y).toBeGreaterThanOrEqual(20);
  });

  it('ricochete na borda inferior inverte velocidade Y', () => {
    const t = new Target(6, { x: 400, y: 590 }, { x: 0, y: 200 }, 20, 100, 0);
    t.update(100, W, H);
    expect(t.velocity.y).toBeLessThan(0);
    expect(t.position.y).toBeLessThanOrEqual(H - 20);
  });
});

describe('Target — estado de vida e hit', () => {
  it('começa como alive', () => {
    const t = new Target(1, { x: 400, y: 300 }, { x: 0, y: 0 }, 20, 100, 0);
    expect(t.state).toBe('alive');
    expect(t.isAlive).toBe(true);
    expect(t.isDead).toBe(false);
  });

  it('hit() muda para estado hit', () => {
    const t = new Target(2, { x: 400, y: 300 }, { x: 0, y: 0 }, 20, 100, 0);
    t.hit();
    expect(t.state).toBe('hit');
    expect(t.isAlive).toBe(false);
  });

  it('hit() repetido não faz nada depois do primeiro', () => {
    const t = new Target(3, { x: 400, y: 300 }, { x: 0, y: 0 }, 20, 100, 0);
    t.hit();
    t.hit();
    expect(t.state).toBe('hit'); // não muda de novo
    expect(t.hitAnimProgress).toBeCloseTo(0);
  });

  it('animação de hit avança com update e vira dead ao final', () => {
    const t = new Target(4, { x: 400, y: 300 }, { x: 0, y: 0 }, 20, 100, 0);
    t.hit();

    // Antes de completar: ainda hit
    t.update(200, 800, 600);
    expect(t.state).toBe('hit');
    expect(t.hitAnimProgress).toBeGreaterThan(0);
    expect(t.hitAnimProgress).toBeLessThan(1);

    // Depois de completar a animação (600ms total): dead
    t.update(500, 800, 600);
    expect(t.state).toBe('dead');
    expect(t.isDead).toBe(true);
  });

  it('alvo morto não se move mais', () => {
    const t = new Target(5, { x: 400, y: 300 }, { x: 100, y: 0 }, 20, 100, 0);
    t.hit();
    t.update(700, 800, 600); // completa animação (> 600ms)
    expect(t.isDead).toBe(true);
    const xBefore = t.position.x;
    t.update(1000, 800, 600);
    expect(t.position.x).toBe(xBefore); // não moveu
  });

  it('alvo hit não se move durante animação', () => {
    const t = new Target(6, { x: 400, y: 300 }, { x: 200, y: 0 }, 20, 100, 0);
    t.hit();
    const xBefore = t.position.x;
    t.update(100, 800, 600); // ainda em animação
    expect(t.position.x).toBe(xBefore);
  });
});

describe('Target — pontuação', () => {
  it('getPoints retorna pontuação base quando velocidade é baixa', () => {
    // speed=0 → speedBonus=0 → points = basePoints
    const t = new Target(1, { x: 0, y: 0 }, { x: 0, y: 0 }, 20, 100, 0);
    expect(t.getPoints()).toBe(100);
  });

  it('getPoints inclui bônus para alvos rápidos', () => {
    // speed=300 px/s → speedBonus=3 → +30 pontos
    const t = new Target(2, { x: 0, y: 0 }, { x: 300, y: 0 }, 20, 100, 0);
    expect(t.getPoints()).toBeGreaterThan(100);
  });

  it('alvos mais rápidos valem mais pontos', () => {
    const slow = new Target(3, { x: 0, y: 0 }, { x: 80, y: 0 }, 20, 100, 0);
    const fast = new Target(4, { x: 0, y: 0 }, { x: 300, y: 0 }, 20, 100, 0);
    expect(fast.getPoints()).toBeGreaterThan(slow.getPoints());
  });
});
