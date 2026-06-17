import { describe, it, expect, beforeEach } from 'vitest';
import { EffectsCoordinator } from './EffectsCoordinator';
import type { GestureStateEvent } from '../../shared/types';
import { RENDER_CONSTANTS } from '../../shared/constants';

// Helper to create a GestureStateEvent for idle → charging
function createChargingEvent(
  centerX: number,
  centerY: number,
  chargeTime: number = 0,
  timestamp: number = 1000
): GestureStateEvent {
  return {
    previousState: 'idle',
    currentState: 'charging',
    timestamp,
    data: {
      handsCenterPosition: { x: centerX, y: centerY },
      chargeTime,
    },
  };
}

// Helper to create a GestureStateEvent for charging → firing
function createFiringEvent(
  centerX: number,
  centerY: number,
  dirX: number,
  dirY: number,
  chargeTime: number = 1000,
  timestamp: number = 2000
): GestureStateEvent {
  return {
    previousState: 'charging',
    currentState: 'firing',
    timestamp,
    data: {
      handsCenterPosition: { x: centerX, y: centerY },
      chargeTime,
      firingDirection: { x: dirX, y: dirY },
      separationSpeed: 300,
    },
  };
}

// Helper to create a GestureStateEvent for → idle
function createIdleEvent(timestamp: number = 3000): GestureStateEvent {
  return {
    previousState: 'firing',
    currentState: 'idle',
    timestamp,
    data: {},
  };
}

describe('EffectsCoordinator', () => {
  let coordinator: EffectsCoordinator;

  beforeEach(() => {
    coordinator = new EffectsCoordinator();
  });

  describe('initial state', () => {
    it('returns empty effects initially', () => {
      const effects = coordinator.getCurrentEffects();

      expect(effects.particles).toEqual([]);
      expect(effects.beam).toBeNull();
      expect(effects.glow).toBeNull();
      expect(effects.flash).toBeNull();
      expect(effects.shake).toBeNull();
    });
  });

  describe('charging state', () => {
    it('generates particles with direction "converge" during charging', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5));

      const effects = coordinator.getCurrentEffects();

      expect(effects.particles.length).toBeGreaterThan(0);
      expect(effects.particles[0].direction).toBe('converge');
    });

    it('sets particle target to the center point between hands', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.4, 0.6));

      const effects = coordinator.getCurrentEffects();

      expect(effects.particles[0].target).toEqual({ x: 0.4, y: 0.6, z: 0 });
    });

    it('positions particles at the center point', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.3, 0.7));

      const effects = coordinator.getCurrentEffects();

      expect(effects.particles[0].position).toEqual({ x: 0.3, y: 0.7, z: 0 });
    });

    it('generates glow positioned at center between hands', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5));

      const effects = coordinator.getCurrentEffects();

      expect(effects.glow).not.toBeNull();
      expect(effects.glow!.position).toEqual({ x: 0.5, y: 0.5 });
    });

    it('does not generate beam during charging', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5));

      const effects = coordinator.getCurrentEffects();

      expect(effects.beam).toBeNull();
    });

    it('does not generate flash or shake during charging', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5));

      const effects = coordinator.getCurrentEffects();

      expect(effects.flash).toBeNull();
      expect(effects.shake).toBeNull();
    });
  });

  describe('intensity calculation', () => {
    it('intensity is 0 when chargeTime is 0', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 0));

      const effects = coordinator.getCurrentEffects();

      expect(effects.glow!.intensity).toBe(0);
    });

    it('intensity increases with chargeTime', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 1500));

      const effects = coordinator.getCurrentEffects();

      expect(effects.glow!.intensity).toBe(0.5);
    });

    it('intensity is clamped to 1 at max charge time (3000ms)', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 3000));

      const effects = coordinator.getCurrentEffects();

      expect(effects.glow!.intensity).toBe(1);
    });

    it('intensity does not exceed 1 beyond max charge time', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 5000));

      const effects = coordinator.getCurrentEffects();

      expect(effects.glow!.intensity).toBe(1);
    });

    it('intensity is monotonically increasing with update()', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 0));

      const intensities: number[] = [];

      for (let i = 0; i < 10; i++) {
        coordinator.update(100); // 100ms increments
        const effects = coordinator.getCurrentEffects();
        intensities.push(effects.glow!.intensity);
      }

      // Verify monotonically increasing
      for (let i = 1; i < intensities.length; i++) {
        expect(intensities[i]).toBeGreaterThanOrEqual(intensities[i - 1]);
      }
    });
  });

  describe('firing state', () => {
    it('generates flash with 100ms duration on transition to firing', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 1000));
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0));

      const effects = coordinator.getCurrentEffects();

      expect(effects.flash).not.toBeNull();
      expect(effects.flash!.duration).toBe(RENDER_CONSTANTS.FLASH_DURATION);
      expect(effects.flash!.opacity).toBe(0.8);
    });

    it('generates shake with 300ms duration on transition to firing', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 1000));
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0));

      const effects = coordinator.getCurrentEffects();

      expect(effects.shake).not.toBeNull();
      expect(effects.shake!.duration).toBe(RENDER_CONSTANTS.SHAKE_DURATION);
    });

    it('shake intensity is based on charge time', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 1500));
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0, 1500));

      const effects = coordinator.getCurrentEffects();

      // intensity = clamp(1500 / 3000, 0, 1) = 0.5
      expect(effects.shake!.intensity).toBe(0.5);
    });

    it('generates beam config with firing direction', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 1000));
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 0.7, 0.3, 1000));

      const effects = coordinator.getCurrentEffects();

      expect(effects.beam).not.toBeNull();
      expect(effects.beam!.direction).toEqual({ x: 0.7, y: 0.3 });
    });

    it('beam origin is at the hands center position', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.4, 0.6, 1000));
      coordinator.onGestureStateChange(createFiringEvent(0.4, 0.6, 1, 0, 1000));

      const effects = coordinator.getCurrentEffects();

      expect(effects.beam!.origin).toEqual({ x: 0.4, y: 0.6 });
    });

    it('clears glow and particles on firing', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 1000));
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0, 1000));

      const effects = coordinator.getCurrentEffects();

      expect(effects.glow).toBeNull();
      expect(effects.particles).toEqual([]);
    });
  });

  describe('update() - timer management', () => {
    it('decrements flash duration over time', () => {
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0));

      coordinator.update(50);
      const effects = coordinator.getCurrentEffects();

      expect(effects.flash).not.toBeNull();
      expect(effects.flash!.duration).toBe(50); // 100 - 50
    });

    it('removes flash when duration reaches 0', () => {
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0));

      coordinator.update(100);
      const effects = coordinator.getCurrentEffects();

      expect(effects.flash).toBeNull();
    });

    it('removes flash when duration goes below 0', () => {
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0));

      coordinator.update(150);
      const effects = coordinator.getCurrentEffects();

      expect(effects.flash).toBeNull();
    });

    it('decrements shake duration over time', () => {
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0));

      coordinator.update(100);
      const effects = coordinator.getCurrentEffects();

      expect(effects.shake).not.toBeNull();
      expect(effects.shake!.duration).toBe(200); // 300 - 100
    });

    it('removes shake when duration reaches 0', () => {
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0));

      coordinator.update(300);
      const effects = coordinator.getCurrentEffects();

      expect(effects.shake).toBeNull();
    });

    it('flash expires before shake (100ms vs 300ms)', () => {
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0));

      coordinator.update(100);
      let effects = coordinator.getCurrentEffects();
      expect(effects.flash).toBeNull();
      expect(effects.shake).not.toBeNull();

      coordinator.update(200);
      effects = coordinator.getCurrentEffects();
      expect(effects.shake).toBeNull();
    });
  });

  describe('idle state', () => {
    it('clears all effects on transition to idle', () => {
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 1000));
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0, 1000));
      coordinator.onGestureStateChange(createIdleEvent());

      const effects = coordinator.getCurrentEffects();

      expect(effects.particles).toEqual([]);
      expect(effects.beam).toBeNull();
      expect(effects.glow).toBeNull();
    });
  });

  describe('full lifecycle', () => {
    it('produces correct effects through idle → charging → firing → idle', () => {
      // Start idle - no effects
      let effects = coordinator.getCurrentEffects();
      expect(effects.particles).toEqual([]);
      expect(effects.beam).toBeNull();

      // Transition to charging
      coordinator.onGestureStateChange(createChargingEvent(0.5, 0.5, 0));
      effects = coordinator.getCurrentEffects();
      expect(effects.particles.length).toBeGreaterThan(0);
      expect(effects.particles[0].direction).toBe('converge');
      expect(effects.glow).not.toBeNull();
      expect(effects.beam).toBeNull();

      // Simulate charge time accumulation
      coordinator.update(1500);
      effects = coordinator.getCurrentEffects();
      expect(effects.glow!.intensity).toBe(0.5);

      // Transition to firing
      coordinator.onGestureStateChange(createFiringEvent(0.5, 0.5, 1, 0, 1500));
      effects = coordinator.getCurrentEffects();
      expect(effects.beam).not.toBeNull();
      expect(effects.flash).not.toBeNull();
      expect(effects.shake).not.toBeNull();
      expect(effects.glow).toBeNull();
      expect(effects.particles).toEqual([]);

      // After flash expires
      coordinator.update(100);
      effects = coordinator.getCurrentEffects();
      expect(effects.flash).toBeNull();
      expect(effects.shake).not.toBeNull();

      // After shake expires
      coordinator.update(200);
      effects = coordinator.getCurrentEffects();
      expect(effects.shake).toBeNull();

      // Transition to idle
      coordinator.onGestureStateChange(createIdleEvent());
      effects = coordinator.getCurrentEffects();
      expect(effects.beam).toBeNull();
      expect(effects.particles).toEqual([]);
    });
  });
});
