import { GESTURE_CONSTANTS } from '../../shared/constants';
import type { Vec2 } from '../../shared/math';
import type {
  GestureState,
  GestureStateEvent,
  GestureEventData,
  HandTrackingResult,
} from '../../shared/types';
import { GestureAnalyzer } from './GestureAnalyzer';
import type { IGestureAnalyzer } from './GestureAnalyzer';

export interface IGestureDetector {
  update(trackingResult: HandTrackingResult): void;
  getState(): GestureState;
  getChargeTime(): number;
  getChargeIntensity(): number;
  onStateChange(callback: (event: GestureStateEvent) => void): void;
}

/** Duração máxima do estado firing antes de voltar ao idle */
const FIRING_TIMEOUT = GESTURE_CONSTANTS.FIRING_TIMEOUT;

/**
 * GestureDetector — máquina de estados para o Kamehameha.
 *
 * Estados: idle → charging → firing → idle
 *
 * Transições:
 * - idle → charging:   ambas as mãos detectadas e distância < CHARGE_DISTANCE_THRESHOLD
 * - charging → firing: PUSH (mãos descem rapidamente enquanto permanecem juntas)
 *                      OU separação rápida (fallback)
 *                      Requer carga mínima de MIN_CHARGE_TO_FIRE
 * - charging → idle:   mãos somem por > IDLE_TIMEOUT ou drift lento além de DRIFT_CANCEL_DISTANCE
 * - firing → idle:     timeout de FIRING_TIMEOUT ms
 * - firing → charging: mãos voltam a ficar juntas
 *
 * Direção do feixe:
 * - No push, a direção é horizontal para frente (câmera) — {x:1, y:0} espelhado
 *   para a posição das mãos na tela.
 * - No fallback de separação, usa a direção entre as mãos.
 */
export class GestureDetector implements IGestureDetector {
  private state: GestureState = 'idle';
  private chargeStartTime: number | null = null;
  private lastHandsDetectedTime: number | null = null;
  private chargeStartDistance: number | null = null;
  private previousDistance: number | null = null;
  private previousCenter: Vec2 | null = null;
  private previousTimestamp: number | null = null;
  private firingStartTime: number | null = null;
  private callbacks: Array<(event: GestureStateEvent) => void> = [];
  private analyzer: IGestureAnalyzer;

  // Acumulador de velocidade de push (média móvel para suavizar)
  private pushSpeedBuffer: number[] = [];
  private readonly PUSH_BUFFER_SIZE = 4;

  constructor(analyzer?: IGestureAnalyzer) {
    this.analyzer = analyzer ?? new GestureAnalyzer();
  }

  update(trackingResult: HandTrackingResult): void {
    const { hands, timestamp } = trackingResult;
    const bothHandsDetected = hands.length >= 2;

    if (bothHandsDetected) {
      this.lastHandsDetectedTime = timestamp;
    }

    switch (this.state) {
      case 'idle':    this.handleIdle(hands, timestamp, bothHandsDetected);    break;
      case 'charging':this.handleCharging(hands, timestamp, bothHandsDetected);break;
      case 'firing':  this.handleFiring(hands, timestamp, bothHandsDetected);  break;
    }

    this.previousTimestamp = timestamp;
  }

  getState(): GestureState { return this.state; }

  getChargeTime(): number {
    if (this.state !== 'charging' || this.chargeStartTime === null) return 0;
    if (this.previousTimestamp === null) return 0;
    return this.previousTimestamp - this.chargeStartTime;
  }

  getChargeIntensity(): number {
    return Math.min(this.getChargeTime() / GESTURE_CONSTANTS.MAX_CHARGE_TIME, 1);
  }

  onStateChange(callback: (event: GestureStateEvent) => void): void {
    this.callbacks.push(callback);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers de estado
  // ─────────────────────────────────────────────────────────────────────────

  private handleIdle(
    hands: HandTrackingResult['hands'],
    timestamp: number,
    bothHandsDetected: boolean
  ): void {
    if (!bothHandsDetected) return;

    const distance = this.analyzer.calculateHandsDistance(hands[0], hands[1]);

    if (distance < GESTURE_CONSTANTS.CHARGE_DISTANCE_THRESHOLD) {
      const center = this.analyzer.calculateHandsCenter(hands[0], hands[1]);

      this.chargeStartTime = timestamp;
      this.chargeStartDistance = distance;
      this.previousDistance = distance;
      this.previousCenter = center;
      this.pushSpeedBuffer = [];

      this.transitionTo('charging', timestamp, {
        handsCenterPosition: center,
        chargeTime: 0,
      });
    }
  }

  private handleCharging(
    hands: HandTrackingResult['hands'],
    timestamp: number,
    bothHandsDetected: boolean
  ): void {
    // Sem mãos por tempo demais → idle
    if (!bothHandsDetected) {
      if (this.lastHandsDetectedTime !== null) {
        if (timestamp - this.lastHandsDetectedTime > GESTURE_CONSTANTS.IDLE_TIMEOUT) {
          this.resetState();
          this.transitionTo('idle', timestamp, { chargeTime: this.computeChargeTime(timestamp) });
        }
      }
      return;
    }

    const distance = this.analyzer.calculateHandsDistance(hands[0], hands[1]);
    const center   = this.analyzer.calculateHandsCenter(hands[0], hands[1]);
    const hand1Center = this.analyzer.calculateHandCenter(hands[0]);
    const hand2Center = this.analyzer.calculateHandCenter(hands[1]);

    const deltaTime = this.previousTimestamp !== null
      ? (timestamp - this.previousTimestamp) / 1000
      : 0;

    // ── Atualiza buffer de velocidade de push ────────────────────────────
    if (this.previousCenter !== null && deltaTime > 0) {
      const pushSpeed = this.analyzer.calculatePushSpeed(this.previousCenter, center, deltaTime);
      this.pushSpeedBuffer.push(pushSpeed);
      if (this.pushSpeedBuffer.length > this.PUSH_BUFFER_SIZE) {
        this.pushSpeedBuffer.shift();
      }
    }

    const chargeIntensity = this.getChargeIntensity();
    const hasMinCharge = chargeIntensity >= GESTURE_CONSTANTS.MIN_CHARGE_TO_FIRE;

    // ── Gesto 1: PUSH — mãos descem rapidamente enquanto permanecem juntas ─
    if (hasMinCharge && this.pushSpeedBuffer.length >= 2) {
      const avgPushSpeed = this.pushSpeedBuffer.reduce((a, b) => a + b, 0) / this.pushSpeedBuffer.length;

      if (
        avgPushSpeed > GESTURE_CONSTANTS.PUSH_Y_SPEED_THRESHOLD &&
        distance < GESTURE_CONSTANTS.PUSH_MAX_DISTANCE
      ) {
        const firingDirection = { x: 1, y: 0 };
        this.fireTo(timestamp, center, firingDirection, chargeIntensity);
        this.previousCenter = center;
        return;
      }
    }

    // ── Gesto 2: SEPARAÇÃO RÁPIDA (fallback) ────────────────────────────────
    if (hasMinCharge && this.chargeStartDistance !== null && this.chargeStartTime !== null) {
      const distanceIncrease = distance - this.chargeStartDistance;
      const timeElapsed = timestamp - this.chargeStartTime;

      if (
        distanceIncrease > GESTURE_CONSTANTS.FIRE_DISTANCE_INCREASE &&
        timeElapsed < GESTURE_CONSTANTS.FIRE_TIME_WINDOW
      ) {
        const firingDirection = this.analyzer.calculateFiringDirection(hand1Center, hand2Center);
        this.fireTo(timestamp, center, firingDirection, chargeIntensity);
        this.previousCenter = center;
        return;
      }
    }

    // ── Gesto 3: PUNHO FECHADO — fecha ao menos uma mão enquanto carregado ──
    // Disparo mais preciso: o jogador fecha uma ou ambas as mãos.
    if (hasMinCharge) {
      const closedCount = this.analyzer.countClosedHands(hands);
      if (closedCount >= 1) {
        const firingDirection = { x: 1, y: 0 };
        this.fireTo(timestamp, center, firingDirection, chargeIntensity);
        this.previousCenter = center;
        return;
      }
    }

    // ── Drift lento demais → cancela carga ──────────────────────────────────
    if (distance > GESTURE_CONSTANTS.DRIFT_CANCEL_DISTANCE) {
      const speed = this.previousDistance !== null && deltaTime > 0
        ? Math.abs(this.analyzer.calculateSeparationSpeed(this.previousDistance, distance, deltaTime))
        : 0;
      const slowThreshold = GESTURE_CONSTANTS.FIRE_DISTANCE_INCREASE / (GESTURE_CONSTANTS.FIRE_TIME_WINDOW / 1000);

      if (speed < slowThreshold) {
        this.resetState();
        this.transitionTo('idle', timestamp, {
          handsCenterPosition: center,
          chargeTime: this.computeChargeTime(timestamp),
        });
        this.previousDistance = distance;
        this.previousCenter = center;
        return;
      }
    }

    this.previousDistance = distance;
    this.previousCenter = center;
  }

  private handleFiring(
    hands: HandTrackingResult['hands'],
    timestamp: number,
    bothHandsDetected: boolean
  ): void {
    // Timeout do firing — reduzido para 1200ms para raio não ficar preso
    if (this.firingStartTime !== null && timestamp - this.firingStartTime > FIRING_TIMEOUT) {
      this.resetState();
      this.transitionTo('idle', timestamp, {});
      return;
    }

    if (!bothHandsDetected) {
      // Sem mãos visíveis → termina o firing imediatamente
      this.resetState();
      this.transitionTo('idle', timestamp, {});
      return;
    }

    const distance = this.analyzer.calculateHandsDistance(hands[0], hands[1]);

    // Mãos voltam a ficar juntas → volta a carregar
    if (distance < GESTURE_CONSTANTS.CHARGE_DISTANCE_THRESHOLD) {
      const center = this.analyzer.calculateHandsCenter(hands[0], hands[1]);
      this.chargeStartTime = timestamp;
      this.chargeStartDistance = distance;
      this.previousDistance = distance;
      this.previousCenter = center;
      this.firingStartTime = null;
      this.pushSpeedBuffer = [];

      this.transitionTo('charging', timestamp, {
        handsCenterPosition: center,
        chargeTime: 0,
      });
      return;
    }

    // Mãos separadas além de DRIFT_CANCEL_DISTANCE → termina o firing
    // (o jogador abaixou as mãos ou saiu da posição de disparo)
    if (distance > GESTURE_CONSTANTS.DRIFT_CANCEL_DISTANCE) {
      this.resetState();
      this.transitionTo('idle', timestamp, {});
      return;
    }

    this.previousDistance = distance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private fireTo(
    timestamp: number,
    center: Vec2,
    firingDirection: Vec2,
    _chargeIntensity: number
  ): void {
    const chargeTime = this.computeChargeTime(timestamp);
    this.firingStartTime = timestamp;
    this.chargeStartTime = null;
    this.chargeStartDistance = null;
    this.pushSpeedBuffer = [];

    this.transitionTo('firing', timestamp, {
      handsCenterPosition: center,
      chargeTime,
      firingDirection,
    });
  }

  private transitionTo(newState: GestureState, timestamp: number, data: GestureEventData): void {
    const previousState = this.state;
    this.state = newState;
    const event: GestureStateEvent = { previousState, currentState: newState, timestamp, data };
    for (const callback of this.callbacks) callback(event);
  }

  private computeChargeTime(timestamp: number): number {
    if (this.chargeStartTime === null) return 0;
    return timestamp - this.chargeStartTime;
  }

  private resetState(): void {
    this.chargeStartTime = null;
    this.chargeStartDistance = null;
    this.previousDistance = null;
    this.previousCenter = null;
    this.firingStartTime = null;
    this.pushSpeedBuffer = [];
  }
}
