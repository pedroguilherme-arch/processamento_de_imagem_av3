import type { Vec2 } from '../../shared/math';
import { clamp } from '../../shared/math';

export interface IGlowRenderer {
  renderGlow(position: Vec2, radius: number, intensity: number): void;
  clear(): void;
  render(ctx: CanvasRenderingContext2D): void;
}

interface GlowConfig {
  position: Vec2;
  radius: number;
  intensity: number;
}

/**
 * GlowRenderer — bola de energia estilo Kamehameha em carregamento.
 *
 * Visual baseado nas referências:
 * - Núcleo branco cegante no centro
 * - Raios de luz irregulares saindo em todas as direções (como estrela)
 * - Halo azul/ciano ao redor
 * - Pulso animado para dar sensação de energia viva
 */
export class GlowRenderer implements IGlowRenderer {
  private glow: GlowConfig | null = null;
  private phase = 0; // animation phase

  renderGlow(position: Vec2, radius: number, intensity: number): void {
    this.glow = {
      position,
      radius: Math.max(radius, 0),
      intensity: clamp(intensity, 0, 1),
    };
  }

  clear(): void {
    this.glow = null;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.glow) return;
    const { position, radius, intensity } = this.glow;
    if (radius === 0 || intensity === 0) return;

    this.phase += 0.08;

    ctx.save();

    // ── 1. Halo externo azul/ciano ──────────────────────────────────────────
    const haloR = radius * 3.5;
    const halo = ctx.createRadialGradient(
      position.x, position.y, radius * 0.3,
      position.x, position.y, haloR
    );
    halo.addColorStop(0,   `rgba(140, 220, 255, ${0.25 * intensity})`);
    halo.addColorStop(0.4, `rgba(60,  160, 255, ${0.12 * intensity})`);
    halo.addColorStop(1,   'rgba(20, 80, 200, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(position.x, position.y, haloR, 0, Math.PI * 2);
    ctx.fill();

    // ── 2. Raios de luz irregulares (estrela de energia) ────────────────────
    this.drawEnergyRays(ctx, position, radius, intensity);

    // ── 3. Bola de glow intermediária ───────────────────────────────────────
    const pulse = 1 + Math.sin(this.phase) * 0.07 * intensity;
    const r = radius * pulse;

    const mid = ctx.createRadialGradient(
      position.x, position.y, 0,
      position.x, position.y, r * 1.4
    );
    mid.addColorStop(0,   `rgba(255, 255, 255, ${intensity})`);
    mid.addColorStop(0.2, `rgba(200, 240, 255, ${0.9 * intensity})`);
    mid.addColorStop(0.5, `rgba(80,  180, 255, ${0.6 * intensity})`);
    mid.addColorStop(0.8, `rgba(30,  100, 230, ${0.25 * intensity})`);
    mid.addColorStop(1,   'rgba(10, 60, 200, 0)');
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.arc(position.x, position.y, r * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // ── 4. Núcleo branco cegante ─────────────────────────────────────────────
    const coreR = r * 0.55;
    const core = ctx.createRadialGradient(
      position.x, position.y, 0,
      position.x, position.y, coreR
    );
    core.addColorStop(0,   `rgba(255, 255, 255, ${intensity})`);
    core.addColorStop(0.4, `rgba(240, 250, 255, ${0.95 * intensity})`);
    core.addColorStop(0.8, `rgba(160, 220, 255, ${0.7 * intensity})`);
    core.addColorStop(1,   `rgba(80, 160, 255, 0)`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(position.x, position.y, coreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Desenha raios de luz irregulares saindo do centro — efeito de estrela/explosão
   * como nas referências do Kamehameha em carregamento.
   */
  private drawEnergyRays(
    ctx: CanvasRenderingContext2D,
    position: Vec2,
    radius: number,
    intensity: number
  ): void {
    // Número de raios aumenta com a intensidade
    const rayCount = Math.floor(8 + intensity * 10);
    ctx.save();

    for (let i = 0; i < rayCount; i++) {
      // Ângulo base + rotação animada + variação aleatória por índice
      const baseAngle = (i / rayCount) * Math.PI * 2;
      const wobble = Math.sin(this.phase * 1.3 + i * 2.1) * 0.18;
      const angle = baseAngle + wobble;

      // Comprimento varia por raio — alguns curtos, alguns longos
      const lengthVariation = 0.6 + Math.abs(Math.sin(this.phase * 0.7 + i * 1.4)) * 0.8;
      const rayLength = radius * (1.8 + lengthVariation) * intensity;

      // Largura na base do raio
      const rayWidth = radius * (0.08 + Math.sin(this.phase + i) * 0.04) * intensity;

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const perpCos = Math.cos(angle + Math.PI / 2);
      const perpSin = Math.sin(angle + Math.PI / 2);

      // Ponto de início (na superfície da bola)
      const startDist = radius * 0.4;
      const sx = position.x + cos * startDist;
      const sy = position.y + sin * startDist;

      // Ponta do raio
      const ex = position.x + cos * (startDist + rayLength);
      const ey = position.y + sin * (startDist + rayLength);

      // Desenha o raio como triângulo (largo na base, fino na ponta)
      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * intensity})`);
      grad.addColorStop(0.3, `rgba(180, 230, 255, ${0.6 * intensity})`);
      grad.addColorStop(1, 'rgba(100, 180, 255, 0)');

      ctx.beginPath();
      ctx.moveTo(sx + perpCos * rayWidth, sy + perpSin * rayWidth);
      ctx.lineTo(ex, ey);
      ctx.lineTo(sx - perpCos * rayWidth, sy - perpSin * rayWidth);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.restore();
  }
}
