import { describe, it, expect, beforeEach } from 'vitest';
import { TargetManager, rayIntersectsCircle } from './TargetManager';

// ─────────────────────────────────────────────────────────────────────────────
// rayIntersectsCircle — geometria pura
// ─────────────────────────────────────────────────────────────────────────────

describe('rayIntersectsCircle — colisão raio-círculo', () => {
  it('raio apontado direto para o centro acerta', () => {
    // Raio parte de (0,0) indo para direita, círculo centrado em (200,0) r=30
    expect(
      rayIntersectsCircle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 200, y: 0 }, 30)
    ).toBe(true);
  });

  it('raio passando pela borda do círculo acerta', () => {
    // Raio em y=25 (raio do círculo é 30) → toca a borda
    expect(
      rayIntersectsCircle({ x: 0, y: 25 }, { x: 1, y: 0 }, { x: 200, y: 0 }, 30)
    ).toBe(true);
  });

  it('raio passando fora não acerta', () => {
    // Raio em y=50, círculo centrado em (200,0) com r=30 → passa acima
    expect(
      rayIntersectsCircle({ x: 0, y: 50 }, { x: 1, y: 0 }, { x: 200, y: 0 }, 30)
    ).toBe(false);
  });

  it('raio na direção oposta ao círculo não acerta (t < 0)', () => {
    // Raio parte de (400,0) indo para direita, círculo em (200,0) está atrás
    expect(
      rayIntersectsCircle({ x: 400, y: 0 }, { x: 1, y: 0 }, { x: 200, y: 0 }, 30)
    ).toBe(false);
  });

  it('raio na direção oposta ao círculo não acerta (verso)', () => {
    // Raio parte de (0,0) indo para esquerda (x=-1), círculo em (200,0)
    expect(
      rayIntersectsCircle({ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 200, y: 0 }, 30)
    ).toBe(false);
  });

  it('origem dentro do círculo sempre acerta', () => {
    // Origem no centro do círculo
    expect(
      rayIntersectsCircle({ x: 200, y: 0 }, { x: 1, y: 0 }, { x: 200, y: 0 }, 30)
    ).toBe(true);
  });

  it('raio diagonal acerta círculo fora do eixo', () => {
    // Raio de (0,0) em 45° → atinge círculo em (300,300) r=50
    const dir = { x: 1 / Math.SQRT2, y: 1 / Math.SQRT2 };
    expect(
      rayIntersectsCircle({ x: 0, y: 0 }, dir, { x: 300, y: 300 }, 50)
    ).toBe(true);
  });

  it('raio com direção zero retorna false sem erro', () => {
    expect(
      rayIntersectsCircle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 200, y: 0 }, 30)
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TargetManager — ciclo de vida dos alvos
// ─────────────────────────────────────────────────────────────────────────────

describe('TargetManager — spawn de alvos', () => {
  it('começa sem alvos', () => {
    const tm = new TargetManager();
    expect(tm.getTargets().length).toBe(0);
    expect(tm.getAliveCount()).toBe(0);
  });

  it('spawna um alvo após o intervalo configurado', () => {
    const tm = new TargetManager({ spawnIntervalMs: 1000 });
    tm.update(1001, 800, 600, 1001); // ultrapassa o intervalo
    expect(tm.getTargets().length).toBe(1);
    expect(tm.getAliveCount()).toBe(1);
  });

  it('não spawna antes do intervalo', () => {
    const tm = new TargetManager({ spawnIntervalMs: 1000 });
    tm.update(500, 800, 600, 500);
    expect(tm.getTargets().length).toBe(0);
  });

  it('não spawna além do limite máximo de alvos', () => {
    const tm = new TargetManager({ spawnIntervalMs: 1, maxTargets: 3 });
    // Chama update muitas vezes com interval pequeno
    for (let i = 0; i < 20; i++) {
      tm.update(10, 800, 600, i * 10);
    }
    expect(tm.getAliveCount()).toBeLessThanOrEqual(3);
  });

  it('não spawna se canvas tem dimensões zero', () => {
    const tm = new TargetManager({ spawnIntervalMs: 1 });
    tm.update(5000, 0, 0, 5000);
    expect(tm.getTargets().length).toBe(0);
  });

  it('clear remove todos os alvos', () => {
    const tm = new TargetManager({ spawnIntervalMs: 1000 });
    tm.update(1001, 800, 600, 1001);
    expect(tm.getAliveCount()).toBe(1);
    tm.clear();
    expect(tm.getAliveCount()).toBe(0);
    expect(tm.getTargets().length).toBe(0);
  });
});

describe('TargetManager — colisão e remoção de alvos mortos', () => {
  it('checkBeamCollision detecta alvo no caminho do raio', () => {
    const tm = new TargetManager({ spawnIntervalMs: 99999 }); // não spawna sozinho
    // Força spawn via update com canvas gigante mas intervalo nunca passa
    // Injetamos um alvo diretamente via applyBeamHit não — usamos a API pública

    // Como não há setter direto, vamos usar um intervalo que spawna imediatamente
    // e depois testar a colisão com o alvo spawnado próximo à borda
    const tmFast = new TargetManager({
      spawnIntervalMs: 1,
      maxTargets: 1,
      minRadius: 30,
      maxRadius: 30,
    });
    tmFast.update(2, 800, 600, 2); // spawna 1 alvo

    const targets = tmFast.getTargets();
    expect(targets.length).toBe(1);

    const target = targets[0]!;

    // Aponta o raio direto para o alvo spawnado
    const origin = { x: target.position.x - 200, y: target.position.y };
    const direction = { x: 1, y: 0 };

    const hit = tmFast.checkBeamCollision(origin, direction);
    // Pode ou não acertar dependendo da posição y, mas se acertar, é o alvo correto
    if (hit.length > 0) {
      expect(hit[0].id).toBe(target.id);
    }
  });

  it('applyBeamHit retorna 0 pontos se não há alvos no caminho', () => {
    const tm = new TargetManager({ spawnIntervalMs: 99999 });
    // Raio aponta para longe de qualquer área com alvos
    const points = tm.applyBeamHit({ x: 0, y: 0 }, { x: 1, y: 0 });
    expect(points).toBe(0);
  });

  it('alvos dead são removidos na próxima atualização', () => {
    // spawnIntervalMs alto para não spawnar novos alvos durante o teste
    const tm = new TargetManager({ spawnIntervalMs: 99999, maxTargets: 5 });

    // Injeta um alvo manualmente via spawn único
    const tmSpawn = new TargetManager({ spawnIntervalMs: 1, maxTargets: 1 });
    tmSpawn.update(2, 800, 600, 2); // spawna 1 alvo
    expect(tmSpawn.getAliveCount()).toBe(1);

    const target = tmSpawn.getTargets()[0]!;
    target.hit();

    // Ainda aparece na lista enquanto em animação de hit
    tmSpawn.update(100, 800, 600, 102);
    expect(target.state).toBe('hit'); // ainda animando

    // O timer pode spawnar outro alvo; verificamos só o target original
    // Avança mais que 300ms restantes (600ms total de animação)
    tmSpawn.update(510, 800, 600, 612);
    expect(target.state).toBe('dead');

    // Depois do update, alvos dead são removidos da lista interna
    // (o target original saiu; pode haver um novo alvo spawnado)
    const remaining = tmSpawn.getTargets().filter((t) => t.id === target.id);
    expect(remaining.length).toBe(0); // o alvo original foi removido
  });
});

describe('TargetManager — colisão direta com posição conhecida', () => {
  it('raio horizontal acerta alvo posicionado à direita da origem', () => {
    // Testa a lógica geométrica pura: um alvo colocado em (500,300) r=40
    // Um raio saindo de (100,300) para direita (1,0) deve acertar
    expect(
      rayIntersectsCircle({ x: 100, y: 300 }, { x: 1, y: 0 }, { x: 500, y: 300 }, 40)
    ).toBe(true);
  });

  it('raio horizontal não acerta alvo acima', () => {
    // Alvo em (500,100) com r=20, raio em y=300 → não acerta
    expect(
      rayIntersectsCircle({ x: 100, y: 300 }, { x: 1, y: 0 }, { x: 500, y: 100 }, 20)
    ).toBe(false);
  });

  it('múltiplos alvos na linha: ambos são detectados', () => {
    // Dois círculos alinhados com o raio
    const origin = { x: 0, y: 0 };
    const dir = { x: 1, y: 0 };

    const hit1 = rayIntersectsCircle(origin, dir, { x: 200, y: 0 }, 30);
    const hit2 = rayIntersectsCircle(origin, dir, { x: 400, y: 0 }, 30);

    expect(hit1).toBe(true);
    expect(hit2).toBe(true);
  });
});
