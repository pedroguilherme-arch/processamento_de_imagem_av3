import type { Vec2 } from '../shared/math';

export type TargetState = 'alive' | 'hit' | 'dead';

/**
 * Representa um alvo em movimento na tela.
 *
 * O alvo se move em linha reta com velocidade constante, ricocheteando
 * nas bordas do canvas. Quando é atingido pelo feixe, entra no estado
 * 'hit' e exibe animação de explosão antes de virar 'dead'.
 */
export class Target {
  readonly id: number;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  state: TargetState = 'alive';

  /** Progresso da animação de hit (0..1). Avança até 1 e vira dead. */
  hitAnimProgress: number = 0;
  /** Duração da animação de hit em ms */
  private readonly HIT_ANIM_DURATION = 600;

  /** Pontos que vale ao ser atingido (aumenta com o tempo vivo) */
  basePoints: number;
  /** Timestamp de quando o alvo foi criado */
  readonly birthTime: number;

  constructor(
    id: number,
    position: Vec2,
    velocity: Vec2,
    radius: number,
    basePoints: number,
    birthTime: number
  ) {
    this.id = id;
    this.position = position;
    this.velocity = velocity;
    this.radius = radius;
    this.basePoints = basePoints;
    this.birthTime = birthTime;
  }

  /**
   * Atualiza posição e estado do alvo.
   * @param deltaTime tempo em ms desde o último frame
   * @param canvasWidth largura do canvas em pixels
   * @param canvasHeight altura do canvas em pixels
   */
  update(deltaTime: number, canvasWidth: number, canvasHeight: number): void {
    if (this.state === 'dead') return;

    if (this.state === 'hit') {
      this.hitAnimProgress += deltaTime / this.HIT_ANIM_DURATION;
      if (this.hitAnimProgress >= 1) {
        this.hitAnimProgress = 1;
        this.state = 'dead';
      }
      return; // não move durante a animação
    }

    const dt = deltaTime / 1000; // converte para segundos
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Ricochete nas bordas
    if (this.position.x - this.radius < 0) {
      this.position.x = this.radius;
      this.velocity.x = Math.abs(this.velocity.x);
    } else if (this.position.x + this.radius > canvasWidth) {
      this.position.x = canvasWidth - this.radius;
      this.velocity.x = -Math.abs(this.velocity.x);
    }

    if (this.position.y - this.radius < 0) {
      this.position.y = this.radius;
      this.velocity.y = Math.abs(this.velocity.y);
    } else if (this.position.y + this.radius > canvasHeight) {
      this.position.y = canvasHeight - this.radius;
      this.velocity.y = -Math.abs(this.velocity.y);
    }
  }

  /**
   * Marca o alvo como atingido, iniciando a animação de explosão.
   */
  hit(): void {
    if (this.state !== 'alive') return;
    this.state = 'hit';
    this.hitAnimProgress = 0;
  }

  /**
   * Calcula os pontos que o alvo vale com bônus de velocidade.
   * Alvos mais rápidos valem mais pontos.
   */
  getPoints(): number {
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    const speedBonus = Math.floor(speed / 100);
    return this.basePoints + speedBonus * 10;
  }

  get isAlive(): boolean {
    return this.state === 'alive';
  }

  get isDead(): boolean {
    return this.state === 'dead';
  }
}
