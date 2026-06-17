import * as THREE from 'three';
import { RENDER_CONSTANTS } from '../../shared/constants';
import type { Vec3, Color } from '../../shared/math';
import type { ParticleEmitConfig } from '../../core/effects';

/**
 * Interface for the ParticleEngine module.
 */
export interface IParticleEngine {
  initialize(container: HTMLElement): void;
  emit(config: ParticleEmitConfig): void;
  update(deltaTime: number): void;
  getActiveCount(): number;
  clear(): void;
}

/**
 * Internal representation of a single particle.
 */
interface Particle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  color: Color;
  createdAt: number;
}

/**
 * ParticleEngine manages a pool of particles rendered via Three.js.
 *
 * - Pool is capped at MAX_PARTICLES (500).
 * - When the pool is full, oldest/dead particles are recycled.
 * - emit() spawns particles based on ParticleEmitConfig.
 * - update(deltaTime) advances positions and expires particles.
 */
export class ParticleEngine implements IParticleEngine {
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;

  private particles: Particle[] = [];
  private points: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;

  private readonly maxParticles = RENDER_CONSTANTS.MAX_PARTICLES;
  private creationCounter = 0;

  /**
   * Initialize the Three.js scene, camera, and renderer for particles.
   */
  initialize(container: HTMLElement): void {
    this.scene = new THREE.Scene();

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;

    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 1000);
    this.camera.position.z = 1;

    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    // Initialize particle pool
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.createDeadParticle());
    }

    // Set up buffer geometry for point rendering
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxParticles * 3);
    const colors = new Float32Array(this.maxParticles * 4);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

    const material = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.scene.add(this.points);
  }

  /**
   * Emit particles based on the provided configuration.
   * Recycles dead or oldest particles when the pool is full.
   */
  emit(config: ParticleEmitConfig): void {
    const count = Math.min(config.count, this.maxParticles);

    for (let i = 0; i < count; i++) {
      const slot = this.findAvailableSlot();
      this.activateParticle(slot, config);
    }
  }

  /**
   * Update all active particles by advancing their positions and expiring
   * particles that have exceeded their lifetime.
   * @param deltaTime Time elapsed since last update in milliseconds.
   */
  update(deltaTime: number): void {
    const dtSeconds = deltaTime / 1000;

    for (const particle of this.particles) {
      if (!particle.active) continue;

      // Decrease remaining lifetime
      particle.lifetime -= deltaTime;

      if (particle.lifetime <= 0) {
        particle.active = false;
        continue;
      }

      // Advance position based on velocity
      particle.position.x += particle.velocity.x * dtSeconds;
      particle.position.y += particle.velocity.y * dtSeconds;
      particle.position.z += particle.velocity.z * dtSeconds;
    }

    // Update buffer geometry if initialized
    this.updateBufferGeometry();

    // Render the scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Returns the number of currently active particles.
   */
  getActiveCount(): number {
    return this.particles.filter((p) => p.active).length;
  }

  /**
   * Remove all active particles.
   */
  clear(): void {
    for (const particle of this.particles) {
      particle.active = false;
    }
    this.updateBufferGeometry();
  }

  /**
   * Find an available (inactive) slot in the pool.
   * If none available, recycle the oldest active particle.
   */
  private findAvailableSlot(): number {
    // First, look for a dead particle
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) {
        return i;
      }
    }

    // Pool is full — recycle the oldest particle (lowest createdAt)
    let oldestIndex = 0;
    let oldestTime = Infinity;
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].createdAt < oldestTime) {
        oldestTime = this.particles[i].createdAt;
        oldestIndex = i;
      }
    }
    return oldestIndex;
  }

  /**
   * Activate a particle at the given pool index with the provided config.
   */
  private activateParticle(index: number, config: ParticleEmitConfig): void {
    const particle = this.particles[index];
    particle.active = true;
    particle.lifetime = config.lifetime;
    particle.maxLifetime = config.lifetime;
    particle.color = config.color;
    particle.createdAt = this.creationCounter++;

    // Set position with slight random offset for visual variety
    particle.position.set(
      config.position.x + (Math.random() - 0.5) * 0.05,
      config.position.y + (Math.random() - 0.5) * 0.05,
      config.position.z
    );

    // Calculate velocity based on direction type
    const velocity = this.calculateVelocity(config, particle.position);
    particle.velocity.set(velocity.x, velocity.y, velocity.z);
  }

  /**
   * Calculate particle velocity based on direction type.
   */
  private calculateVelocity(
    config: ParticleEmitConfig,
    particlePosition: THREE.Vector3
  ): Vec3 {
    const speed = config.speed / 1000; // Convert to units per second

    switch (config.direction) {
      case 'converge': {
        // Move toward target
        const target = config.target ?? config.position;
        const dx = target.x - particlePosition.x;
        const dy = target.y - particlePosition.y;
        const dz = target.z - particlePosition.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        return {
          x: (dx / dist) * speed,
          y: (dy / dist) * speed,
          z: (dz / dist) * speed,
        };
      }
      case 'diverge': {
        // Move away from position
        const angle = Math.random() * Math.PI * 2;
        return {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
          z: 0,
        };
      }
      case 'radial': {
        // Move outward in all directions
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        return {
          x: Math.sin(phi) * Math.cos(theta) * speed,
          y: Math.sin(phi) * Math.sin(theta) * speed,
          z: Math.cos(phi) * speed,
        };
      }
    }
  }

  /**
   * Create a dead (inactive) particle for pool initialization.
   */
  private createDeadParticle(): Particle {
    return {
      active: false,
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      lifetime: 0,
      maxLifetime: 0,
      color: { r: 0, g: 0, b: 0, a: 0 },
      createdAt: 0,
    };
  }

  /**
   * Sync the internal particle state to the Three.js buffer geometry.
   */
  private updateBufferGeometry(): void {
    if (!this.geometry) return;

    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute;

    if (!posAttr || !colAttr) return;

    const positions = posAttr.array as Float32Array;
    const colors = colAttr.array as Float32Array;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const i3 = i * 3;
      const i4 = i * 4;

      if (p.active) {
        positions[i3] = p.position.x;
        positions[i3 + 1] = p.position.y;
        positions[i3 + 2] = p.position.z;

        const lifeRatio = p.lifetime / p.maxLifetime;
        colors[i4] = p.color.r / 255;
        colors[i4 + 1] = p.color.g / 255;
        colors[i4 + 2] = p.color.b / 255;
        colors[i4 + 3] = p.color.a * lifeRatio;
      } else {
        positions[i3] = 0;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = 0;
        colors[i4] = 0;
        colors[i4 + 1] = 0;
        colors[i4 + 2] = 0;
        colors[i4 + 3] = 0;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
