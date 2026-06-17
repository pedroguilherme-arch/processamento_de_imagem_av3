import { distance2D, normalize2D } from '../../shared/math';
import type { Vec2 } from '../../shared/math';
import type { HandData } from '../../shared/types';

export interface IGestureAnalyzer {
  calculateHandsDistance(hand1: HandData, hand2: HandData): number;
  calculateHandCenter(hand: HandData): Vec2;
  calculateHandsCenter(hand1: HandData, hand2: HandData): Vec2;
  calculateSeparationSpeed(prevDistance: number, currentDistance: number, deltaTime: number): number;
  calculateFiringDirection(hand1Center: Vec2, hand2Center: Vec2): Vec2;
  calculatePushSpeed(prevCenter: Vec2, currentCenter: Vec2, deltaTime: number): number;
  isHandClosed(hand: HandData): boolean;
  countClosedHands(hands: HandData[]): number;
}

export class GestureAnalyzer implements IGestureAnalyzer {
  calculateHandsDistance(hand1: HandData, hand2: HandData): number {
    const center1 = this.calculateHandCenter(hand1);
    const center2 = this.calculateHandCenter(hand2);
    return distance2D(center1, center2);
  }

  calculateHandCenter(hand: HandData): Vec2 {
    const landmarks = hand.landmarks;
    const count = landmarks.length;
    if (count === 0) return { x: 0, y: 0 };
    let sumX = 0, sumY = 0;
    for (const lm of landmarks) { sumX += lm.x; sumY += lm.y; }
    return { x: sumX / count, y: sumY / count };
  }

  /** Centro médio entre as duas mãos */
  calculateHandsCenter(hand1: HandData, hand2: HandData): Vec2 {
    const c1 = this.calculateHandCenter(hand1);
    const c2 = this.calculateHandCenter(hand2);
    return { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
  }

  calculateSeparationSpeed(prevDistance: number, currentDistance: number, deltaTime: number): number {
    if (deltaTime === 0) return 0;
    return (currentDistance - prevDistance) / deltaTime;
  }

  calculateFiringDirection(hand1Center: Vec2, hand2Center: Vec2): Vec2 {
    const direction: Vec2 = {
      x: hand2Center.x - hand1Center.x,
      y: hand2Center.y - hand1Center.y,
    };
    return normalize2D(direction);
  }

  /**
   * Calcula a velocidade de movimento descendente do centro das mãos (px/s).
   * Positivo = mãos descendo (push para frente no gesto do Kamehameha).
   */
  calculatePushSpeed(prevCenter: Vec2, currentCenter: Vec2, deltaTime: number): number {
    if (deltaTime === 0) return 0;
    // Y aumenta para baixo na tela — push = mãos descendo = deltaY positivo
    const deltaY = currentCenter.y - prevCenter.y;
    return deltaY / deltaTime; // px/s
  }

  /**
   * Detecta se uma mão está fechada em punho.
   *
   * Estratégia: compara a distância da ponta de cada dedo (landmarks 8, 12, 16, 20)
   * em relação à sua base (knuckle — landmarks 5, 9, 13, 17).
   * Se a maioria das pontas estiver mais perto do pulso do que das bases,
   * a mão está fechada.
   *
   * Landmarks MediaPipe:
   *   0  = pulso
   *   5, 9, 13, 17 = base dos dedos (MCP)
   *   8, 12, 16, 20 = ponta dos dedos
   *   4  = ponta do polegar
   */
  isHandClosed(hand: HandData): boolean {
    const lm = hand.landmarks;
    if (lm.length < 21) return false;

    const wrist = lm[0]!;

    // Pares [ponta, base] para os 4 dedos (exclui polegar — menos confiável)
    const fingerPairs: [number, number][] = [
      [8, 5],   // indicador
      [12, 9],  // médio
      [16, 13], // anelar
      [20, 17], // mindinho
    ];

    let closedCount = 0;
    for (const [tipIdx, baseIdx] of fingerPairs) {
      const tip  = lm[tipIdx]!;
      const base = lm[baseIdx]!;

      // Dedo fechado: ponta mais perto do pulso do que a base.
      // Threshold 1.1 = tolerante — a ponta pode estar até 10% mais longe
      // do que a base e ainda contar como "dobrado".
      const tipToWrist  = distance2D(tip,  wrist);
      const baseToWrist = distance2D(base, wrist);

      if (tipToWrist < baseToWrist * 1.1) {
        closedCount++;
      }
    }

    // Mão fechada se pelo menos 2 dos 4 dedos estiverem dobrados
    return closedCount >= 2;
  }

  /**
   * Conta quantas mãos estão fechadas em punho num array de mãos.
   */
  countClosedHands(hands: HandData[]): number {
    return hands.filter((h) => this.isHandClosed(h)).length;
  }
}
