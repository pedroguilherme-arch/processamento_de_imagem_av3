import type { ScoreManager } from './ScoreManager';

/**
 * ScoreRenderer — exibe pontuação, combo e high-score no canvas.
 */
export class ScoreRenderer {
  /**
   * Renderiza o HUD de pontuação no canto superior direito.
   * Deve ser chamado por último (sobre tudo).
   */
  render(
    ctx: CanvasRenderingContext2D,
    score: ScoreManager,
    canvasWidth: number
  ): void {
    const padding = 16;
    const lineH = 28;
    let y = padding + lineH;
    const x = canvasWidth - padding;

    ctx.save();
    ctx.textAlign = 'right';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';

    // Pontuação atual
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${score.score}`, x, y);
    y += lineH;

    // High-score
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(255,220,80,0.9)';
    ctx.fillText(`best: ${score.highScore}`, x, y);
    y += lineH;

    // Combo
    if (score.combo >= 3) {
      ctx.font = `bold ${14 + Math.min(score.combo * 1.5, 12)}px monospace`;
      ctx.fillStyle = this.comboColor(score.combo);
      ctx.fillText(`${score.combo}× COMBO  ×${score.comboMultiplier}`, x, y);
    }

    ctx.restore();
  }

  private comboColor(combo: number): string {
    if (combo >= 9) return 'rgba(255, 80, 255, 1)';
    if (combo >= 6) return 'rgba(255, 160, 30, 1)';
    return 'rgba(80, 220, 255, 1)';
  }
}
