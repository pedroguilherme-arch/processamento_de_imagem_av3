import { RENDER_CONSTANTS } from '../../shared/constants';
import { clamp } from '../../shared/math';
import type { Vec2, Vec3, Color } from '../../shared/math';
import type { GestureStateEvent } from '../../shared/types';

/**
 * Configuration for particle emission.
 */
export interface ParticleEmitConfig {
  position: Vec3;
  count: number;
  color: Color;
  speed: number;
  lifetime: number;
  direction: 'converge' | 'diverge' | 'radial';
  target?: Vec3;
}

/**
 * Configuration for the energy beam.
 */
export interface BeamConfig {
  origin: Vec2;
  direction: Vec2;
  intensity: number;
  width: number;
}

/**
 * Configuration for the glow effect.
 */
export interface GlowConfig {
  position: Vec2;
  radius: number;
  intensity: number;
}

/**
 * Commands describing all active effects for the current frame.
 */
export interface EffectCommands {
  particles: ParticleEmitConfig[];
  beam: BeamConfig | null;
  glow: GlowConfig | null;
  flash: { duration: number; opacity: number } | null;
  shake: { duration: number; intensity: number } | null;
}

/**
 * Interface for the EffectsCoordinator module.
 */
export interface IEffectsCoordinator {
  onGestureStateChange(event: GestureStateEvent): void;
  update(deltaTime: number): void;
  getCurrentEffects(): EffectCommands;
}

/** Maximum charge time in ms for intensity calculation */
const MAX_CHARGE_TIME = 3000;

/** Default particle color (blue energy) */
const ENERGY_COLOR: Color = { r: 80, g: 160, b: 255, a: 1 };

/**
 * EffectsCoordinator reacts to gesture state transitions and produces
 * EffectCommands that describe what visual effects should be rendered.
 *
 * During charging:
 * - Particles converge to the center point between hands
 * - Glow is positioned at the center between hands
 * - Intensity increases monotonically based on chargeTime
 *
 * On transition to firing:
 * - Flash (100ms) and shake (300ms) are triggered
 * - Beam config is generated with the firing direction
 *
 * update(deltaTime) decrements flash/shake timers.
 */
export class EffectsCoordinator implements IEffectsCoordinator {
  private particles: ParticleEmitConfig[] = [];
  private beam: BeamConfig | null = null;
  private glow: GlowConfig | null = null;
  private flash: { duration: number; opacity: number } | null = null;
  private shake: { duration: number; intensity: number } | null = null;

  private currentState: 'idle' | 'charging' | 'firing' = 'idle';
  private handsCenterPosition: Vec2 | null = null;
  private chargeTime: number = 0;
  private firingDirection: Vec2 | null = null;

  /**
   * React to a gesture state transition event.
   */
  onGestureStateChange(event: GestureStateEvent): void {
    const { currentState, data } = event;

    this.currentState = currentState;

    if (data.handsCenterPosition) {
      this.handsCenterPosition = data.handsCenterPosition;
    }

    if (data.chargeTime !== undefined) {
      this.chargeTime = data.chargeTime;
    }

    if (data.firingDirection) {
      this.firingDirection = data.firingDirection;
    }

    switch (currentState) {
      case 'charging':
        this.handleCharging();
        break;
      case 'firing':
        this.handleFiring();
        break;
      case 'idle':
        this.handleIdle();
        break;
    }
  }

  /**
   * Update time-based effects (flash/shake timers).
   * @param deltaTime Time elapsed since last update in milliseconds.
   */
  update(deltaTime: number): void {
    if (this.flash) {
      this.flash.duration -= deltaTime;
      if (this.flash.duration <= 0) {
        this.flash = null;
      }
    }

    if (this.shake) {
      this.shake.duration -= deltaTime;
      if (this.shake.duration <= 0) {
        this.shake = null;
      }
    }

    // During charging, update effects based on current charge time
    if (this.currentState === 'charging') {
      this.chargeTime += deltaTime;
      this.handleCharging();
    }
  }

  /**
   * Returns the current set of effect commands for rendering.
   */
  getCurrentEffects(): EffectCommands {
    return {
      particles: this.particles,
      beam: this.beam,
      glow: this.glow,
      flash: this.flash,
      shake: this.shake,
    };
  }

  private handleCharging(): void {
    const intensity = this.calculateIntensity(this.chargeTime);
    const center = this.handsCenterPosition ?? { x: 0.5, y: 0.5 };
    const center3D: Vec3 = { x: center.x, y: center.y, z: 0 };

    // Generate converging particles
    this.particles = [
      {
        position: center3D,
        count: Math.ceil(10 * intensity),
        color: ENERGY_COLOR,
        speed: 50 * intensity,
        lifetime: 1000,
        direction: 'converge',
        target: center3D,
      },
    ];

    // Generate glow at center
    this.glow = {
      position: center,
      radius: 20 + 30 * intensity,
      intensity,
    };

    // No beam during charging
    this.beam = null;
  }

  private handleFiring(): void {
    const intensity = this.calculateIntensity(this.chargeTime);
    const center = this.handsCenterPosition ?? { x: 0.5, y: 0.5 };
    const direction = this.firingDirection ?? { x: 1, y: 0 };

    // Trigger flash
    this.flash = {
      duration: RENDER_CONSTANTS.FLASH_DURATION,
      opacity: 0.8,
    };

    // Trigger shake
    this.shake = {
      duration: RENDER_CONSTANTS.SHAKE_DURATION,
      intensity,
    };

    // Generate beam config with firing direction
    this.beam = {
      origin: center,
      direction,
      intensity,
      width: 10 + 20 * intensity,
    };

    // Clear charging effects
    this.glow = null;
    this.particles = [];
  }

  private handleIdle(): void {
    // Clear all effects
    this.particles = [];
    this.beam = null;
    this.glow = null;
    this.chargeTime = 0;
    this.handsCenterPosition = null;
    this.firingDirection = null;
  }

  /**
   * Calculate intensity as a monotonically increasing value based on charge time.
   * intensity = clamp(chargeTime / 3000, 0, 1)
   */
  private calculateIntensity(chargeTime: number): number {
    return clamp(chargeTime / MAX_CHARGE_TIME, 0, 1);
  }
}
