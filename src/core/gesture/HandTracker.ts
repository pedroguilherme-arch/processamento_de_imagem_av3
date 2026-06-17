import { Hands, Results } from '@mediapipe/hands';
import { GESTURE_CONSTANTS } from '../../shared/constants';
import type { HandData, HandTrackingResult, Landmark } from '../../shared/types';

/**
 * Interface for the HandTracker module.
 */
export interface IHandTracker {
  initialize(): Promise<void>;
  processFrame(video: HTMLVideoElement, canvasWidth: number, canvasHeight: number): Promise<HandTrackingResult>;
  setMaxHands(count: 1 | 2): void;
}

/**
 * HandTracker wraps MediaPipe Hands and normalizes its output
 * into the application's HandTrackingResult format.
 */
export class HandTracker implements IHandTracker {
  private hands: Hands | null = null;
  private maxHands: 1 | 2 = 2;
  private initialized = false;
  private latestResults: Results | null = null;
  private resolveFrame: ((value: void) => void) | null = null;

  /**
   * Initializes the MediaPipe Hands instance with default configuration.
   */
  async initialize(): Promise<void> {
    this.hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.hands.setOptions({
      maxNumHands: this.maxHands,
      modelComplexity: 1,
      minDetectionConfidence: GESTURE_CONSTANTS.MIN_CONFIDENCE,
      minTrackingConfidence: GESTURE_CONSTANTS.MIN_CONFIDENCE,
    });

    this.hands.onResults((results: Results) => {
      this.latestResults = results;
      if (this.resolveFrame) {
        this.resolveFrame();
        this.resolveFrame = null;
      }
    });

    // Send a dummy frame to trigger model loading
    await this.hands.initialize();
    this.initialized = true;
  }

  /**
   * Processes a video frame and returns hand tracking results with landmarks
   * desnormalized to pixel coordinates based on the canvas dimensions.
   */
  async processFrame(video: HTMLVideoElement, canvasWidth: number, canvasHeight: number): Promise<HandTrackingResult> {
    if (!this.hands || !this.initialized) {
      throw new Error('HandTracker not initialized. Call initialize() first.');
    }

    this.latestResults = null;

    const framePromise = new Promise<void>((resolve) => {
      this.resolveFrame = resolve;
    });

    await this.hands.send({ image: video });
    await framePromise;

    const timestamp = performance.now();

    if (!this.latestResults) {
      return { hands: [], timestamp };
    }

    const hands = this.normalizeResults(this.latestResults, canvasWidth, canvasHeight);
    return { hands, timestamp };
  }

  /**
   * Sets the maximum number of hands to detect (1 or 2).
   */
  setMaxHands(count: 1 | 2): void {
    this.maxHands = count;
    if (this.hands) {
      this.hands.setOptions({ maxNumHands: count });
    }
  }

  /**
   * Normalizes MediaPipe results into the application's HandData format,
   * converting landmark coordinates from 0..1 to pixel space using canvas dimensions.
   * The x axis is also mirrored (1 - x) to match the horizontally-flipped video.
   */
  private normalizeResults(results: Results, canvasWidth: number, canvasHeight: number): HandData[] {
    const { multiHandLandmarks, multiHandedness } = results;

    if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
      return [];
    }

    const hands: HandData[] = [];
    const limit = Math.min(multiHandLandmarks.length, this.maxHands);

    for (let i = 0; i < limit; i++) {
      const rawLandmarks = multiHandLandmarks[i];
      const handedness = multiHandedness?.[i];

      if (!rawLandmarks || rawLandmarks.length !== 21) {
        continue;
      }

      const confidence = handedness?.score ?? 0;
      if (confidence < GESTURE_CONSTANTS.MIN_CONFIDENCE) {
        continue;
      }

      const landmarks: Landmark[] = rawLandmarks.map((lm) => ({
        // Mirror x to match the horizontally-flipped video, then convert to pixels
        x: (1 - clamp(lm.x, 0, 1)) * canvasWidth,
        y: clamp(lm.y, 0, 1) * canvasHeight,
        z: lm.z,
      }));

      const label = handedness?.label?.toLowerCase() ?? 'right';
      const handednessValue: 'left' | 'right' =
        label === 'left' ? 'left' : 'right';

      hands.push({
        landmarks,
        handedness: handednessValue,
        confidence,
      });
    }

    return hands;
  }
}

/**
 * Clamps a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
