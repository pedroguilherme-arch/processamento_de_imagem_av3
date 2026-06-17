import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreManager } from './ScoreManager';

// ─────────────────────────────────────────────────────────────────────────────
// ScoreManager — pontuação, combo e multiplicadores
// ─────────────────────────────────────────────────────────────────────────────

describe('ScoreManager — pontuação básica', () => {
  let sm: ScoreManager;

  beforeEach(() => {
    sm = new ScoreManager();
  });

  it('começa com score 0 e combo 0', () => {
    expect(sm.score).toBe(0);
    expect(sm.combo).toBe(0);
    expect(sm.highScore).toBe(0);
    expect(sm.totalHits).toBe(0);
  });

  it('addPoints adiciona pontos ao score', () => {
    sm.addPoints(100, 1000);
    expect(sm.score).toBe(100);
  });

  it('addPoints com 0 pontos não altera o score', () => {
    sm.addPoints(0, 1000);
    expect(sm.score).toBe(0);
  });

  it('addPoints com hitCount negativo não altera o score', () => {
    sm.addPoints(100, 1000, -1);
    expect(sm.score).toBe(0);
  });

  it('acumula pontos de múltiplos disparos', () => {
    sm.addPoints(100, 1000);
    sm.addPoints(200, 1500);
    expect(sm.score).toBeGreaterThanOrEqual(300);
  });
});

describe('ScoreManager — high-score', () => {
  let sm: ScoreManager;

  beforeEach(() => {
    sm = new ScoreManager();
  });

  it('highScore é atualizado quando score supera o anterior', () => {
    sm.addPoints(500, 1000);
    expect(sm.highScore).toBe(500);
    sm.addPoints(300, 1500);
    expect(sm.highScore).toBeGreaterThanOrEqual(500);
  });

  it('reset não zera o highScore', () => {
    sm.addPoints(500, 1000);
    const highScore = sm.highScore;
    sm.reset();
    expect(sm.highScore).toBe(highScore);
  });

  it('reset zera score, combo e totalHits', () => {
    sm.addPoints(100, 1000, 2);
    sm.reset();
    expect(sm.score).toBe(0);
    expect(sm.combo).toBe(0);
    expect(sm.totalHits).toBe(0);
  });
});

describe('ScoreManager — sistema de combo', () => {
  let sm: ScoreManager;

  beforeEach(() => {
    sm = new ScoreManager();
  });

  it('combo aumenta a cada hit dentro da janela de tempo', () => {
    sm.addPoints(100, 1000, 1);
    expect(sm.combo).toBe(1);
    sm.addPoints(100, 1500, 1);
    expect(sm.combo).toBe(2);
    sm.addPoints(100, 2000, 1);
    expect(sm.combo).toBe(3);
  });

  it('multiplicador de combo sobe a cada 3 hits', () => {
    // combo 0..2 → ×1
    sm.addPoints(100, 1000, 1);
    sm.addPoints(100, 1100, 1);
    expect(sm.comboMultiplier).toBe(1);

    // combo 3 → ×2
    sm.addPoints(100, 1200, 1);
    expect(sm.combo).toBe(3);
    expect(sm.comboMultiplier).toBe(2);

    // combo 6 → ×3
    sm.addPoints(100, 1300, 3);
    expect(sm.combo).toBe(6);
    expect(sm.comboMultiplier).toBe(3);
  });

  it('combo reseta quando o tempo entre hits é maior que COMBO_WINDOW', () => {
    sm.addPoints(100, 1000, 3); // combo = 3
    expect(sm.combo).toBe(3);

    // 5 segundos depois (> 3s de COMBO_WINDOW)
    sm.addPoints(100, 6000, 1);
    // Combo deve ter sido resetado para 0 e então +1
    expect(sm.combo).toBe(1);
  });

  it('update expira combo passado o COMBO_WINDOW sem novo hit', () => {
    sm.addPoints(100, 1000, 2); // combo = 2, timestamp = 1000
    expect(sm.combo).toBe(2);

    // Update em t=5000 (4s depois, > 3s de janela)
    sm.update(5000);
    expect(sm.combo).toBe(0);
  });

  it('update não expira combo dentro da janela de tempo', () => {
    sm.addPoints(100, 1000, 2); // combo = 2, timestamp = 1000
    sm.update(2000); // apenas 1s depois
    expect(sm.combo).toBe(2);
  });

  it('pontos com combo×2 são o dobro dos pontos base', () => {
    // Para ter multiplicador ×2 precisamos de combo >= 3
    // Adicionamos 3 hits com 0 pontos para subir o combo sem pontuar
    sm.addPoints(1, 1000, 3); // combo = 3, mult = 2, score = 2 (1 * mult=2? não, mult calculado após)

    // Na realidade: addPoints chama this.comboMultiplier APÓS incrementar combo
    // combo era 0, vira 3 → mult = floor(3/3)+1 = 2
    // pontos = 1 * 2 = 2
    expect(sm.comboMultiplier).toBe(2);

    const scoreBefore = sm.score;
    sm.addPoints(100, 1100, 1); // mult ainda = 2 → +200
    expect(sm.score - scoreBefore).toBe(200);
  });

  it('acertar múltiplos alvos de uma vez incrementa combo pelo count', () => {
    sm.addPoints(300, 1000, 3); // 3 alvos de uma vez
    expect(sm.combo).toBe(3);
    expect(sm.totalHits).toBe(3);
  });
});

describe('ScoreManager — multiplicador de pontos em ação', () => {
  it('com combo × 1, 100 pts = 100 pts', () => {
    const sm = new ScoreManager();
    sm.addPoints(100, 1000, 1);
    expect(sm.score).toBe(100);
    expect(sm.comboMultiplier).toBe(1);
  });

  it('com combo × 2 (combo=3), 100 pts = 200 pts', () => {
    const sm = new ScoreManager();
    // Criamos combo = 3 com 3 chamadas de 1 hit cada (dentro da janela de tempo)
    sm.addPoints(1, 100, 1); // combo = 1, mult = 1
    sm.addPoints(1, 200, 1); // combo = 2, mult = 1
    sm.addPoints(1, 300, 1); // combo = 3, mult = 2

    // Agora comboMultiplier = 2
    expect(sm.comboMultiplier).toBe(2);

    const scoreBefore = sm.score;
    sm.addPoints(100, 400, 1); // 100 * 2 = 200
    expect(sm.score - scoreBefore).toBe(200);
  });

  it('combo cresce continuamente sem expirar', () => {
    const sm = new ScoreManager();
    const window = 3000;

    // 9 hits em 100ms de intervalo → combo = 9, mult = 4
    for (let i = 0; i < 9; i++) {
      sm.addPoints(10, i * 100, 1);
    }

    expect(sm.combo).toBe(9);
    expect(sm.comboMultiplier).toBe(4); // floor(9/3)+1 = 4
  });
});
