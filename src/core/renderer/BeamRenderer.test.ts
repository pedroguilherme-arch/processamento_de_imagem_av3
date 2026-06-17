import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BeamRenderer } from './BeamRenderer';
import { RENDER_CONSTANTS } from '../../shared/constants';
import type { Vec2 } from '../../shared/math';

/**
 * Creates a mock CanvasRenderingContext2D with the methods used by BeamRenderer.
 */
function createMockContext(): CanvasRenderingContext2D {
  const gradient = {
    addColorStop: vi.fn(),
  };

  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    globalAlpha: 1,
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
  } as unknown as CanvasRenderingContext2D;
}

describe('BeamRenderer', () => {
  let renderer: BeamRenderer;
  let ctx: CanvasRenderingContext2D;

  const origin: Vec2 = { x: 320, y: 240 };
  const direction: Vec2 = { x: 1, y: 0 };

  beforeEach(() => {
    renderer = new BeamRenderer();
    ctx = createMockContext();
  });

  describe('isActive', () => {
    it('should return false initially', () => {
      expect(renderer.isActive()).toBe(false);
    });

    it('should return true after startBeam', () => {
      renderer.startBeam(origin, direction, 0.8);
      expect(renderer.isActive()).toBe(true);
    });

    it('should return true during fade-out', () => {
      renderer.startBeam(origin, direction, 0.8);
      renderer.stopBeam();
      // Still active during fade
      renderer.render(ctx, RENDER_CONSTANTS.BEAM_FADE_DURATION / 2);
      expect(renderer.isActive()).toBe(true);
    });

    it('should return false after fade-out completes', () => {
      renderer.startBeam(origin, direction, 0.8);
      renderer.stopBeam();
      renderer.render(ctx, RENDER_CONSTANTS.BEAM_FADE_DURATION);
      expect(renderer.isActive()).toBe(false);
    });
  });

  describe('startBeam', () => {
    it('should activate the beam', () => {
      renderer.startBeam(origin, direction, 1.0);
      expect(renderer.isActive()).toBe(true);
    });

    it('should render the beam on the next render call', () => {
      renderer.startBeam(origin, direction, 0.5);
      renderer.render(ctx, 16);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should clamp intensity to [0, 1]', () => {
      renderer.startBeam(origin, direction, 2.0);
      expect(renderer.isActive()).toBe(true);
      // Should not throw and should render normally
      renderer.render(ctx, 16);
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should reset fade state if called while fading', () => {
      renderer.startBeam(origin, direction, 0.8);
      renderer.stopBeam();
      // Partially fade
      renderer.render(ctx, RENDER_CONSTANTS.BEAM_FADE_DURATION / 2);
      expect(renderer.isActive()).toBe(true);

      // Restart beam — should reset fade
      renderer.startBeam(origin, direction, 1.0);
      expect(renderer.isActive()).toBe(true);

      // Should render at full opacity (no fade)
      renderer.render(ctx, 16);
      expect(ctx.globalAlpha).toBe(1);
    });
  });

  describe('updateBeam', () => {
    it('should update beam parameters when active', () => {
      renderer.startBeam(origin, direction, 0.5);
      const newOrigin: Vec2 = { x: 400, y: 300 };
      const newDirection: Vec2 = { x: 0, y: 1 };
      renderer.updateBeam(newOrigin, newDirection, 0.9);

      renderer.render(ctx, 16);
      // Verify it renders (the new direction/origin are used internally)
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
    });

    it('should do nothing when beam is not active', () => {
      renderer.updateBeam(origin, direction, 0.5);
      expect(renderer.isActive()).toBe(false);
    });

    it('should clamp intensity to [0, 1]', () => {
      renderer.startBeam(origin, direction, 0.5);
      renderer.updateBeam(origin, direction, -0.5);
      // Should not throw
      renderer.render(ctx, 16);
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('stopBeam', () => {
    it('should initiate fade-out', () => {
      renderer.startBeam(origin, direction, 0.8);
      renderer.stopBeam();
      // Still active (fading)
      expect(renderer.isActive()).toBe(true);
    });

    it('should do nothing when beam is not active', () => {
      renderer.stopBeam();
      expect(renderer.isActive()).toBe(false);
    });

    it('should complete fade after BEAM_FADE_DURATION', () => {
      renderer.startBeam(origin, direction, 0.8);
      renderer.stopBeam();

      // Advance time to complete fade
      renderer.render(ctx, RENDER_CONSTANTS.BEAM_FADE_DURATION);
      expect(renderer.isActive()).toBe(false);
    });

    it('should gradually reduce opacity during fade', () => {
      renderer.startBeam(origin, direction, 1.0);
      renderer.stopBeam();

      // Render at half fade duration
      renderer.render(ctx, RENDER_CONSTANTS.BEAM_FADE_DURATION / 2);
      expect(renderer.isActive()).toBe(true);
      // globalAlpha should be approximately 0.5
      expect(ctx.globalAlpha).toBeCloseTo(0.5, 1);
    });
  });

  describe('render', () => {
    it('should not render when inactive', () => {
      renderer.render(ctx, 16);
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it('should draw multiple layers for gradient effect', () => {
      renderer.startBeam(origin, direction, 1.0);
      renderer.render(ctx, 16);
      // 3 layers: outer glow, mid, core
      expect(ctx.beginPath).toHaveBeenCalledTimes(3);
      expect(ctx.stroke).toHaveBeenCalledTimes(3);
    });

    it('should use createLinearGradient for beam coloring', () => {
      renderer.startBeam(origin, direction, 1.0);
      renderer.render(ctx, 16);
      expect(ctx.createLinearGradient).toHaveBeenCalled();
    });

    it('should save and restore context state', () => {
      renderer.startBeam(origin, direction, 1.0);
      renderer.render(ctx, 16);
      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
    });

    it('should not render after fade completes', () => {
      renderer.startBeam(origin, direction, 0.8);
      renderer.stopBeam();
      renderer.render(ctx, RENDER_CONSTANTS.BEAM_FADE_DURATION);

      // Reset mock call counts
      vi.mocked(ctx.beginPath).mockClear();
      vi.mocked(ctx.stroke).mockClear();

      // Should not render anymore
      renderer.render(ctx, 16);
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it('should handle zero intensity gracefully', () => {
      renderer.startBeam(origin, direction, 0);
      renderer.render(ctx, 16);
      // Should still render (with minimal width)
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });
});
