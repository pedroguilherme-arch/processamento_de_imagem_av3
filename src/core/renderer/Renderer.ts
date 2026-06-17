import { RENDER_CONSTANTS } from '../../shared/constants';
import { clamp } from '../../shared/math';
import type { Vec2 } from '../../shared/math';
import type { GestureState } from '../../shared/types';
import { GlowRenderer, type IGlowRenderer } from './GlowRenderer';
import { ParticleEngine, type IParticleEngine } from './ParticleEngine';
import { BeamRenderer, type IBeamRenderer } from './BeamRenderer';

/**
 * State passed to the Renderer each frame describing what to render.
 */
export interface RenderState {
  gestureState: GestureState;
  handsCenterPosition: Vec2 | null;
  chargeTime: number;
  chargeIntensity: number; // 0..1
  firingDirection: Vec2 | null;
  flashActive: boolean;
  shakeActive: boolean;
  canvasHeight: number;
  isFullyCharged: boolean; // true quando carga >= MIN_CHARGE_TO_FIRE
}

/**
 * Interface for the main Renderer pipeline.
 */
export interface IRenderer {
  initialize(canvas: HTMLCanvasElement): void;
  render(state: RenderState): void;
  destroy(): void;
}

/**
 * Renderer coordinates GlowRenderer, ParticleEngine, and BeamRenderer
 * in each frame. It implements frame budget checking: if processing time
 * exceeds RENDER_CONSTANTS.FRAME_BUDGET (33ms), the frame is discarded.
 *
 * The render() method is a single-frame method called externally (e.g., via
 * requestAnimationFrame in the App orchestrator).
 *
 * Render pipeline order:
 * 1. Start frame timer
 * 2. Clear canvas
 * 3. Apply shake transform if active
 * 4. Render glow if in charging state
 * 5. Update and render particles
 * 6. Render beam if in firing state
 * 7. Apply flash overlay if active
 * 8. Check frame budget — discard if exceeded
 */
export class Renderer implements IRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private glowRenderer: IGlowRenderer;
  private particleEngine: IParticleEngine;
  private beamRenderer: IBeamRenderer;

  private lastFrameTime: number = 0;
  private initialized = false;
  private readyRingPhase = 0;

  /** Tracks whether the last frame was discarded due to budget overrun */
  private lastFrameDiscarded = false;

  constructor(
    glowRenderer?: IGlowRenderer,
    particleEngine?: IParticleEngine,
    beamRenderer?: IBeamRenderer
  ) {
    this.glowRenderer = glowRenderer ?? new GlowRenderer();
    this.particleEngine = particleEngine ?? new ParticleEngine();
    this.beamRenderer = beamRenderer ?? new BeamRenderer();
  }

  /**
   * Initialize the renderer with a canvas element.
   * Sets up the 2D context and initializes sub-renderers.
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('Failed to get 2D rendering context from canvas');
    }

    // Initialize particle engine with the canvas parent or the canvas itself
    const container = canvas.parentElement ?? canvas;
    this.particleEngine.initialize(container);

    this.lastFrameTime = performance.now();
    this.initialized = true;
  }

  /**
   * Render a single frame with the given state.
   * Checks frame budget and discards the frame if processing exceeds 33ms.
   *
   * @returns true if the frame was rendered, false if discarded due to budget overrun.
   */
  render(state: RenderState): boolean {
    if (!this.initialized || !this.ctx || !this.canvas) {
      return false;
    }

    const frameStart = performance.now();
    const deltaTime = frameStart - this.lastFrameTime;
    this.lastFrameTime = frameStart;

    const ctx = this.ctx;
    const canvas = this.canvas;

    // Save the original canvas state
    ctx.save();

    // Step 1: Não limpar o canvas aqui — o vídeo já foi desenhado pelo CanvasManager
    // antes desta chamada. Apenas aplicamos os efeitos por cima (compositing).

    // Step 2: Apply shake transform if active
    if (state.shakeActive) {
      const shakeX = (Math.random() - 0.5) * 10 * state.chargeIntensity;
      const shakeY = (Math.random() - 0.5) * 10 * state.chargeIntensity;
      ctx.translate(shakeX, shakeY);
    }

    // Step 3: Render glow if in charging state
    if (state.gestureState === 'charging' && state.handsCenterPosition) {
      const heightRatio = state.canvasHeight > 0
        ? clamp(1 - state.handsCenterPosition.y / state.canvasHeight, 0, 1)
        : 0;
      const baseRadius = 30 + 150 * state.chargeIntensity;
      const heightBonus = 80 * heightRatio * state.chargeIntensity;
      const radius = baseRadius + heightBonus;

      this.glowRenderer.renderGlow(
        state.handsCenterPosition,
        radius,
        state.chargeIntensity
      );
      this.glowRenderer.render(ctx);

      // Indicador de carga máxima: anel pulsante quando pronto para disparar
      if (state.isFullyCharged) {
        this.drawReadyRing(ctx, state.handsCenterPosition, radius);
      }
    } else {
      this.glowRenderer.clear();
    }

    // Step 4: Update particles
    this.particleEngine.update(deltaTime);

    // Step 5: Render beam if in firing state
    if (state.gestureState === 'firing' && state.handsCenterPosition && state.firingDirection) {
      if (!this.beamRenderer.isActive()) {
        this.beamRenderer.startBeam(
          state.handsCenterPosition,
          state.firingDirection,
          state.chargeIntensity
        );
      } else {
        this.beamRenderer.updateBeam(
          state.handsCenterPosition,
          state.firingDirection,
          state.chargeIntensity
        );
      }
    } else if (state.gestureState !== 'firing' && this.beamRenderer.isActive() && !this.beamRenderer.isFading()) {
      // Inicia o fade apenas uma vez — não chama stopBeam repetidamente
      // Se voltou para charging (novo kamehameha), mata imediatamente
      if (state.gestureState === 'charging') {
        this.beamRenderer.killBeam();
      } else {
        this.beamRenderer.stopBeam();
      }
    }

    this.beamRenderer.render(ctx, deltaTime);

    // Step 6: Apply flash overlay if active
    if (state.flashActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Restore canvas state (undo shake transform)
    ctx.restore();

    // Step 7: Check frame budget
    const frameEnd = performance.now();
    const frameTime = frameEnd - frameStart;

    if (frameTime > RENDER_CONSTANTS.FRAME_BUDGET) {
      // Frame budget exceeded — apenas registra, mas não apaga o canvas.
      // Apagar aqui removeria o vídeo de fundo que já foi desenhado.
      this.lastFrameDiscarded = true;
      return false;
    }

    this.lastFrameDiscarded = false;
    return true;
  }

  /**
   * Returns whether the last frame was discarded due to budget overrun.
   */
  wasLastFrameDiscarded(): boolean {
    return this.lastFrameDiscarded;
  }

  /**
   * Anel pulsante ao redor da bola indicando que a carga está pronta para disparar.
   * Pulsa rapidamente e tem cor branca/ciano intensa.
   */
  private drawReadyRing(ctx: CanvasRenderingContext2D, position: { x: number; y: number }, radius: number): void {
    this.readyRingPhase += 0.18;
    const pulse = 1 + Math.sin(this.readyRingPhase * 3) * 0.12;
    const ringR = radius * 1.35 * pulse;
    const alpha = 0.6 + Math.sin(this.readyRingPhase * 3) * 0.4;

    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(150, 230, 255, 1)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(position.x, position.y, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Segundo anel menor
    ctx.strokeStyle = `rgba(180, 240, 255, ${alpha * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(position.x, position.y, ringR * 1.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Clean up resources and sub-renderers.
   */
  destroy(): void {
    this.glowRenderer.clear();
    this.particleEngine.clear();
    if (this.beamRenderer.isActive()) {
      this.beamRenderer.stopBeam();
    }
    this.canvas = null;
    this.ctx = null;
    this.initialized = false;
  }
}
