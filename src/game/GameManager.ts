import { TargetManager } from './TargetManager';
import { ScoreManager } from './ScoreManager';
import { TargetRenderer } from './TargetRenderer';
import { ScoreRenderer } from './ScoreRenderer';
import type { Vec2 } from '../shared/math';

/** Pontuação para ativar o modo mabindu */
const MABINDU_SCORE_THRESHOLD = 5000;

export interface GameState {
  isActive: boolean;
  score: number;
  highScore: number;
  combo: number;
  comboMultiplier: number;
  aliveTargets: number;
  mabinduMode: boolean;
}

/**
 * GameManager — orquestra a camada de gameplay.
 *
 * Responsabilidades:
 * - Receber eventos de disparo do GestureDetector (via App)
 * - Coordenar TargetManager, ScoreManager, TargetRenderer e ScoreRenderer
 * - Expor update() e render() para o loop principal do App
 *
 * Integração:
 * - App.ts chama gameManager.onFiring() quando o estado muda para 'firing'
 * - App.ts chama gameManager.update(deltaTime, canvasWidth, canvasHeight, timestamp) no render loop
 * - App.ts chama gameManager.render(ctx, canvasWidth) no render loop
 */
export class GameManager {
  private targetManager: TargetManager;
  private scoreManager: ScoreManager;
  private targetRenderer: TargetRenderer;
  private scoreRenderer: ScoreRenderer;

  private _active = false;
  private _mabinduMode = false;

  // Áudio "vou-te-comer"
  private audioContext: AudioContext | null = null;
  private vouTeComerBuffer: AudioBuffer | null = null;

  constructor() {
    this.targetManager = new TargetManager();
    this.scoreManager = new ScoreManager();
    this.targetRenderer = new TargetRenderer();
    this.scoreRenderer = new ScoreRenderer();
    this.loadVouTeComerAudio();
  }

  private async loadVouTeComerAudio(): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      const response = await fetch('/vou-te-comer.mp3');
      if (!response.ok) return;
      const buffer = await response.arrayBuffer();
      this.vouTeComerBuffer = await this.audioContext.decodeAudioData(buffer);
    } catch {
      // Áudio não disponível — falha silenciosa
    }
  }

  private playVouTeComer(): void {
    if (!this.audioContext || !this.vouTeComerBuffer) return;
    try {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      const source = this.audioContext.createBufferSource();
      source.buffer = this.vouTeComerBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch {
      // Falha silenciosa
    }
  }

  /** Inicia/reinicia o jogo */
  start(): void {
    this.targetManager.clear();
    this.scoreManager.reset();
    this._mabinduMode = false;
    this.targetRenderer.setMabinduMode(false);
    this._active = true;
  }

  /** Para o jogo (sem resetar o high-score) */
  stop(): void {
    this._active = false;
  }

  get isActive(): boolean {
    return this._active;
  }

  /**
   * Chamado pelo App quando o gesto muda para 'firing'.
   * Verifica colisão do feixe com os alvos e soma pontos.
   *
   * @param origin     posição das mãos no canvas (pixels)
   * @param direction  direção normalizada do feixe
   * @param timestamp  timestamp atual
   */
  onFiring(origin: Vec2, direction: Vec2, timestamp: number): void {
    if (!this._active) return;
    this.applyBeamCollision(origin, direction, timestamp);
  }

  /**
   * Chamado a cada frame pelo render loop enquanto o raio está ativo (estado 'firing').
   * Isso garante que bolinhas que entrem na trajetória do raio depois do disparo
   * também sejam destruídas.
   */
  onBeamActive(origin: Vec2, direction: Vec2, timestamp: number): void {
    if (!this._active) return;
    this.applyBeamCollision(origin, direction, timestamp);
  }

  private applyBeamCollision(origin: Vec2, direction: Vec2, timestamp: number): void {
    const points = this.targetManager.applyBeamHit(origin, direction);
    if (points > 0) {
      const hitCount = this.targetManager
        .getTargets()
        .filter((t) => t.state === 'hit').length;
      this.scoreManager.addPoints(points, timestamp, Math.max(hitCount, 1));
    }
  }

  /**
   * Atualizado a cada frame pelo render loop do App.
   */
  update(
    deltaTime: number,
    canvasWidth: number,
    canvasHeight: number,
    timestamp: number
  ): void {
    if (!this._active) return;

    this.targetManager.update(deltaTime, canvasWidth, canvasHeight, timestamp);
    this.scoreManager.update(timestamp);

    // Verifica threshold de 5000 pts para ativar modo mabindu
    if (!this._mabinduMode && this.scoreManager.score >= MABINDU_SCORE_THRESHOLD) {
      this._mabinduMode = true;
      this.targetRenderer.setMabinduMode(true);
      this.playVouTeComer();
    }
  }

  /**
   * Renderiza alvos e HUD de pontuação.
   * Deve ser chamado depois do vídeo de fundo e dos efeitos do Kamehameha,
   * mas antes dos overlays de debug.
   */
  render(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
    if (!this._active) return;

    this.targetRenderer.render(ctx, this.targetManager.getTargets());
    this.scoreRenderer.render(ctx, this.scoreManager, canvasWidth);
  }

  /** Snapshot do estado atual para debug/UI */
  getState(): GameState {
    return {
      isActive: this._active,
      score: this.scoreManager.score,
      highScore: this.scoreManager.highScore,
      combo: this.scoreManager.combo,
      comboMultiplier: this.scoreManager.comboMultiplier,
      aliveTargets: this.targetManager.getAliveCount(),
      mabinduMode: this._mabinduMode,
    };
  }
}
