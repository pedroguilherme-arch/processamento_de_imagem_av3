import type { HandTrackingResult, HandData } from '../../shared/types';
import { GESTURE_CONSTANTS } from '../../shared/constants';

/**
 * Encapsula dados de rastreamento com filtros de confiança.
 * Filtra resultados com confiança abaixo de MIN_CONFIDENCE (0.7).
 *
 * Requisitos: 2.2, 2.3, 2.5
 */
export class TrackingData {
  private _lastResult: HandTrackingResult | null = null;

  get lastResult(): HandTrackingResult | null {
    return this._lastResult;
  }

  /**
   * Processa um HandTrackingResult, filtrando mãos com confiança
   * abaixo do limiar MIN_CONFIDENCE.
   */
  update(result: HandTrackingResult): HandTrackingResult {
    const filtered: HandTrackingResult = {
      hands: result.hands.filter(
        (hand) => hand.confidence >= GESTURE_CONSTANTS.MIN_CONFIDENCE
      ),
      timestamp: result.timestamp,
    };
    this._lastResult = filtered;
    return filtered;
  }

  /**
   * Retorna as mãos filtradas do último resultado, ou array vazio.
   */
  getFilteredHands(): HandData[] {
    return this._lastResult?.hands ?? [];
  }

  /**
   * Retorna true se há pelo menos uma mão detectada com confiança suficiente.
   */
  hasHands(): boolean {
    return this.getFilteredHands().length > 0;
  }

  /**
   * Retorna true se ambas as mãos estão detectadas com confiança suficiente.
   */
  hasBothHands(): boolean {
    return this.getFilteredHands().length >= 2;
  }

  /**
   * Reseta os dados de rastreamento.
   */
  reset(): void {
    this._lastResult = null;
  }
}
