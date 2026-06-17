/**
 * CanvasManager - Gerencia o canvas principal da aplicação.
 * Responsável por resize, clear e composição de layers (vídeo background + efeitos).
 *
 * Requisitos: 1.6, 5.1
 */
export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = ctx;
  }

  /**
   * Inicializa o CanvasManager, configurando resize automático.
   */
  initialize(): void {
    this.resizeToContainer();
    this.resizeObserver = new ResizeObserver(() => this.resizeToContainer());
    if (this.canvas.parentElement) {
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  }

  /**
   * Ajusta o canvas ao tamanho do container pai.
   */
  private resizeToContainer(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const { clientWidth, clientHeight } = parent;
    if (this.canvas.width !== clientWidth || this.canvas.height !== clientHeight) {
      this.canvas.width = clientWidth;
      this.canvas.height = clientHeight;
    }
  }

  /**
   * Limpa todo o canvas.
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Renderiza o vídeo da webcam como background layer, espelhado horizontalmente.
   * Limpa o canvas antes de desenhar para evitar ghosting de frames anteriores.
   */
  drawVideoBackground(video: HTMLVideoElement): void {
    if (video.readyState < video.HAVE_CURRENT_DATA) return;

    const { width, height } = this.canvas;
    this.ctx.save();
    // Limpar o frame anterior antes de desenhar o novo
    this.ctx.clearRect(0, 0, width, height);
    // Espelhar horizontalmente para efeito de espelho natural
    this.ctx.translate(width, 0);
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(video, 0, 0, width, height);
    this.ctx.restore();
  }

  /**
   * Retorna o contexto 2D para composição de layers adicionais.
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Retorna o elemento canvas gerenciado.
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Retorna as dimensões atuais do canvas.
   */
  getSize(): { width: number; height: number } {
    return { width: this.canvas.width, height: this.canvas.height };
  }

  /**
   * Libera recursos.
   */
  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}
