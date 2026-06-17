import { Target } from './Target';
import type { Vec2 } from '../shared/math';

export interface SpawnConfig {
  minSpeed: number;
  maxSpeed: number;
  minRadius: number;
  maxRadius: number;
  basePoints: number;
  spawnIntervalMs: number;
  maxTargets: number;
}

export const DEFAULT_SPAWN_CONFIG: SpawnConfig = {
  minSpeed: 80,
  maxSpeed: 220,
  minRadius: 28,
  maxRadius: 52,
  basePoints: 100,
  spawnIntervalMs: 2000,
  maxTargets: 8,
};

/**
 * TargetManager — gerencia o ciclo de vida de alvos.
 *
 * Responsabilidades:
 * - Spawnar alvos em intervalos regulares nas bordas da tela
 * - Atualizar posição/estado de todos os alvos a cada frame
 * - Detectar colisão de raio (feixe) com alvos
 * - Remover alvos mortos
 */
export class TargetManager {
  private targets: Target[] = [];
  private nextId = 1;
  private timeSinceLastSpawn = 0;
  private config: SpawnConfig;

  constructor(config: Partial<SpawnConfig> = {}) {
    this.config = { ...DEFAULT_SPAWN_CONFIG, ...config };
  }

  /**
   * Atualiza todos os alvos e faz spawn se o intervalo passou.
   */
  update(
    deltaTime: number,
    canvasWidth: number,
    canvasHeight: number,
    timestamp: number
  ): void {
    // Atualizar alvos existentes
    for (const target of this.targets) {
      target.update(deltaTime, canvasWidth, canvasHeight);
    }

    // Remover alvos mortos
    this.targets = this.targets.filter((t) => !t.isDead);

    // Spawnar novo alvo se o intervalo passou e há espaço
    this.timeSinceLastSpawn += deltaTime;
    if (
      this.timeSinceLastSpawn >= this.config.spawnIntervalMs &&
      this.targets.length < this.config.maxTargets &&
      canvasWidth > 0 &&
      canvasHeight > 0
    ) {
      this.spawnTarget(canvasWidth, canvasHeight, timestamp);
      this.timeSinceLastSpawn = 0;
    }
  }

  /**
   * Verifica se o feixe (raio semi-infinito) atinge algum alvo.
   * Usa interseção raio-círculo.
   *
   * @param origin   ponto de origem do feixe (pixels)
   * @param direction vetor de direção normalizado
   * @returns lista de alvos atingidos (em ordem de distância)
   */
  checkBeamCollision(origin: Vec2, direction: Vec2): Target[] {
    const hit: Target[] = [];

    for (const target of this.targets) {
      if (!target.isAlive) continue;

      if (rayIntersectsCircle(origin, direction, target.position, target.radius)) {
        hit.push(target);
      }
    }

    // Ordena por distância à origem (mais próximo primeiro)
    hit.sort((a, b) => {
      const da = distSq(origin, a.position);
      const db = distSq(origin, b.position);
      return da - db;
    });

    return hit;
  }

  /**
   * Aplica o hit nos alvos atingidos pelo feixe.
   * @returns pontos totais ganhos
   */
  applyBeamHit(origin: Vec2, direction: Vec2): number {
    const hit = this.checkBeamCollision(origin, direction);
    let points = 0;
    for (const target of hit) {
      points += target.getPoints();
      target.hit();
    }
    return points;
  }

  getTargets(): readonly Target[] {
    return this.targets;
  }

  getAliveCount(): number {
    return this.targets.filter((t) => t.isAlive).length;
  }

  /** Limpa todos os alvos (ex: ao reiniciar o jogo) */
  clear(): void {
    this.targets = [];
    this.timeSinceLastSpawn = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers privados
  // ─────────────────────────────────────────────────────────────────────────

  private spawnTarget(
    canvasWidth: number,
    canvasHeight: number,
    timestamp: number
  ): void {
    const { minSpeed, maxSpeed, minRadius, maxRadius, basePoints } = this.config;

    const radius = randRange(minRadius, maxRadius);

    // Spawna numa das 4 bordas aleatoriamente
    const edge = Math.floor(Math.random() * 4);
    let x: number;
    let y: number;

    switch (edge) {
      case 0: // topo
        x = randRange(radius, canvasWidth - radius);
        y = radius;
        break;
      case 1: // direita
        x = canvasWidth - radius;
        y = randRange(radius, canvasHeight - radius);
        break;
      case 2: // baixo
        x = randRange(radius, canvasWidth - radius);
        y = canvasHeight - radius;
        break;
      default: // esquerda
        x = radius;
        y = randRange(radius, canvasHeight - radius);
        break;
    }

    // Velocidade em direção ao centro da tela (com desvio aleatório)
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const angle =
      Math.atan2(cy - y, cx - x) + (Math.random() - 0.5) * (Math.PI / 2);
    const speed = randRange(minSpeed, maxSpeed);

    const velocity: Vec2 = {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    };

    this.targets.push(
      new Target(
        this.nextId++,
        { x, y },
        velocity,
        radius,
        basePoints,
        timestamp
      )
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Funções geométricas puras (exportadas para teste)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna true se o raio (origin + t*direction, t >= 0) intersecta
 * o círculo centrado em `center` com raio `radius`.
 *
 * Derivação: |origin + t*dir - center|² = radius²
 * t = (-b ± √(b²-ac)) / a  onde a=1 (dir normalizado)
 */
export function rayIntersectsCircle(
  origin: Vec2,
  direction: Vec2,
  center: Vec2,
  radius: number
): boolean {
  const ocx = origin.x - center.x;
  const ocy = origin.y - center.y;

  // a = dot(dir, dir) — se dir for normalizado, a = 1
  const a = direction.x * direction.x + direction.y * direction.y;
  if (a === 0) return false;

  const b = 2 * (direction.x * ocx + direction.y * ocy);
  const c = ocx * ocx + ocy * ocy - radius * radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;

  // Pelo menos uma interseção existe; verifica se está à frente (t >= 0)
  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);

  return t1 >= 0 || t2 >= 0;
}

function distSq(a: Vec2, b: Vec2): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
