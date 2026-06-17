// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CameraModule } from './CameraModule';

// Mock navigator.mediaDevices.getUserMedia
function createMockStream(): MediaStream {
  const mockTrack = {
    stop: vi.fn(),
    kind: 'video',
    id: 'mock-track-id',
  } as unknown as MediaStreamTrack;

  return {
    getTracks: () => [mockTrack],
    getVideoTracks: () => [mockTrack],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
}

describe('CameraModule', () => {
  let camera: CameraModule;
  let mockGetUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    camera = new CameraModule();
    mockGetUserMedia = vi.fn();

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    camera.stop();
  });

  describe('initialize()', () => {
    it('requests camera with correct constraints', async () => {
      const mockStream = createMockStream();
      mockGetUserMedia.mockResolvedValue(mockStream);

      await camera.initialize();

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        video: {
          width: { min: 640 },
          height: { min: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
    });

    it('sets stream on video element after successful initialization', async () => {
      const mockStream = createMockStream();
      mockGetUserMedia.mockResolvedValue(mockStream);

      await camera.initialize();

      expect(camera.getStream()).toBe(mockStream);
      expect(camera.getVideoElement().srcObject).toBe(mockStream);
    });

    it('emits permission_denied error when NotAllowedError occurs', async () => {
      const domError = new DOMException('Permission denied', 'NotAllowedError');
      mockGetUserMedia.mockRejectedValue(domError);

      const errorCallback = vi.fn();
      camera.onError(errorCallback);

      await expect(camera.initialize()).rejects.toThrow();
      expect(errorCallback).toHaveBeenCalledWith({ type: 'permission_denied' });
    });

    it('emits no_device error when NotFoundError occurs', async () => {
      const domError = new DOMException('No device', 'NotFoundError');
      mockGetUserMedia.mockRejectedValue(domError);

      const errorCallback = vi.fn();
      camera.onError(errorCallback);

      await expect(camera.initialize()).rejects.toThrow();
      expect(errorCallback).toHaveBeenCalledWith({ type: 'no_device' });
    });

    it('emits stream_error for other DOMException types', async () => {
      const domError = new DOMException('Overconstrained', 'OverconstrainedError');
      mockGetUserMedia.mockRejectedValue(domError);

      const errorCallback = vi.fn();
      camera.onError(errorCallback);

      await expect(camera.initialize()).rejects.toThrow();
      expect(errorCallback).toHaveBeenCalledWith({
        type: 'stream_error',
        message: 'Overconstrained',
      });
    });

    it('emits stream_error for generic Error', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Something went wrong'));

      const errorCallback = vi.fn();
      camera.onError(errorCallback);

      await expect(camera.initialize()).rejects.toThrow();
      expect(errorCallback).toHaveBeenCalledWith({
        type: 'stream_error',
        message: 'Something went wrong',
      });
    });
  });

  describe('start()', () => {
    it('throws and emits error if stream is not initialized', async () => {
      const errorCallback = vi.fn();
      camera.onError(errorCallback);

      await expect(camera.start()).rejects.toThrow('Stream not initialized');
      expect(errorCallback).toHaveBeenCalledWith({
        type: 'stream_error',
        message: 'Stream not initialized. Call initialize() first.',
      });
    });

    it('sets active to true after successful start', async () => {
      const mockStream = createMockStream();
      mockGetUserMedia.mockResolvedValue(mockStream);

      // Mock video.play()
      const videoElement = camera.getVideoElement();
      videoElement.play = vi.fn().mockResolvedValue(undefined);

      await camera.initialize();
      await camera.start();

      expect(camera.isActive()).toBe(true);
    });
  });

  describe('stop()', () => {
    it('stops all tracks and sets active to false', async () => {
      const mockStream = createMockStream();
      mockGetUserMedia.mockResolvedValue(mockStream);

      const videoElement = camera.getVideoElement();
      videoElement.play = vi.fn().mockResolvedValue(undefined);

      await camera.initialize();
      await camera.start();

      camera.stop();

      expect(camera.isActive()).toBe(false);
      expect(camera.getStream()).toBeNull();
      expect(camera.getVideoElement().srcObject).toBeNull();
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
    });

    it('handles stop when not initialized gracefully', () => {
      expect(() => camera.stop()).not.toThrow();
      expect(camera.isActive()).toBe(false);
    });
  });

  describe('getVideoElement()', () => {
    it('returns a hidden video element with correct attributes', () => {
      const video = camera.getVideoElement();

      expect(video).toBeInstanceOf(HTMLVideoElement);
      expect(video.getAttribute('autoplay')).toBe('');
      expect(video.getAttribute('playsinline')).toBe('');
      expect(video.muted).toBe(true);
      expect(video.style.display).toBe('none');
    });
  });

  describe('isActive()', () => {
    it('returns false initially', () => {
      expect(camera.isActive()).toBe(false);
    });
  });

  describe('onError()', () => {
    it('supports multiple error callbacks', async () => {
      const domError = new DOMException('No device', 'NotFoundError');
      mockGetUserMedia.mockRejectedValue(domError);

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      camera.onError(callback1);
      camera.onError(callback2);

      await expect(camera.initialize()).rejects.toThrow();

      expect(callback1).toHaveBeenCalledWith({ type: 'no_device' });
      expect(callback2).toHaveBeenCalledWith({ type: 'no_device' });
    });
  });
});
