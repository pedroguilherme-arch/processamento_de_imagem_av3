import type { GestureState } from '../../shared/types';

/**
 * Encapsula a lógica de estado do Kamehameha: intensidade, fase e duração.
 * chargeIntensity é um valor normalizado 0..1 baseado no tempo de carga.
 *
 * Requisitos: 4.4, 3.6
 */
export class KamehamehaState {
  private _phase: GestureState = 'idle';
  private _chargeStartTime: number | null = null;
  private _chargeIntensity: number = 0;

  /** Tempo máximo de carga para atingir intensidade 1.0 (ms) */
  private readonly maxChargeDuration: number;

  constructor(maxChargeDuration: number = 3000) {
    this.maxChargeDuration = maxChargeDuration;
  }

  get phase(): GestureState {
    return this._phase;
  }

  get chargeIntensity(): number {
    return this._chargeIntensity;
  }

  get chargeStartTime(): number | null {
    return this._chargeStartTime;
  }

  /**
   * Atualiza a fase do Kamehameha e recalcula a intensidade.
   */
  setPhase(phase: GestureState, timestamp: number): void {
    if (phase === 'charging' && this._phase !== 'charging') {
      this._chargeStartTime = timestamp;
      this._chargeIntensity = 0;
    } else if (phase !== 'charging') {
      this._chargeStartTime = null;
      if (phase === 'idle') {
        this._chargeIntensity = 0;
      }
    }
    this._phase = phase;
  }

  /**
   * Atualiza a intensidade de carga baseado no timestamp atual.
   * chargeIntensity = clamp((now - chargeStartTime) / maxChargeDuration, 0, 1)
   */
  update(currentTimestamp: number): void {
    if (this._phase === 'charging' && this._chargeStartTime !== null) {
      const elapsed = currentTimestamp - this._chargeStartTime;
      this._chargeIntensity = Math.min(Math.max(elapsed / this.maxChargeDuration, 0), 1);
    }
  }

  /**
   * Retorna o tempo de carga acumulado em milissegundos.
   * Requisito 3.6: chargeTime = (timestamp_atual - chargeStartTime)
   */
  getChargeTime(currentTimestamp: number): number {
    if (this._phase !== 'charging' || this._chargeStartTime === null) {
      return 0;
    }
    return currentTimestamp - this._chargeStartTime;
  }

  /**
   * Reseta o estado para idle.
   */
  reset(): void {
    this._phase = 'idle';
    this._chargeStartTime = null;
    this._chargeIntensity = 0;
  }
}
