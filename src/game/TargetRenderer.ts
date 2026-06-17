import type { Target } from './Target';

/**
 * TargetRenderer — desenha alvos e suas animações de hit no canvas.
 *
 * Modo normal:   esfera de energia laranja/vermelho com brilho
 * Modo mabindu:  imagem do madinbu.png no lugar das esferas
 * Animação hit:  explosão de bola de fogo (igual nos dois modos)
 */
export class TargetRenderer {
  private mabinduMode = false;
  private mabinduImage: HTMLImageElement | null = null;
  private mabinduImageLoaded = false;

  constructor() {
    this.loadMabinduImage();
  }

  private loadMabinduImage(): void {
    const img = new Image();
    img.onload = () => { this.mabinduImageLoaded = true; };
    img.onerror = () => { this.mabinduImageLoaded = false; };
    img.src = '/madinbu.png';
    this.mabinduImage = img;
  }

  /** Ativa ou desativa o modo mabindu */
  setMabinduMode(active: boolean): void {
    this.mabinduMode = active;
  }

  /**
   * Renderiza todos os alvos fornecidos.
   */
  render(ctx: CanvasRenderingContext2D, targets: readonly Target[]): void {
    for (const target of targets) {
      if (target.state === 'alive') {
        if (this.mabinduMode && this.mabinduImageLoaded && this.mabinduImage) {
          this.drawMabindu(ctx, target);
        } else {
          this.drawTarget(ctx, target);
        }
      } else if (target.state === 'hit') {
        this.drawHitExplosion(ctx, target);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Alvo modo mabindu — imagem do madinbu
  // ─────────────────────────────────────────────────────────────────────────

  private drawMabindu(ctx: CanvasRenderingContext2D, target: Target): void {
    const { x, y } = target.position;
    const r = target.radius;

    ctx.save();

    // Glow vermelho/roxo de aviso ao redor
    const outerGlow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.4);
    outerGlow.addColorStop(0, 'rgba(180, 0, 255, 0.4)');
    outerGlow.addColorStop(1, 'rgba(100, 0, 200, 0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Recorte circular para a imagem
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    // Desenha a imagem dentro do círculo
    ctx.drawImage(this.mabinduImage!, x - r, y - r, r * 2, r * 2);

    ctx.restore();

    // Borda pulsante
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 0, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(200, 50, 255, 1)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Alvo vivo — esfera de energia
  // ─────────────────────────────────────────────────────────────────────────

  private drawTarget(ctx: CanvasRenderingContext2D, target: Target): void {
    const { x, y } = target.position;
    const r = target.radius;

    ctx.save();

    // Glow externo
    const outerGlow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.2);
    outerGlow.addColorStop(0, 'rgba(255, 100, 50, 0.35)');
    outerGlow.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Corpo principal — gradiente laranja/vermelho/branco
    const body = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
    body.addColorStop(0, 'rgba(255, 255, 220, 0.95)');
    body.addColorStop(0.3, 'rgba(255, 160, 60, 0.9)');
    body.addColorStop(0.7, 'rgba(220, 60, 20, 0.85)');
    body.addColorStop(1, 'rgba(160, 20, 0, 0.7)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Brilho interno (highlight)
    const highlight = ctx.createRadialGradient(
      x - r * 0.3, y - r * 0.3, 0,
      x - r * 0.3, y - r * 0.3, r * 0.55
    );
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Animação de hit — explosão de bola de fogo
  // ─────────────────────────────────────────────────────────────────────────

  private drawHitExplosion(ctx: CanvasRenderingContext2D, target: Target): void {
    const { x, y } = target.position;
    const r = target.radius;
    const p = target.hitAnimProgress; // 0..1

    ctx.save();

    // ── Bola de fogo central — aparece forte e some ───────────────────────
    // Expande de r até r*2.5 e some no final
    const fireR = r * (1 + p * 1.5);
    const fireAlpha = p < 0.4 ? 1 : 1 - (p - 0.4) / 0.6;

    const fireball = ctx.createRadialGradient(x, y, 0, x, y, fireR);
    fireball.addColorStop(0,   `rgba(255, 255, 200, ${fireAlpha})`);
    fireball.addColorStop(0.3, `rgba(255, 220, 50,  ${fireAlpha * 0.95})`);
    fireball.addColorStop(0.6, `rgba(255, 100, 10,  ${fireAlpha * 0.85})`);
    fireball.addColorStop(1,   `rgba(180, 30,  0,   0)`);
    ctx.fillStyle = fireball;
    ctx.beginPath();
    ctx.arc(x, y, fireR, 0, Math.PI * 2);
    ctx.fill();

    // ── Flash branco inicial (primeiros 20%) ─────────────────────────────
    if (p < 0.25) {
      const flashAlpha = (0.25 - p) / 0.25;
      const flash = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      flash.addColorStop(0,   `rgba(255, 255, 255, ${flashAlpha})`);
      flash.addColorStop(0.4, `rgba(255, 230, 100, ${flashAlpha * 0.6})`);
      flash.addColorStop(1,   'rgba(255, 150, 0, 0)');
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Onda de choque expandindo ────────────────────────────────────────
    const shockR = r * (1.2 + p * 4);
    const shockAlpha = Math.max(0, 1 - p * 1.4);
    ctx.strokeStyle = `rgba(255, 200, 60, ${shockAlpha})`;
    ctx.lineWidth = 4 * (1 - p) + 1;
    ctx.shadowColor = 'rgba(255, 150, 0, 0.8)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, shockR, 0, Math.PI * 2);
    ctx.stroke();

    // Segunda onda menor (defasada)
    if (p < 0.6) {
      const shock2R = r * (1 + p * 2.5);
      const shock2Alpha = (0.6 - p) / 0.6;
      ctx.strokeStyle = `rgba(255, 120, 20, ${shock2Alpha * 0.8})`;
      ctx.lineWidth = 6 * shock2Alpha + 1;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, shock2R, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // ── Fragmentos voando para fora (12 pedaços) ─────────────────────────
    const fragCount = 12;
    for (let i = 0; i < fragCount; i++) {
      // Ângulo com leve variação alternada para parecer orgânico
      const angle = (i / fragCount) * Math.PI * 2 + (i % 2 === 0 ? 0.15 : -0.15);
      // Fragmentos alternados: longos e curtos
      const isLong = i % 3 !== 1;
      const dist = r * (0.5 + p * (isLong ? 3.5 : 2.2));
      const fx = x + Math.cos(angle) * dist;
      const fy = y + Math.sin(angle) * dist;
      const fragR = (1 - p) * (isLong ? 7 : 5) + 1;
      const fragAlpha = Math.max(0, 1 - p * 1.2);

      // Cor varia de branco → laranja → vermelho conforme avança
      const g = Math.floor(200 - p * 180);
      ctx.fillStyle = `rgba(255, ${g}, 10, ${fragAlpha})`;
      ctx.shadowColor = `rgba(255, ${g}, 0, 0.6)`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(fx, fy, fragR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Fumaça/nuvem se expandindo no final (60%+) ───────────────────────
    if (p > 0.5) {
      const smokeP = (p - 0.5) / 0.5; // 0..1 somente na segunda metade
      const smokeR = r * (2 + smokeP * 3);
      const smokeAlpha = smokeP * 0.25 * (1 - smokeP);
      const smoke = ctx.createRadialGradient(x, y, smokeR * 0.3, x, y, smokeR);
      smoke.addColorStop(0,   `rgba(80, 50, 20, ${smokeAlpha})`);
      smoke.addColorStop(0.6, `rgba(50, 30, 10, ${smokeAlpha * 0.5})`);
      smoke.addColorStop(1,   'rgba(20, 10, 0, 0)');
      ctx.shadowBlur = 0;
      ctx.fillStyle = smoke;
      ctx.beginPath();
      ctx.arc(x, y, smokeR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
