import type { HandData } from '../shared/types';

/**
 * OverlayManager - Gerencia overlays de debug (landmarks, FPS counter).
 * Renderiza landmarks como pontos coloridos quando debug habilitado.
 *
 * Requisitos: 9.1, 9.2
 */
export class OverlayManager {
  private ctx: CanvasRenderingContext2D;
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;
  private showLandmarks: boolean = false;
  private showFps: boolean = false;

  private static readonly LANDMARK_RADIUS = 4;
  private static readonly LANDMARK_COLORS: Record<string, string> = {
    left: '#00ff88',
    right: '#ff6644',
  };
  private static readonly FPS_FONT = '14px monospace';
  private static readonly FPS_COLOR = '#00ff00';
  private static readonly FPS_BG = 'rgba(0, 0, 0, 0.6)';

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * Atualiza as dimensões do canvas para mapeamento de coordenadas.
   */
  setSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  /**
   * Habilita ou desabilita a visualização de landmarks.
   */
  setShowLandmarks(show: boolean): void {
    this.showLandmarks = show;
  }

  /**
   * Habilita ou desabilita o contador de FPS.
   */
  setShowFps(show: boolean): void {
    this.showFps = show;
  }

  /**
   * Renderiza landmarks das mãos como pontos coloridos sobre o canvas.
   * Cada mão usa uma cor diferente (verde para esquerda, laranja para direita).
   */
  drawLandmarks(hands: HandData[]): void {
    if (!this.showLandmarks || hands.length === 0) return;

    for (const hand of hands) {
      const color = OverlayManager.LANDMARK_COLORS[hand.handedness] ?? '#ffffff';
      this.ctx.fillStyle = color;

      for (const lm of hand.landmarks) {
        // Coordenadas normalizadas [0,1] → pixels, espelhado horizontalmente
        const x = (1 - lm.x) * this.canvasWidth;
        const y = lm.y * this.canvasHeight;

        this.ctx.beginPath();
        this.ctx.arc(x, y, OverlayManager.LANDMARK_RADIUS, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  /**
   * Renderiza o contador de FPS no canto superior esquerdo.
   */
  drawFps(trackingFps: number, renderFps: number): void {
    if (!this.showFps) return;

    const text = `Track: ${trackingFps.toFixed(0)} fps | Render: ${renderFps.toFixed(0)} fps`;
    this.ctx.font = OverlayManager.FPS_FONT;
    const metrics = this.ctx.measureText(text);
    const padding = 6;
    const x = 10;
    const y = 10;

    // Background
    this.ctx.fillStyle = OverlayManager.FPS_BG;
    this.ctx.fillRect(x, y, metrics.width + padding * 2, 20 + padding);

    // Text
    this.ctx.fillStyle = OverlayManager.FPS_COLOR;
    this.ctx.fillText(text, x + padding, y + 16);
  }
}
