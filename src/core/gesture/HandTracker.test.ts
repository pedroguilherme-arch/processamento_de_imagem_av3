// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandTracker } from './HandTracker';

// Mock @mediapipe/hands
const mockSetOptions = vi.fn();
const mockOnResults = vi.fn();
const mockSend = vi.fn();
const mockInitialize = vi.fn().mockResolvedValue(undefined);

vi.mock('@mediapipe/hands', () => {
  return {
    Hands: vi.fn().mockImplementation(() => ({
      setOptions: mockSetOptions,
      onResults: mockOnResults,
      send: mockSend,
      initialize: mockInitialize,
    })),
  };
});

// Helper to create mock MediaPipe landmarks (21 points)
function createMockLandmarks(count = 21) {
  return Array.from({ length: count }, (_, i) => ({
    x: i / 20,
    y: i / 20,
    z: (i - 10) / 20,
  }));
}

// Helper to trigger the onResults callback
function triggerResults(results: unknown) {
  const callback = mockOnResults.mock.calls[0]?.[0];
  if (callback) {
    callback(results);
  }
}

describe('HandTracker', () => {
  let tracker: HandTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new HandTracker();

    // Make send trigger results callback asynchronously
    mockSend.mockImplementation(() => {
      // Results will be triggered manually in tests
      return Promise.resolve();
    });
  });

  describe('initialize()', () => {
    it('creates MediaPipe Hands instance with correct options', async () => {
      await tracker.initialize();

      expect(mockSetOptions).toHaveBeenCalledWith({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });
    });

    it('registers onResults callback', async () => {
      await tracker.initialize();

      expect(mockOnResults).toHaveBeenCalledWith(expect.any(Function));
    });

    it('calls hands.initialize() to load the model', async () => {
      await tracker.initialize();

      expect(mockInitialize).toHaveBeenCalled();
    });
  });

  describe('processFrame()', () => {
    const mockVideo = document.createElement('video') as HTMLVideoElement;

    it('throws if not initialized', async () => {
      await expect(tracker.processFrame(mockVideo, 640, 480)).rejects.toThrow(
        'HandTracker not initialized'
      );
    });

    it('returns empty hands array when no hands detected', async () => {
      await tracker.initialize();

      mockSend.mockImplementation(async () => {
        triggerResults({
          multiHandLandmarks: [],
          multiHandedness: [],
        });
      });

      const result = await tracker.processFrame(mockVideo, 640, 480);

      expect(result.hands).toEqual([]);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('returns normalized HandData for one detected hand', async () => {
      await tracker.initialize();

      const landmarks = createMockLandmarks(21);
      mockSend.mockImplementation(async () => {
        triggerResults({
          multiHandLandmarks: [landmarks],
          multiHandedness: [{ label: 'Right', score: 0.95 }],
        });
      });

      const result = await tracker.processFrame(mockVideo, 640, 480);

      expect(result.hands).toHaveLength(1);
      expect(result.hands[0].landmarks).toHaveLength(21);
      expect(result.hands[0].handedness).toBe('right');
      expect(result.hands[0].confidence).toBe(0.95);
    });

    it('returns normalized HandData for two detected hands', async () => {
      await tracker.initialize();

      const landmarks1 = createMockLandmarks(21);
      const landmarks2 = createMockLandmarks(21);
      mockSend.mockImplementation(async () => {
        triggerResults({
          multiHandLandmarks: [landmarks1, landmarks2],
          multiHandedness: [
            { label: 'Left', score: 0.9 },
            { label: 'Right', score: 0.85 },
          ],
        });
      });

      const result = await tracker.processFrame(mockVideo, 640, 480);

      expect(result.hands).toHaveLength(2);
      expect(result.hands[0].handedness).toBe('left');
      expect(result.hands[1].handedness).toBe('right');
    });

    it('clamps landmark x and y coordinates to [0, 1]', async () => {
      await tracker.initialize();

      const landmarks = Array.from({ length: 21 }, () => ({
        x: 1.5,
        y: -0.3,
        z: 0.5,
      }));

      mockSend.mockImplementation(async () => {
        triggerResults({
          multiHandLandmarks: [landmarks],
          multiHandedness: [{ label: 'Right', score: 0.9 }],
        });
      });

      const result = await tracker.processFrame(mockVideo, 640, 480);

      expect(result.hands[0].landmarks[0].x).toBe(0);
      expect(result.hands[0].landmarks[0].y).toBe(0);
    });

    it('does not clamp z coordinate (depth is relative)', async () => {
      await tracker.initialize();

      const landmarks = Array.from({ length: 21 }, () => ({
        x: 0.5,
        y: 0.5,
        z: -2.5,
      }));

      mockSend.mockImplementation(async () => {
        triggerResults({
          multiHandLandmarks: [landmarks],
          multiHandedness: [{ label: 'Right', score: 0.9 }],
        });
      });

      const result = await tracker.processFrame(mockVideo, 640, 480);

      expect(result.hands[0].landmarks[0].z).toBe(-2.5);
    });

    it('filters out hands with confidence below MIN_CONFIDENCE', async () => {
      await tracker.initialize();

      const landmarks = createMockLandmarks(21);
      mockSend.mockImplementation(async () => {
        triggerResults({
          multiHandLandmarks: [landmarks],
          multiHandedness: [{ label: 'Right', score: 0.3 }],
        });
      });

      const result = await tracker.processFrame(mockVideo, 640, 480);

      expect(result.hands).toHaveLength(0);
    });

    it('skips hands with incorrect landmark count', async () => {
      await tracker.initialize();

      const badLandmarks = createMockLandmarks(15); // Not 21
      mockSend.mockImplementation(async () => {
        triggerResults({
          multiHandLandmarks: [badLandmarks],
          multiHandedness: [{ label: 'Right', score: 0.9 }],
        });
      });

      const result = await tracker.processFrame(mockVideo, 640, 480);

      expect(result.hands).toHaveLength(0);
    });

    it('includes timestamp in result', async () => {
      await tracker.initialize();

      mockSend.mockImplementation(async () => {
        triggerResults({
          multiHandLandmarks: [],
          multiHandedness: [],
        });
      });

      const before = performance.now();
      const result = await tracker.processFrame(mockVideo, 640, 480);
      const after = performance.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    it('sends video element to MediaPipe', async () => {
      await tracker.initialize();

      mockSend.mockImplementation(async () => {
        triggerResults({
          multiHandLandmarks: [],
          multiHandedness: [],
        });
      });

      await tracker.processFrame(mockVideo, 640, 480);

      expect(mockSend).toHaveBeenCalledWith({ image: mockVideo });
    });
  });

  describe('setMaxHands()', () => {
    it('sets maxHands to 1', async () => {
      await tracker.initialize();

      tracker.setMaxHands(1);

      expect(mockSetOptions).toHaveBeenLastCalledWith({ maxNumHands: 1 });
    });

    it('sets maxHands to 2', async () => {
      await tracker.initialize();

      tracker.setMaxHands(2);

      expect(mockSetOptions).toHaveBeenLastCalledWith({ maxNumHands: 2 });
    });

    it('limits results to maxHands even if more are detected', async () => {
      await tracker.initialize();
      tracker.setMaxHands(1);

      const landmarks1 = createMockLandmarks(21);
      const landmarks2 = createMockLandmarks(21);
      mockSend.mockImplementation(async () => {
        triggerResults({
          multiHandLandmarks: [landmarks1, landmarks2],
          multiHandedness: [
            { label: 'Left', score: 0.9 },
            { label: 'Right', score: 0.85 },
          ],
        });
      });

      const result = await tracker.processFrame(
        document.createElement('video'), 640, 480
      );

      expect(result.hands).toHaveLength(1);
    });

    it('can be called before initialize', () => {
      expect(() => tracker.setMaxHands(1)).not.toThrow();
    });

    it('applies maxHands during initialization if set before', async () => {
      tracker.setMaxHands(1);
      await tracker.initialize();

      expect(mockSetOptions).toHaveBeenCalledWith(
        expect.objectContaining({ maxNumHands: 1 })
      );
    });
  });
});
