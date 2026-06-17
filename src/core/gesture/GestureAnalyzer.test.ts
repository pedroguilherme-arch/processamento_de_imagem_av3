import { describe, it, expect } from 'vitest';
import { GestureAnalyzer } from './GestureAnalyzer';
import type { HandData, Landmark } from '../../shared/types';
import type { Vec2 } from '../../shared/math';

// Helper to create a HandData with all landmarks at the same position
function createHandAtPosition(x: number, y: number): HandData {
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({
    x,
    y,
    z: 0,
  }));
  return { landmarks, handedness: 'right', confidence: 0.9 };
}

// Helper to create a HandData with specific landmarks
function createHandWithLandmarks(landmarks: Landmark[]): HandData {
  return { landmarks, handedness: 'right', confidence: 0.9 };
}

describe('GestureAnalyzer', () => {
  const analyzer = new GestureAnalyzer();

  describe('calculateHandCenter()', () => {
    it('returns the average of all landmark positions', () => {
      const landmarks: Landmark[] = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0.5, y: 0.5, z: 0 },
      ];
      const hand = createHandWithLandmarks(landmarks);

      const center = analyzer.calculateHandCenter(hand);

      expect(center.x).toBeCloseTo(0.5);
      expect(center.y).toBeCloseTo(0.5);
    });

    it('returns the position when all landmarks are at the same point', () => {
      const hand = createHandAtPosition(0.3, 0.7);

      const center = analyzer.calculateHandCenter(hand);

      expect(center.x).toBeCloseTo(0.3);
      expect(center.y).toBeCloseTo(0.7);
    });

    it('returns (0, 0) for empty landmarks', () => {
      const hand = createHandWithLandmarks([]);

      const center = analyzer.calculateHandCenter(hand);

      expect(center.x).toBe(0);
      expect(center.y).toBe(0);
    });

    it('correctly averages 21 landmarks', () => {
      // Landmarks from 0 to 1 in steps of 0.05
      const landmarks: Landmark[] = Array.from({ length: 21 }, (_, i) => ({
        x: i / 20,
        y: i / 20,
        z: 0,
      }));
      const hand = createHandWithLandmarks(landmarks);

      const center = analyzer.calculateHandCenter(hand);

      // Average of 0, 0.05, 0.1, ..., 1.0 = sum(0..20)/20 / 21 = (21*20/2)/(20*21) = 0.5
      expect(center.x).toBeCloseTo(0.5);
      expect(center.y).toBeCloseTo(0.5);
    });
  });

  describe('calculateHandsDistance()', () => {
    it('returns 0 when both hands are at the same position', () => {
      const hand1 = createHandAtPosition(0.5, 0.5);
      const hand2 = createHandAtPosition(0.5, 0.5);

      const distance = analyzer.calculateHandsDistance(hand1, hand2);

      expect(distance).toBeCloseTo(0);
    });

    it('returns correct euclidean distance for horizontal separation', () => {
      const hand1 = createHandAtPosition(0.2, 0.5);
      const hand2 = createHandAtPosition(0.5, 0.5);

      const distance = analyzer.calculateHandsDistance(hand1, hand2);

      expect(distance).toBeCloseTo(0.3);
    });

    it('returns correct euclidean distance for vertical separation', () => {
      const hand1 = createHandAtPosition(0.5, 0.2);
      const hand2 = createHandAtPosition(0.5, 0.8);

      const distance = analyzer.calculateHandsDistance(hand1, hand2);

      expect(distance).toBeCloseTo(0.6);
    });

    it('returns correct euclidean distance for diagonal separation', () => {
      const hand1 = createHandAtPosition(0, 0);
      const hand2 = createHandAtPosition(0.3, 0.4);

      const distance = analyzer.calculateHandsDistance(hand1, hand2);

      // √(0.3² + 0.4²) = √(0.09 + 0.16) = √0.25 = 0.5
      expect(distance).toBeCloseTo(0.5);
    });

    it('uses center of landmarks, not individual points', () => {
      // Hand1: landmarks spread around (0.2, 0.2)
      const landmarks1: Landmark[] = Array.from({ length: 21 }, (_, i) => ({
        x: 0.2 + (i % 2 === 0 ? 0.01 : -0.01),
        y: 0.2 + (i % 2 === 0 ? 0.01 : -0.01),
        z: 0,
      }));
      // Hand2: landmarks spread around (0.8, 0.8)
      const landmarks2: Landmark[] = Array.from({ length: 21 }, (_, i) => ({
        x: 0.8 + (i % 2 === 0 ? 0.01 : -0.01),
        y: 0.8 + (i % 2 === 0 ? 0.01 : -0.01),
        z: 0,
      }));

      const hand1 = createHandWithLandmarks(landmarks1);
      const hand2 = createHandWithLandmarks(landmarks2);

      const distance = analyzer.calculateHandsDistance(hand1, hand2);

      // Centers should be approximately (0.2, 0.2) and (0.8, 0.8)
      // Distance ≈ √(0.6² + 0.6²) ≈ 0.8485
      expect(distance).toBeCloseTo(Math.sqrt(0.6 * 0.6 + 0.6 * 0.6), 1);
    });
  });

  describe('calculateSeparationSpeed()', () => {
    it('returns positive speed when distance increases', () => {
      const speed = analyzer.calculateSeparationSpeed(100, 200, 1);

      expect(speed).toBe(100);
    });

    it('returns negative speed when distance decreases', () => {
      const speed = analyzer.calculateSeparationSpeed(200, 100, 1);

      expect(speed).toBe(-100);
    });

    it('returns 0 when distance stays the same', () => {
      const speed = analyzer.calculateSeparationSpeed(150, 150, 1);

      expect(speed).toBe(0);
    });

    it('correctly divides by deltaTime', () => {
      // 100px increase over 0.5 seconds = 200 px/s
      const speed = analyzer.calculateSeparationSpeed(100, 200, 0.5);

      expect(speed).toBe(200);
    });

    it('returns 0 when deltaTime is 0', () => {
      const speed = analyzer.calculateSeparationSpeed(100, 200, 0);

      expect(speed).toBe(0);
    });

    it('handles fractional values', () => {
      const speed = analyzer.calculateSeparationSpeed(0.1, 0.4, 0.1);

      expect(speed).toBeCloseTo(3);
    });
  });

  describe('calculateFiringDirection()', () => {
    it('returns normalized direction from hand1 to hand2 (horizontal)', () => {
      const hand1Center: Vec2 = { x: 0.2, y: 0.5 };
      const hand2Center: Vec2 = { x: 0.8, y: 0.5 };

      const direction = analyzer.calculateFiringDirection(hand1Center, hand2Center);

      expect(direction.x).toBeCloseTo(1);
      expect(direction.y).toBeCloseTo(0);
    });

    it('returns normalized direction from hand1 to hand2 (vertical)', () => {
      const hand1Center: Vec2 = { x: 0.5, y: 0.2 };
      const hand2Center: Vec2 = { x: 0.5, y: 0.8 };

      const direction = analyzer.calculateFiringDirection(hand1Center, hand2Center);

      expect(direction.x).toBeCloseTo(0);
      expect(direction.y).toBeCloseTo(1);
    });

    it('returns normalized direction for diagonal', () => {
      const hand1Center: Vec2 = { x: 0, y: 0 };
      const hand2Center: Vec2 = { x: 1, y: 1 };

      const direction = analyzer.calculateFiringDirection(hand1Center, hand2Center);

      const expected = 1 / Math.sqrt(2);
      expect(direction.x).toBeCloseTo(expected);
      expect(direction.y).toBeCloseTo(expected);
    });

    it('returns unit vector (magnitude ≈ 1)', () => {
      const hand1Center: Vec2 = { x: 0.1, y: 0.3 };
      const hand2Center: Vec2 = { x: 0.7, y: 0.9 };

      const direction = analyzer.calculateFiringDirection(hand1Center, hand2Center);

      const magnitude = Math.sqrt(direction.x ** 2 + direction.y ** 2);
      expect(magnitude).toBeCloseTo(1);
    });

    it('returns zero vector when both centers are the same', () => {
      const center: Vec2 = { x: 0.5, y: 0.5 };

      const direction = analyzer.calculateFiringDirection(center, center);

      expect(direction.x).toBe(0);
      expect(direction.y).toBe(0);
    });

    it('handles negative direction (hand2 to the left of hand1)', () => {
      const hand1Center: Vec2 = { x: 0.8, y: 0.5 };
      const hand2Center: Vec2 = { x: 0.2, y: 0.5 };

      const direction = analyzer.calculateFiringDirection(hand1Center, hand2Center);

      expect(direction.x).toBeCloseTo(-1);
      expect(direction.y).toBeCloseTo(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isHandClosed e countClosedHands — detecção de punho fechado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria uma mão com landmarks posicionados como punho FECHADO.
 * Pulso em (500, 400), knuckles na metade, pontas próximas do pulso.
 *
 * Landmarks MediaPipe (os relevantes):
 *   0  = pulso
 *   5, 9, 13, 17 = base dos dedos (MCP) — mais longe do pulso
 *   8, 12, 16, 20 = pontas dos dedos   — próximas do pulso quando fechado
 */
function createClosedFistHand(): HandData {
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({
    x: 500, y: 400, z: 0,
  }));

  // Pulso
  landmarks[0] = { x: 500, y: 400, z: 0 };

  // Bases dos dedos (knuckles) — longe do pulso
  landmarks[5]  = { x: 500, y: 300, z: 0 }; // indicador base
  landmarks[9]  = { x: 510, y: 300, z: 0 }; // médio base
  landmarks[13] = { x: 520, y: 300, z: 0 }; // anelar base
  landmarks[17] = { x: 530, y: 300, z: 0 }; // mindinho base

  // Pontas dos dedos — perto do pulso (dobradas)
  landmarks[8]  = { x: 500, y: 380, z: 0 }; // indicador ponta
  landmarks[12] = { x: 510, y: 380, z: 0 }; // médio ponta
  landmarks[16] = { x: 520, y: 380, z: 0 }; // anelar ponta
  landmarks[20] = { x: 530, y: 380, z: 0 }; // mindinho ponta

  return { landmarks, handedness: 'right', confidence: 0.9 };
}

/**
 * Cria uma mão com landmarks posicionados como mão ABERTA.
 * Pulso em (500, 400), pontas dos dedos bem acima do pulso.
 */
function createOpenHand(): HandData {
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({
    x: 500, y: 400, z: 0,
  }));

  // Pulso
  landmarks[0] = { x: 500, y: 400, z: 0 };

  // Bases dos dedos (knuckles)
  landmarks[5]  = { x: 500, y: 350, z: 0 };
  landmarks[9]  = { x: 510, y: 350, z: 0 };
  landmarks[13] = { x: 520, y: 350, z: 0 };
  landmarks[17] = { x: 530, y: 350, z: 0 };

  // Pontas dos dedos — bem mais longe do pulso do que as bases
  landmarks[8]  = { x: 500, y: 200, z: 0 };
  landmarks[12] = { x: 510, y: 200, z: 0 };
  landmarks[16] = { x: 520, y: 200, z: 0 };
  landmarks[20] = { x: 530, y: 200, z: 0 };

  return { landmarks, handedness: 'right', confidence: 0.9 };
}

describe('GestureAnalyzer — isHandClosed()', () => {
  const analyzer = new GestureAnalyzer();

  it('retorna true para punho fechado', () => {
    const hand = createClosedFistHand();
    expect(analyzer.isHandClosed(hand)).toBe(true);
  });

  it('retorna false para mão aberta', () => {
    const hand = createOpenHand();
    expect(analyzer.isHandClosed(hand)).toBe(false);
  });

  it('retorna false para mão com menos de 21 landmarks', () => {
    const hand: HandData = {
      landmarks: Array.from({ length: 10 }, () => ({ x: 0, y: 0, z: 0 })),
      handedness: 'right',
      confidence: 0.9,
    };
    expect(analyzer.isHandClosed(hand)).toBe(false);
  });

  it('retorna false para mão com todos os landmarks no mesmo ponto (ambíguo → não dispara)', () => {
    // Todos no mesmo lugar: tipToWrist = baseToWrist = 0
    // 0 < 0 * 1.1 = 0 < 0 = false → closedCount = 0 → isHandClosed = false
    const hand = createHandAtPosition(500, 400);
    expect(analyzer.isHandClosed(hand)).toBe(false);
  });
});

describe('GestureAnalyzer — countClosedHands()', () => {
  const analyzer = new GestureAnalyzer();

  it('retorna 0 para array vazio', () => {
    expect(analyzer.countClosedHands([])).toBe(0);
  });

  it('retorna 0 quando nenhuma mão está fechada', () => {
    const hands = [createOpenHand(), createOpenHand()];
    expect(analyzer.countClosedHands(hands)).toBe(0);
  });

  it('retorna 1 quando uma mão está fechada', () => {
    const hands = [createClosedFistHand(), createOpenHand()];
    expect(analyzer.countClosedHands(hands)).toBe(1);
  });

  it('retorna 2 quando ambas as mãos estão fechadas', () => {
    const hands = [createClosedFistHand(), createClosedFistHand()];
    expect(analyzer.countClosedHands(hands)).toBe(2);
  });
});
