/**
 * ScoreManager — gerencia pontuação, combos e high-score da sessão.
 *
 * Sistema de combo:
 * - Cada alvo atingido dentro de COMBO_WINDOW_MS do anterior incrementa o combo
 * - O multiplicador de combo é: floor(combo / 3) + 1 (sobe a cada 3 hits seguidos)
 * - Ficar sem acertar por COMBO_WINDOW_MS reseta o combo
 */
export class ScoreManager {
  private _score: number = 0;
  private _highScore: number = 0;
  private _combo: number = 0;
  private _lastHitTime: number | null = null;
  private _totalHits: number = 0;

  /** Janela de tempo (ms) para manter o combo ativo */
  private readonly COMBO_WINDOW_MS = 3000;

  get score(): number {
    return this._score;
  }

  get highScore(): number {
    return this._highScore;
  }

  get combo(): number {
    return this._combo;
  }

  get totalHits(): number {
    return this._totalHits;
  }

  /**
   * Retorna o multiplicador de pontos baseado no combo atual.
   * combo 0-2 → ×1, 3-5 → ×2, 6-8 → ×3, etc.
   */
  get comboMultiplier(): number {
    return Math.floor(this._combo / 3) + 1;
  }

  /**
   * Registra uma quantidade de pontos ganhos ao acertar alvos.
   * Aplica o multiplicador de combo e atualiza o high-score.
   *
   * @param basePoints pontos base (soma dos alvos atingidos)
   * @param timestamp  timestamp atual (ms) para controle do combo
   * @param hitCount   número de alvos atingidos neste disparo
   */
  addPoints(basePoints: number, timestamp: number, hitCount: number = 1): void {
    if (basePoints <= 0 || hitCount <= 0) return;

    // Verifica se o combo ainda está ativo
    if (
      this._lastHitTime !== null &&
      timestamp - this._lastHitTime > this.COMBO_WINDOW_MS
    ) {
      this._combo = 0;
    }

    this._combo += hitCount;
    this._lastHitTime = timestamp;
    this._totalHits += hitCount;

    const finalPoints = basePoints * this.comboMultiplier;
    this._score += finalPoints;

    if (this._score > this._highScore) {
      this._highScore = this._score;
    }
  }

  /**
   * Atualiza o manager a cada frame para expirar o combo se necessário.
   */
  update(timestamp: number): void {
    if (
      this._combo > 0 &&
      this._lastHitTime !== null &&
      timestamp - this._lastHitTime > this.COMBO_WINDOW_MS
    ) {
      this._combo = 0;
    }
  }

  /**
   * Reseta a pontuação e combo para uma nova partida.
   * Mantém o high-score.
   */
  reset(): void {
    this._score = 0;
    this._combo = 0;
    this._lastHitTime = null;
    this._totalHits = 0;
  }
}
