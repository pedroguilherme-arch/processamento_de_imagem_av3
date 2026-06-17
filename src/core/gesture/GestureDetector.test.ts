import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GestureDetector } from './GestureDetector';
import type { HandTrackingResult, GestureStateEvent, Landmark, HandData } from '../../shared/types';

// Helper to create a HandData with all landmarks at the same position
function createHandAtPosition(x: number, y: number): HandData {
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({
    x,
    y,
    z: 0,
  }));
  return { landmarks, handedness: 'right', confidence: 0.9 };
}

// Helper to create a HandTrackingResult with two hands at given positions
function createTwoHandsResult(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  timestamp: number
): HandTrackingResult {
  return {
    hands: [createHandAtPosition(x1, y1), createHandAtPosition(x2, y2)],
    timestamp,
  };
}

// Helper to create a result with no hands
function createNoHandsResult(timestamp: number): HandTrackingResult {
  return { hands: [], timestamp };
}

// Helper to create a result with one hand
function createOneHandResult(x: number, y: number, timestamp: number): HandTrackingResult {
  return { hands: [createHandAtPosition(x, y)], timestamp };
}

describe('GestureDetector', () => {
  let detector: GestureDetector;
  let stateChanges: GestureStateEvent[];

  beforeEach(() => {
    detector = new GestureDetector();
    stateChanges = [];
    detector.onStateChange((event) => stateChanges.push(event));
  });

  describe('initial state', () => {
    it('starts in idle state', () => {
      expect(detector.getState()).toBe('idle');
    });

    it('returns 0 charge time initially', () => {
      expect(detector.getChargeTime()).toBe(0);
    });
  });

  describe('idle → charging transition', () => {
    it('transitions to charging when both hands are close together', () => {
      // Distance between (0.5, 0.5) and (0.55, 0.5) in normalized coords
      // With 640px width, this would be ~32px which is < 100px threshold
      // But the analyzer works in normalized coords, so distance = 0.05
      // The threshold is 100 (pixels). Since landmarks are normalized [0,1],
      // we need to provide positions where distance < 100 in whatever unit the analyzer uses.
      // The GestureAnalyzer calculates distance in the same unit as the landmarks.
      // Since CHARGE_DISTANCE_THRESHOLD = 100 and landmarks are 0..1,
      // we need distance < 100. With normalized coords, distance will be < 1.
      // So any two hands close together will trigger charging.
      const result = createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000);
      detector.update(result);

      expect(detector.getState()).toBe('charging');
    });

    it('emits state change event on transition to charging', () => {
      const result = createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000);
      detector.update(result);

      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0].previousState).toBe('idle');
      expect(stateChanges[0].currentState).toBe('charging');
      expect(stateChanges[0].timestamp).toBe(1000);
      expect(stateChanges[0].data.handsCenterPosition).toBeDefined();
      expect(stateChanges[0].data.chargeTime).toBe(0);
    });

    it('does not transition when only one hand is detected', () => {
      const result = createOneHandResult(0.5, 0.5, 1000);
      detector.update(result);

      expect(detector.getState()).toBe('idle');
      expect(stateChanges).toHaveLength(0);
    });

    it('does not transition when no hands are detected', () => {
      const result = createNoHandsResult(1000);
      detector.update(result);

      expect(detector.getState()).toBe('idle');
      expect(stateChanges).toHaveLength(0);
    });

    it('does not transition when hands are far apart (distance >= threshold)', () => {
      // Distance = 200 which is >= CHARGE_DISTANCE_THRESHOLD (100)
      const result = createTwoHandsResult(0, 0, 200, 0, 1000);
      detector.update(result);

      expect(detector.getState()).toBe('idle');
      expect(stateChanges).toHaveLength(0);
    });

    it('provides correct center position in event data', () => {
      const result = createTwoHandsResult(0.4, 0.5, 0.6, 0.5, 1000);
      detector.update(result);

      expect(stateChanges[0].data.handsCenterPosition).toEqual({
        x: 0.5,
        y: 0.5,
      });
    });
  });

  describe('charging state behavior', () => {
    beforeEach(() => {
      // Enter charging state
      const result = createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000);
      detector.update(result);
      stateChanges = []; // Reset to track only subsequent events
    });

    it('reports correct charge time', () => {
      // Update with same position at a later time
      const result = createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1500);
      detector.update(result);

      expect(detector.getChargeTime()).toBe(500); // 1500 - 1000
    });

    it('accumulates charge time over multiple updates', () => {
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1200));
      expect(detector.getChargeTime()).toBe(200);

      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1800));
      expect(detector.getChargeTime()).toBe(800);
    });
  });

  describe('charging → firing transition', () => {
    it('transitions to firing when distance increases rapidly', () => {
      // Enter charging at t=1000 with distance ~0.01
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      stateChanges = [];

      // Rapidly increase distance by > FIRE_DISTANCE_INCREASE (150) in < FIRE_TIME_WINDOW (500ms)
      // Initial distance was ~0.01, need increase > 150
      // So new distance needs to be > 150.01
      detector.update(createTwoHandsResult(0, 0, 200, 0, 1200));

      expect(detector.getState()).toBe('firing');
      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0].previousState).toBe('charging');
      expect(stateChanges[0].currentState).toBe('firing');
    });

    it('includes firing direction in event data', () => {
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      stateChanges = [];

      // Hands separate horizontally
      detector.update(createTwoHandsResult(0, 0.5, 200, 0.5, 1200));

      expect(stateChanges[0].data.firingDirection).toBeDefined();
      expect(stateChanges[0].data.firingDirection!.x).toBeCloseTo(1);
      expect(stateChanges[0].data.firingDirection!.y).toBeCloseTo(0);
    });

    it('includes charge time in firing event data', () => {
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      stateChanges = [];

      detector.update(createTwoHandsResult(0, 0, 200, 0, 1300));

      expect(stateChanges[0].data.chargeTime).toBe(300); // 1300 - 1000
    });

    it('does not transition if time window exceeded', () => {
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      stateChanges = [];

      // Distance increase > 150 but time > 500ms
      detector.update(createTwoHandsResult(0, 0, 200, 0, 1600));

      // Should not fire because time window exceeded
      expect(detector.getState()).not.toBe('firing');
    });

    it('does not transition if distance increase is insufficient', () => {
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      stateChanges = [];

      // Distance increase < 150 (from ~0.01 to ~50)
      detector.update(createTwoHandsResult(0, 0, 50, 0, 1200));

      expect(detector.getState()).toBe('charging');
    });
  });

  describe('charging → idle transition (timeout)', () => {
    it('transitions to idle when no hands detected for > IDLE_TIMEOUT', () => {
      // Enter charging
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      stateChanges = [];

      // No hands for > 1000ms
      detector.update(createNoHandsResult(2100));

      expect(detector.getState()).toBe('idle');
      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0].previousState).toBe('charging');
      expect(stateChanges[0].currentState).toBe('idle');
    });

    it('does not transition if timeout not reached', () => {
      // Enter charging
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      stateChanges = [];

      // No hands but only 500ms elapsed (< 1000ms timeout)
      detector.update(createNoHandsResult(1500));

      expect(detector.getState()).toBe('charging');
      expect(stateChanges).toHaveLength(0);
    });

    it('resets charge time after transitioning to idle', () => {
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      detector.update(createNoHandsResult(2100));

      expect(detector.getChargeTime()).toBe(0);
    });
  });

  describe('charging → idle transition (distance without speed)', () => {
    it('transitions to idle when distance > 200 without rapid movement', () => {
      // Enter charging at t=1000
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      stateChanges = [];

      // Slowly drift apart to > 200px over a long time (> FIRE_TIME_WINDOW)
      // First update at t=1200 with moderate distance
      detector.update(createTwoHandsResult(0, 0, 100, 0, 1200));

      // Then at t=2000 (well past fire window) with distance > 200
      detector.update(createTwoHandsResult(0, 0, 250, 0, 2000));

      expect(detector.getState()).toBe('idle');
    });
  });

  describe('firing → idle transition', () => {
    beforeEach(() => {
      // Enter charging then firing
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      detector.update(createTwoHandsResult(0, 0, 200, 0, 1200));
      stateChanges = [];
    });

    it('transitions to idle after firing timeout (2s)', () => {
      // 2001ms after firing started (at t=1200)
      detector.update(createTwoHandsResult(0, 0, 200, 0, 3300));

      expect(detector.getState()).toBe('idle');
      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0].previousState).toBe('firing');
      expect(stateChanges[0].currentState).toBe('idle');
    });

    it('stays in firing before timeout', () => {
      // Only 1s after firing started
      detector.update(createTwoHandsResult(0, 0, 200, 0, 2200));

      expect(detector.getState()).toBe('firing');
      expect(stateChanges).toHaveLength(0);
    });

    it('transitions to idle when no hands detected for > IDLE_TIMEOUT', () => {
      // No hands for > 1000ms after last detection (at t=1200)
      detector.update(createNoHandsResult(2300));

      expect(detector.getState()).toBe('idle');
    });
  });

  describe('firing → charging transition', () => {
    beforeEach(() => {
      // Enter charging then firing
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      detector.update(createTwoHandsResult(0, 0, 200, 0, 1200));
      stateChanges = [];
    });

    it('transitions back to charging when hands come together', () => {
      // Hands come back close together
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1500));

      expect(detector.getState()).toBe('charging');
      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0].previousState).toBe('firing');
      expect(stateChanges[0].currentState).toBe('charging');
    });

    it('resets charge time when re-entering charging from firing', () => {
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1500));

      // Charge time should be 0 since we just entered charging
      expect(detector.getChargeTime()).toBe(0);

      // After another update, charge time should be relative to new start
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1800));
      expect(detector.getChargeTime()).toBe(300); // 1800 - 1500
    });
  });

  describe('callback management', () => {
    it('supports multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      detector.onStateChange(callback1);
      detector.onStateChange(callback2);

      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('passes correct event to callbacks', () => {
      const callback = vi.fn();
      detector.onStateChange(callback);

      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));

      const event = callback.mock.calls[0][0] as GestureStateEvent;
      expect(event.previousState).toBe('idle');
      expect(event.currentState).toBe('charging');
      expect(event.timestamp).toBe(1000);
      expect(event.data).toBeDefined();
    });
  });

  describe('full lifecycle', () => {
    it('completes idle → charging → firing → idle cycle', () => {
      // idle → charging
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      expect(detector.getState()).toBe('charging');

      // charging → firing (rapid separation)
      detector.update(createTwoHandsResult(0, 0, 200, 0, 1200));
      expect(detector.getState()).toBe('firing');

      // firing → idle (timeout)
      detector.update(createTwoHandsResult(0, 0, 200, 0, 3300));
      expect(detector.getState()).toBe('idle');

      expect(stateChanges).toHaveLength(3);
    });

    it('completes idle → charging → firing → charging → firing cycle', () => {
      // idle → charging
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      expect(detector.getState()).toBe('charging');

      // charging → firing
      detector.update(createTwoHandsResult(0, 0, 200, 0, 1200));
      expect(detector.getState()).toBe('firing');

      // firing → charging (hands come back)
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1500));
      expect(detector.getState()).toBe('charging');

      // charging → firing again
      detector.update(createTwoHandsResult(0, 0, 200, 0, 1700));
      expect(detector.getState()).toBe('firing');

      expect(stateChanges).toHaveLength(4);
    });
  });

  describe('getChargeTime()', () => {
    it('returns 0 when in idle state', () => {
      expect(detector.getChargeTime()).toBe(0);
    });

    it('returns 0 when in firing state', () => {
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      detector.update(createTwoHandsResult(0, 0, 200, 0, 1200));

      expect(detector.getState()).toBe('firing');
      expect(detector.getChargeTime()).toBe(0);
    });

    it('returns correct elapsed time in charging state', () => {
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1000));
      detector.update(createTwoHandsResult(0.5, 0.5, 0.51, 0.5, 1750));

      expect(detector.getChargeTime()).toBe(750);
    });
  });
});
