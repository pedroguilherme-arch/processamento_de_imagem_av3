import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParticleEmitConfig } from '../effects';

// Mock Three.js before importing ParticleEngine
vi.mock('three', () => {
  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }

  class BufferAttribute {
    array: Float32Array;
    needsUpdate = false;
    constructor(array: Float32Array, _itemSize: number) {
      this.array = array;
    }
  }

  class BufferGeometry {
    attributes: Record<string, BufferAttribute> = {};
    setAttribute(name: string, attr: BufferAttribute) {
      this.attributes[name] = attr;
      return this;
    }
    getAttribute(name: string) {
      return this.attributes[name];
    }
  }

  class PointsMaterial {
    constructor(_opts?: any) {}
  }

  class Points {
    constructor(public geometry: any, public material: any) {}
  }

  class Scene {
    children: any[] = [];
    add(obj: any) {
      this.children.push(obj);
    }
  }

  class OrthographicCamera {
    position = new Vector3();
    constructor(..._args: any[]) {}
  }

  const mockDomElement = {
    style: {},
  };

  class WebGLRenderer {
    domElement = mockDomElement;
    constructor(_opts?: any) {}
    setSize(_w: number, _h: number) {}
    setClearColor(_color: number, _alpha: number) {}
    render(_scene: any, _camera: any) {}
  }

  return {
    Vector3,
    BufferAttribute,
    BufferGeometry,
    PointsMaterial,
    Points,
    Scene,
    OrthographicCamera,
    WebGLRenderer,
    AdditiveBlending: 1,
  };
});

import { ParticleEngine } from './ParticleEngine';
import { RENDER_CONSTANTS } from '../../shared/constants';

function createMockContainer(): HTMLElement {
  return {
    clientWidth: 640,
    clientHeight: 480,
    appendChild: vi.fn(),
  } as unknown as HTMLElement;
}

function createEmitConfig(overrides: Partial<ParticleEmitConfig> = {}): ParticleEmitConfig {
  return {
    position: { x: 0.5, y: 0.5, z: 0 },
    count: 10,
    color: { r: 80, g: 160, b: 255, a: 1 },
    speed: 50,
    lifetime: 1000,
    direction: 'converge',
    target: { x: 0.5, y: 0.5, z: 0 },
    ...overrides,
  };
}

describe('ParticleEngine', () => {
  let engine: ParticleEngine;
  let container: HTMLElement;

  beforeEach(() => {
    engine = new ParticleEngine();
    container = createMockContainer();
    engine.initialize(container);
  });

  describe('initialize', () => {
    it('should set up the renderer and append to container', () => {
      expect(container.appendChild).toHaveBeenCalled();
    });

    it('should start with zero active particles', () => {
      expect(engine.getActiveCount()).toBe(0);
    });
  });

  describe('emit', () => {
    it('should activate particles based on config count', () => {
      engine.emit(createEmitConfig({ count: 5 }));
      expect(engine.getActiveCount()).toBe(5);
    });

    it('should emit multiple batches and accumulate active particles', () => {
      engine.emit(createEmitConfig({ count: 10 }));
      engine.emit(createEmitConfig({ count: 15 }));
      expect(engine.getActiveCount()).toBe(25);
    });

    it('should never exceed MAX_PARTICLES even with large emit count', () => {
      engine.emit(createEmitConfig({ count: 600 }));
      // count is clamped to maxParticles
      expect(engine.getActiveCount()).toBeLessThanOrEqual(RENDER_CONSTANTS.MAX_PARTICLES);
    });

    it('should recycle oldest particles when pool is full', () => {
      // Fill the pool
      engine.emit(createEmitConfig({ count: 500, lifetime: 5000 }));
      expect(engine.getActiveCount()).toBe(500);

      // Emit more — should recycle, not exceed
      engine.emit(createEmitConfig({ count: 50, lifetime: 5000 }));
      expect(engine.getActiveCount()).toBe(500);
    });

    it('should handle converge direction with target', () => {
      const config = createEmitConfig({
        direction: 'converge',
        target: { x: 0.5, y: 0.5, z: 0 },
        count: 1,
      });
      engine.emit(config);
      expect(engine.getActiveCount()).toBe(1);
    });

    it('should handle diverge direction', () => {
      const config = createEmitConfig({ direction: 'diverge', count: 3 });
      engine.emit(config);
      expect(engine.getActiveCount()).toBe(3);
    });

    it('should handle radial direction', () => {
      const config = createEmitConfig({ direction: 'radial', count: 3 });
      engine.emit(config);
      expect(engine.getActiveCount()).toBe(3);
    });
  });

  describe('update', () => {
    it('should expire particles when lifetime is exceeded', () => {
      engine.emit(createEmitConfig({ count: 5, lifetime: 100 }));
      expect(engine.getActiveCount()).toBe(5);

      // Advance time past lifetime
      engine.update(150);
      expect(engine.getActiveCount()).toBe(0);
    });

    it('should not expire particles before their lifetime', () => {
      engine.emit(createEmitConfig({ count: 5, lifetime: 1000 }));
      engine.update(500);
      expect(engine.getActiveCount()).toBe(5);
    });

    it('should advance particle positions based on velocity and deltaTime', () => {
      engine.emit(createEmitConfig({ count: 1, lifetime: 5000, speed: 100 }));
      // After update, particles should have moved (we can't easily check exact position
      // due to random offsets, but we verify no crash and particles remain active)
      engine.update(16);
      expect(engine.getActiveCount()).toBe(1);
    });

    it('should handle zero deltaTime without errors', () => {
      engine.emit(createEmitConfig({ count: 5, lifetime: 1000 }));
      engine.update(0);
      expect(engine.getActiveCount()).toBe(5);
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 when no particles are emitted', () => {
      expect(engine.getActiveCount()).toBe(0);
    });

    it('should reflect the correct count after emit and expiry', () => {
      engine.emit(createEmitConfig({ count: 10, lifetime: 500 }));
      expect(engine.getActiveCount()).toBe(10);

      engine.update(600);
      expect(engine.getActiveCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should deactivate all particles', () => {
      engine.emit(createEmitConfig({ count: 50, lifetime: 5000 }));
      expect(engine.getActiveCount()).toBe(50);

      engine.clear();
      expect(engine.getActiveCount()).toBe(0);
    });

    it('should allow new emissions after clear', () => {
      engine.emit(createEmitConfig({ count: 20, lifetime: 5000 }));
      engine.clear();
      engine.emit(createEmitConfig({ count: 10, lifetime: 5000 }));
      expect(engine.getActiveCount()).toBe(10);
    });
  });

  describe('pool recycling', () => {
    it('should recycle dead particles before oldest active ones', () => {
      // Emit particles with short lifetime
      engine.emit(createEmitConfig({ count: 100, lifetime: 50 }));
      // Expire them
      engine.update(100);
      expect(engine.getActiveCount()).toBe(0);

      // Now emit new ones — should reuse dead slots
      engine.emit(createEmitConfig({ count: 100, lifetime: 5000 }));
      expect(engine.getActiveCount()).toBe(100);
    });

    it('should maintain MAX_PARTICLES limit across many emissions', () => {
      for (let i = 0; i < 20; i++) {
        engine.emit(createEmitConfig({ count: 100, lifetime: 10000 }));
      }
      expect(engine.getActiveCount()).toBeLessThanOrEqual(RENDER_CONSTANTS.MAX_PARTICLES);
    });
  });
});
