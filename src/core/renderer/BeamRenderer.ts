import { RENDER_CONSTANTS } from '../../shared/constants';
import type { Vec2 } from '../../shared/math';
import { clamp } from '../../shared/math';

export interface IBeamRenderer {
  startBeam(origin: Vec2, direction: Vec2, intensity: number): void;
  updateBeam(origin: Vec2, direction: Vec2, intensity: number): void;
  stopBeam(): void;
  killBeam(): void;
  isActive(): boolean;
  isFading(): boolean;
  render(ctx: CanvasRenderingContext2D, deltaTime: number): void;
}

interface BeamState {
  origin: Vec2;
  direction: Vec2;
  intensity: number;
}

/**
 * BeamRenderer — feixe de energia estilo Kamehameha.
 *
 * Visual baseado nas referências:
 * - Feixe cilíndrico sólido: branco puro no centro, azul claro nas bordas
 * - Muito largo e preenchido (não é uma linha fina)
 * - Burst de raios na origem ao disparar (como a imagem do Goku)
 * - Leve afunilamento em perspectiva
 * - Fade-out suave ao terminar
 */
export class BeamRenderer implements IBeamRenderer {
  private active = false;
  private fading = false;
  private fadeElapsed = 0;
  private opacity = 1;
  private beam: BeamState | null = null;
  private elapsed = 0;

  // Burst de raios na origem ao iniciar
  private burstAge = 0;
  private burstActive = false;

  private readonly fadeDuration = RENDER_CONSTANTS.BEAM_FADE_DURATION;

  startBeam(origin: Vec2, direction: Vec2, intensity: number): void {
    this.active = true;
    this.fading = false;
    this.fadeElapsed = 0;
    this.opacity = 1;
    this.elapsed = 0;
    this.burstAge = 0;
    this.burstActive = true;
    this.beam = { origin, direction, intensity: clamp(intensity, 0, 1) };
  }

  updateBeam(origin: Vec2, direction: Vec2, intensity: number): void {
    if (!this.active) return;
    this.beam = { origin, direction, intensity: clamp(intensity, 0, 1) };
  }

  stopBeam(): void {
    if (!this.active) return;
    this.fading = true;
    this.fadeElapsed = 0;
  }

  /** Para o raio imediatamente, sem fade (ex: novo carregamento iniciado). */
  killBeam(): void {
    this.active = false;
    this.fading = false;
    this.fadeElapsed = 0;
    this.beam = null;
  }

  isActive(): boolean {
    return this.active;
  }

  isFading(): boolean {
    return this.fading;
  }

  render(ctx: CanvasRenderingContext2D, deltaTime: number): void {
    if (!this.active || !this.beam) return;

    this.elapsed += deltaTime;

    if (this.fading) {
      this.fadeElapsed += deltaTime;
      this.opacity = clamp(1 - this.fadeElapsed / this.fadeDuration, 0, 1);
      if (this.fadeElapsed >= this.fadeDuration) {
        this.active = false;
        this.fading = false;
        this.beam = null;
        return;
      }
    }

    if (this.burstActive) {
      this.burstAge += deltaTime;
      if (this.burstAge > 400) this.burstActive = false;
    }

    ctx.save();
    ctx.globalAlpha = this.opacity;

    this.drawBeam(ctx);

    if (this.burstActive) {
      this.drawOriginBurst(ctx, this.beam.origin, this.beam.intensity);
    }

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Feixe principal
  // ─────────────────────────────────────────────────────────────────────────

  private drawBeam(ctx: CanvasRenderingContext2D): void {
    if (!this.beam) return;

    const { origin, direction, intensity } = this.beam;

    // Perpendicular ao feixe (para calcular largura)
    const perp: Vec2 = { x: -direction.y, y: direction.x };

    // Largura na origem — bem largo como nas referências
    const halfWidthOrigin = (40 + intensity * 80);
    // Largura na ponta — afunila levemente (perspectiva)
    const halfWidthTip = halfWidthOrigin * 0.55;

    // Comprimento: atravessa a tela inteira
    const beamLength = 2500;

    const tip: Vec2 = {
      x: origin.x + direction.x * beamLength,
      y: origin.y + direction.y * beamLength,
    };

    // ── Camada 1: Glow atmosférico externo (azul claro, muito largo) ────────
    this.drawBeamQuad(ctx, origin, tip, perp,
      halfWidthOrigin * 3.5, halfWidthTip * 3.5,
      this.makeWidthGradient(ctx, origin, perp, halfWidthOrigin * 3.5, [
        [0,   `rgba(100, 200, 255, ${0.08 * intensity})`],
        [0.5, `rgba(60,  160, 255, ${0.04 * intensity})`],
        [1,   'rgba(20, 80, 200, 0)'],
      ])
    );

    // ── Camada 2: Corpo azul claro ───────────────────────────────────────────
    this.drawBeamQuad(ctx, origin, tip, perp,
      halfWidthOrigin * 1.8, halfWidthTip * 1.8,
      this.makeWidthGradient(ctx, origin, perp, halfWidthOrigin * 1.8, [
        [0,   `rgba(160, 230, 255, ${0.55 * intensity})`],
        [0.35,`rgba(80,  180, 255, ${0.4  * intensity})`],
        [0.7, `rgba(40,  120, 230, ${0.15 * intensity})`],
        [1,   'rgba(20, 80, 200, 0)'],
      ])
    );

    // ── Camada 3: Núcleo branco sólido ───────────────────────────────────────
    this.drawBeamQuad(ctx, origin, tip, perp,
      halfWidthOrigin * 0.75, halfWidthTip * 0.75,
      this.makeWidthGradient(ctx, origin, perp, halfWidthOrigin * 0.75, [
        [0,   `rgba(255, 255, 255, ${intensity})`],
        [0.25,`rgba(240, 250, 255, ${0.95 * intensity})`],
        [0.6, `rgba(180, 230, 255, ${0.7  * intensity})`],
        [1,   `rgba(100, 180, 255, 0)`],
      ])
    );

    // ── Linha central ultra-brilhante ────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${intensity})`;
    ctx.lineWidth = Math.max(halfWidthOrigin * 0.18, 3);
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(200, 240, 255, 0.9)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Desenha um quad (trapézio) para o feixe — largura diferente na origem e na ponta.
   */
  private drawBeamQuad(
    ctx: CanvasRenderingContext2D,
    origin: Vec2,
    tip: Vec2,
    perp: Vec2,
    halfWOrigin: number,
    halfWTip: number,
    gradient: CanvasGradient
  ): void {
    ctx.beginPath();
    ctx.moveTo(origin.x + perp.x * halfWOrigin, origin.y + perp.y * halfWOrigin);
    ctx.lineTo(tip.x   + perp.x * halfWTip,    tip.y   + perp.y * halfWTip);
    ctx.lineTo(tip.x   - perp.x * halfWTip,    tip.y   - perp.y * halfWTip);
    ctx.lineTo(origin.x - perp.x * halfWOrigin, origin.y - perp.y * halfWOrigin);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  /**
   * Gradiente perpendicular ao feixe (controla a queda de brilho da borda ao centro).
   * Espelha os stops: borda → centro → borda.
   */
  private makeWidthGradient(
    ctx: CanvasRenderingContext2D,
    origin: Vec2,
    perp: Vec2,
    halfWidth: number,
    stops: [number, string][]
  ): CanvasGradient {
    const g = ctx.createLinearGradient(
      origin.x - perp.x * halfWidth, origin.y - perp.y * halfWidth,
      origin.x + perp.x * halfWidth, origin.y + perp.y * halfWidth
    );
    for (const [t, color] of stops) {
      g.addColorStop(t / 2, color);
    }
    for (const [t, color] of [...stops].reverse()) {
      g.addColorStop(1 - t / 2, color);
    }
    return g;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Burst de raios na origem (como nas referências — raios saindo em estrela)
  // ─────────────────────────────────────────────────────────────────────────

  private drawOriginBurst(
    ctx: CanvasRenderingContext2D,
    origin: Vec2,
    intensity: number
  ): void {
    // Progresso do burst: 0 → 1 em 400ms
    const progress = clamp(this.burstAge / 400, 0, 1);
    // Fade: aparece rápido, some suavemente
    const alpha = progress < 0.3
      ? progress / 0.3
      : 1 - (progress - 0.3) / 0.7;

    if (alpha <= 0) return;

    const maxRayLength = 180 + intensity * 120;
    const rayCount = 16;

    ctx.save();

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + (i % 2 === 0 ? 0.1 : -0.1);
      // Raios alternados: longos e curtos (como nas referências)
      const isLong = i % 3 !== 1;
      const rayLength = maxRayLength * progress * (isLong ? 1.0 : 0.55);
      const rayWidth = (isLong ? 8 : 4) * intensity * (1 - progress * 0.5);

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const perpCos = Math.cos(angle + Math.PI / 2);
      const perpSin = Math.sin(angle + Math.PI / 2);

      const startDist = 10;
      const sx = origin.x + cos * startDist;
      const sy = origin.y + sin * startDist;
      const ex = origin.x + cos * (startDist + rayLength);
      const ey = origin.y + sin * (startDist + rayLength);

      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0,   `rgba(255, 255, 255, ${alpha * intensity})`);
      grad.addColorStop(0.4, `rgba(200, 240, 255, ${alpha * 0.7 * intensity})`);
      grad.addColorStop(1,   'rgba(100, 180, 255, 0)');

      ctx.beginPath();
      ctx.moveTo(sx + perpCos * rayWidth, sy + perpSin * rayWidth);
      ctx.lineTo(ex, ey);
      ctx.lineTo(sx - perpCos * rayWidth, sy - perpSin * rayWidth);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Flash central branco
    const flashR = 60 * intensity * (1 - progress * 0.6);
    const flash = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, flashR);
    flash.addColorStop(0,   `rgba(255, 255, 255, ${alpha * intensity})`);
    flash.addColorStop(0.5, `rgba(200, 240, 255, ${alpha * 0.5 * intensity})`);
    flash.addColorStop(1,   'rgba(100, 180, 255, 0)');
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, flashR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
