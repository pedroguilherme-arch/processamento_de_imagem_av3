import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GlowRenderer } from './GlowRenderer';
import type { Vec2 } from '../../shared/math';

/**
 * Creates a mock CanvasRenderingContext2D with the methods used by GlowRenderer.
 */
function createMockContext(): CanvasRenderingContext2D {
  const gradient = {
    addColorStop: vi.fn(),
  };

  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    globalAlpha: 1,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
}

describe('GlowRenderer', () => {
  let renderer: GlowRenderer;
  let ctx: CanvasRenderingContext2D;

  const position: Vec2 = { x: 320, y: 240 };

  beforeEach(() => {
    renderer = new GlowRenderer();
    ctx = createMockContext();
  });

  describe('renderGlow', () => {
    it('should store glow config for next render', () => {
      renderer.renderGlow(position, 50, 0.8);
      renderer.render(ctx);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('should clamp intensity to [0, 1]', () => {
      renderer.renderGlow(position, 50, 2.0);
      renderer.render(ctx);
      // Should not throw and should render normally
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('should clamp negative intensity to 0', () => {
      renderer.renderGlow(position, 50, -0.5);
      renderer.render(ctx);
      // intensity 0 means no render
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it('should handle zero radius gracefully', () => {
      renderer.renderGlow(position, 0, 0.8);
      renderer.render(ctx);
      // radius 0 means no render
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it('should clamp negative radius to 0', () => {
      renderer.renderGlow(position, -10, 0.8);
      renderer.render(ctx);
      // negative radius clamped to 0, no render
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it('should overwrite previous glow config', () => {
      renderer.renderGlow({ x: 100, y: 100 }, 30, 0.5);
      renderer.renderGlow(position, 60, 1.0);
      renderer.render(ctx);

      // Should use the latest position and radius
      expect(ctx.createRadialGradient).toHaveBeenCalledWith(
        position.x, position.y, 0,
        position.x, position.y, 60
      );
    });
  });

  describe('clear', () => {
    it('should reset glow state so nothing renders', () => {
      renderer.renderGlow(position, 50, 0.8);
      renderer.clear();
      renderer.render(ctx);
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });

    it('should be safe to call when no glow is set', () => {
      renderer.clear();
      renderer.render(ctx);
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });
  });

  describe('render', () => {
    it('should not render when no glow is set', () => {
      renderer.render(ctx);
      expect(ctx.beginPath).not.toHaveBeenCalled();
      expect(ctx.fill).not.toHaveBeenCalled();
    });

    it('should create a radial gradient centered at position', () => {
      renderer.renderGlow(position, 50, 0.8);
      renderer.render(ctx);
      expect(ctx.createRadialGradient).toHaveBeenCalledWith(
        position.x, position.y, 0,
        position.x, position.y, 50
      );
    });

    it('should draw an arc with the correct radius', () => {
      renderer.renderGlow(position, 75, 1.0);
      renderer.render(ctx);
      expect(ctx.arc).toHaveBeenCalledWith(
        position.x, position.y, 75, 0, Math.PI * 2
      );
    });

    it('should save and restore context state', () => {
      renderer.renderGlow(position, 50, 0.8);
      renderer.render(ctx);
      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
    });

    it('should add color stops to the gradient', () => {
      renderer.renderGlow(position, 50, 1.0);
      renderer.render(ctx);

      const gradient = (ctx.createRadialGradient as ReturnType<typeof vi.fn>).mock.results[0].value;
      // Should have 5 color stops for the energy glow
      expect(gradient.addColorStop).toHaveBeenCalledTimes(5);
    });

    it('should use intensity to modulate gradient opacity', () => {
      renderer.renderGlow(position, 50, 0.5);
      renderer.render(ctx);

      const gradient = (ctx.createRadialGradient as ReturnType<typeof vi.fn>).mock.results[0].value;
      // First stop should use intensity directly (0.5)
      expect(gradient.addColorStop).toHaveBeenCalledWith(0, 'rgba(255, 255, 255, 0.5)');
    });

    it('should render at full intensity', () => {
      renderer.renderGlow(position, 50, 1.0);
      renderer.render(ctx);

      const gradient = (ctx.createRadialGradient as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(gradient.addColorStop).toHaveBeenCalledWith(0, 'rgba(255, 255, 255, 1)');
    });
  });
});
