import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Renderer, type RenderState } from './Renderer';
import type { IGlowRenderer } from './GlowRenderer';
import type { IParticleEngine } from './ParticleEngine';
import type { IBeamRenderer } from './BeamRenderer';
import { RENDER_CONSTANTS } from '../../shared/constants';

/**
 * Creates a mock CanvasRenderingContext2D.
 */
function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Creates a mock HTMLCanvasElement.
 */
function createMockCanvas(ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  return {
    getContext: vi.fn(() => ctx),
    width: 640,
    height: 480,
    parentElement: {
      clientWidth: 640,
      clientHeight: 480,
    },
  } as unknown as HTMLCanvasElement;
}

/**
 * Creates a mock GlowRenderer.
 */
function createMockGlowRenderer(): IGlowRenderer {
  return {
    renderGlow: vi.fn(),
    clear: vi.fn(),
    render: vi.fn(),
  };
}

/**
 * Creates a mock ParticleEngine.
 */
function createMockParticleEngine(): IParticleEngine {
  return {
    initialize: vi.fn(),
    emit: vi.fn(),
    update: vi.fn(),
    getActiveCount: vi.fn(() => 0),
    clear: vi.fn(),
  };
}

/**
 * Creates a mock BeamRenderer.
 */
function createMockBeamRenderer(): IBeamRenderer {
  let active = false;
  let fading = false;
  return {
    startBeam: vi.fn(() => { active = true; fading = false; }),
    updateBeam: vi.fn(),
    stopBeam: vi.fn(() => { fading = true; }),
    killBeam: vi.fn(() => { active = false; fading = false; }),
    isActive: vi.fn(() => active),
    isFading: vi.fn(() => fading),
    render: vi.fn(),
  };
}

/**
 * Creates a default idle RenderState.
 */
function createIdleState(): RenderState {
  return {
    gestureState: 'idle',
    handsCenterPosition: null,
    chargeTime: 0,
    chargeIntensity: 0,
    firingDirection: null,
    flashActive: false,
    shakeActive: false,
  };
}

/**
 * Creates a charging RenderState.
 */
function createChargingState(intensity = 0.5): RenderState {
  return {
    gestureState: 'charging',
    handsCenterPosition: { x: 320, y: 240 },
    chargeTime: 1500,
    chargeIntensity: intensity,
    firingDirection: null,
    flashActive: false,
    shakeActive: false,
  };
}

/**
 * Creates a firing RenderState.
 */
function createFiringState(intensity = 0.8): RenderState {
  return {
    gestureState: 'firing',
    handsCenterPosition: { x: 320, y: 240 },
    chargeTime: 2000,
    chargeIntensity: intensity,
    firingDirection: { x: 1, y: 0 },
    flashActive: true,
    shakeActive: true,
  };
}

describe('Renderer', () => {
  let renderer: Renderer;
  let ctx: CanvasRenderingContext2D;
  let canvas: HTMLCanvasElement;
  let glowRenderer: IGlowRenderer;
  let particleEngine: IParticleEngine;
  let beamRenderer: IBeamRenderer;

  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0);

    ctx = createMockContext();
    canvas = createMockCanvas(ctx);
    glowRenderer = createMockGlowRenderer();
    particleEngine = createMockParticleEngine();
    beamRenderer = createMockBeamRenderer();

    renderer = new Renderer(glowRenderer, particleEngine, beamRenderer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should get 2D context from canvas', () => {
      renderer.initialize(canvas);
      expect(canvas.getContext).toHaveBeenCalledWith('2d');
    });

    it('should initialize particle engine with canvas parent', () => {
      renderer.initialize(canvas);
      expect(particleEngine.initialize).toHaveBeenCalledWith(canvas.parentElement);
    });

    it('should throw if canvas context is not available', () => {
      const badCanvas = {
        getContext: vi.fn(() => null),
        parentElement: null,
      } as unknown as HTMLCanvasElement;

      expect(() => renderer.initialize(badCanvas)).toThrow(
        'Failed to get 2D rendering context from canvas'
      );
    });
  });

  describe('render - basic pipeline', () => {
    beforeEach(() => {
      vi.spyOn(performance, 'now').mockReturnValue(16);
      renderer.initialize(canvas);
    });

    it('should return false if not initialized', () => {
      const uninitRenderer = new Renderer(glowRenderer, particleEngine, beamRenderer);
      const result = uninitRenderer.render(createIdleState());
      expect(result).toBe(false);
    });

    it('should clear canvas at the start of each frame', () => {
      renderer.render(createIdleState());
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
    });

    it('should save and restore context state', () => {
      renderer.render(createIdleState());
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('should update particles every frame', () => {
      renderer.render(createIdleState());
      expect(particleEngine.update).toHaveBeenCalled();
    });

    it('should return true for frames within budget', () => {
      const result = renderer.render(createIdleState());
      expect(result).toBe(true);
    });
  });

  describe('render - charging state', () => {
    beforeEach(() => {
      vi.spyOn(performance, 'now').mockReturnValue(16);
      renderer.initialize(canvas);
    });

    it('should render glow when in charging state with center position', () => {
      const state = createChargingState(0.5);
      renderer.render(state);

      expect(glowRenderer.renderGlow).toHaveBeenCalledWith(
        { x: 320, y: 240 },
        20 + 30 * 0.5, // radius
        0.5 // intensity
      );
      expect(glowRenderer.render).toHaveBeenCalledWith(ctx);
    });

    it('should clear glow when not in charging state', () => {
      renderer.render(createIdleState());
      expect(glowRenderer.clear).toHaveBeenCalled();
    });

    it('should scale glow radius with charge intensity', () => {
      const state = createChargingState(1.0);
      renderer.render(state);

      expect(glowRenderer.renderGlow).toHaveBeenCalledWith(
        { x: 320, y: 240 },
        50, // 20 + 30 * 1.0
        1.0
      );
    });
  });

  describe('render - firing state', () => {
    beforeEach(() => {
      vi.spyOn(performance, 'now').mockReturnValue(16);
      renderer.initialize(canvas);
    });

    it('should start beam when entering firing state', () => {
      const state = createFiringState();
      renderer.render(state);

      expect(beamRenderer.startBeam).toHaveBeenCalledWith(
        { x: 320, y: 240 },
        { x: 1, y: 0 },
        0.8
      );
    });

    it('should update beam when already active in firing state', () => {
      const state = createFiringState();
      // First render starts the beam
      renderer.render(state);
      // Second render updates it
      renderer.render(state);

      expect(beamRenderer.updateBeam).toHaveBeenCalledWith(
        { x: 320, y: 240 },
        { x: 1, y: 0 },
        0.8
      );
    });

    it('should stop beam when leaving firing state', () => {
      // First render in firing state starts beam
      renderer.render(createFiringState());
      // Then render in idle state should stop beam
      renderer.render(createIdleState());

      expect(beamRenderer.stopBeam).toHaveBeenCalled();
    });

    it('should call beam render every frame', () => {
      renderer.render(createFiringState());
      expect(beamRenderer.render).toHaveBeenCalledWith(ctx, expect.any(Number));
    });
  });

  describe('render - flash effect', () => {
    beforeEach(() => {
      vi.spyOn(performance, 'now').mockReturnValue(16);
      renderer.initialize(canvas);
    });

    it('should render white overlay when flash is active', () => {
      const state = createFiringState();
      state.flashActive = true;
      renderer.render(state);

      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 640, 480);
    });

    it('should not render flash overlay when flash is inactive', () => {
      const state = createIdleState();
      state.flashActive = false;
      renderer.render(state);

      expect(ctx.fillRect).not.toHaveBeenCalled();
    });
  });

  describe('render - shake effect', () => {
    beforeEach(() => {
      vi.spyOn(performance, 'now').mockReturnValue(16);
      renderer.initialize(canvas);
    });

    it('should apply translate transform when shake is active', () => {
      const state = createFiringState();
      state.shakeActive = true;
      renderer.render(state);

      expect(ctx.translate).toHaveBeenCalled();
    });

    it('should not apply translate when shake is inactive', () => {
      const state = createIdleState();
      state.shakeActive = false;
      renderer.render(state);

      expect(ctx.translate).not.toHaveBeenCalled();
    });
  });

  describe('render - frame budget', () => {
    it('should discard frame when processing exceeds 33ms', () => {
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++;
        // First call (initialize): 0
        // Second call (render frameStart): 16
        // Third call (render frameEnd check): 16 + 34 = 50 (exceeds budget)
        if (callCount <= 1) return 0;
        if (callCount === 2) return 16;
        return 50; // 34ms elapsed > 33ms budget
      });

      renderer.initialize(canvas);
      const result = renderer.render(createIdleState());

      expect(result).toBe(false);
      expect(renderer.wasLastFrameDiscarded()).toBe(true);
    });

    it('should clear canvas when frame is discarded', () => {
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++;
        if (callCount <= 1) return 0;
        if (callCount === 2) return 16;
        return 50; // exceeds budget
      });

      renderer.initialize(canvas);
      renderer.render(createIdleState());

      // clearRect called twice: once at start of frame, once to discard
      expect(ctx.clearRect).toHaveBeenCalledTimes(2);
    });

    it('should not discard frame when processing is within budget', () => {
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++;
        if (callCount <= 1) return 0;
        if (callCount === 2) return 16;
        return 16 + 10; // 10ms elapsed < 33ms budget
      });

      renderer.initialize(canvas);
      const result = renderer.render(createIdleState());

      expect(result).toBe(true);
      expect(renderer.wasLastFrameDiscarded()).toBe(false);
    });

    it('should discard frame at exactly 33ms boundary', () => {
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++;
        if (callCount <= 1) return 0;
        if (callCount === 2) return 16;
        return 16 + RENDER_CONSTANTS.FRAME_BUDGET; // exactly 33ms
      });

      renderer.initialize(canvas);
      const result = renderer.render(createIdleState());

      // Exactly at budget is not over budget (> not >=)
      expect(result).toBe(true);
    });

    it('should discard frame when just over budget', () => {
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++;
        if (callCount <= 1) return 0;
        if (callCount === 2) return 16;
        return 16 + RENDER_CONSTANTS.FRAME_BUDGET + 0.1; // just over 33ms
      });

      renderer.initialize(canvas);
      const result = renderer.render(createIdleState());

      expect(result).toBe(false);
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      vi.spyOn(performance, 'now').mockReturnValue(0);
      renderer.initialize(canvas);
    });

    it('should clear glow renderer', () => {
      renderer.destroy();
      expect(glowRenderer.clear).toHaveBeenCalled();
    });

    it('should clear particle engine', () => {
      renderer.destroy();
      expect(particleEngine.clear).toHaveBeenCalled();
    });

    it('should stop beam if active', () => {
      // Start beam first
      vi.spyOn(performance, 'now').mockReturnValue(16);
      renderer.render(createFiringState());
      renderer.destroy();
      expect(beamRenderer.stopBeam).toHaveBeenCalled();
    });

    it('should not render after destroy', () => {
      renderer.destroy();
      vi.spyOn(performance, 'now').mockReturnValue(32);
      const result = renderer.render(createIdleState());
      expect(result).toBe(false);
    });
  });
});
