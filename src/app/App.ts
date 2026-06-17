import { CameraModule } from '../core/camera';
import { HandTracker, GestureDetector } from '../core/gesture';
import { EffectsCoordinator } from '../core/effects';
import { Renderer } from '../core/renderer';
import { AudioManager } from '../core/audio';
import { CanvasManager } from '../ui/CanvasManager';
import { OverlayManager } from '../ui/OverlayManager';
import { GameManager } from '../game';
import type { GestureStateEvent, HandTrackingResult } from '../shared/types';
import type { RenderState } from '../core/renderer';

/**
 * App orchestrates all modules: camera, hand tracking, gesture detection,
 * effects coordination, rendering, and audio.
 *
 * It runs two independent loops:
 * - Tracking loop (~30fps): camera → hand tracker → gesture detector
 * - Render loop (~60fps via rAF): effects coordinator → renderer
 */
export class App {
  private camera: CameraModule;
  private handTracker: HandTracker;
  private gestureDetector: GestureDetector;
  private effectsCoordinator: EffectsCoordinator;
  private renderer: Renderer;
  private audioManager: AudioManager;
  private canvasManager: CanvasManager;
  private overlayManager: OverlayManager;
  private gameManager: GameManager;

  private trackingIntervalId: number | null = null;
  private renderFrameId: number | null = null;
  private lastRenderTime: number = 0;
  private running = false;

  private lastTrackingResult: HandTrackingResult | null = null;
  private trackingFps = 0;
  private renderFps = 0;
  private trackingFrameCount = 0;
  private renderFrameCount = 0;
  private fpsTimerStart = 0;

  constructor() {
    this.camera = new CameraModule();
    this.handTracker = new HandTracker();
    this.gestureDetector = new GestureDetector();
    this.effectsCoordinator = new EffectsCoordinator();
    this.renderer = new Renderer();
    this.audioManager = new AudioManager();
    this.gameManager = new GameManager();

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.canvasManager = new CanvasManager(canvas);
    this.overlayManager = new OverlayManager(canvas.getContext('2d')!);
  }

  /**
   * Initialize all modules and wire up event connections.
   */
  async initialize(): Promise<void> {
    // Initialize canvas manager
    this.canvasManager.initialize();

    // Initialize renderer with the canvas
    const canvas = this.canvasManager.getCanvas();
    this.renderer.initialize(canvas);

    // Initialize camera
    await this.camera.initialize();

    // Initialize hand tracker
    await this.handTracker.initialize();

    // Initialize audio (may remain suspended until user interaction)
    await this.audioManager.initialize();

    // Wire gesture detector events → effects coordinator + audio manager
    this.gestureDetector.onStateChange((event: GestureStateEvent) => {
      this.effectsCoordinator.onGestureStateChange(event);
      this.audioManager.onGestureStateChange(event);

      // Disparo detectado → verifica colisão com alvos
      if (
        event.currentState === 'firing' &&
        event.data.handsCenterPosition &&
        event.data.firingDirection
      ) {
        this.gameManager.onFiring(
          event.data.handsCenterPosition,
          event.data.firingDirection,
          event.timestamp
        );
      }
    });

    // Set up camera error handling
    this.camera.onError((error) => {
      console.error('[App] Camera error:', error.type, 'type' in error && 'message' in error ? (error as { message: string }).message : '');
    });
  }

  /**
   * Start the application: begin camera capture, tracking loop, and render loop.
   */
  async start(): Promise<void> {
    if (this.running) return;

    await this.camera.start();
    this.running = true;
    this.fpsTimerStart = performance.now();
    this.trackingFrameCount = 0;
    this.renderFrameCount = 0;

    this.gameManager.start();
    this.startTrackingLoop();
    this.startRenderLoop();
  }

  /**
   * Stop the application: halt loops, stop camera, clean up.
   */
  stop(): void {
    this.running = false;

    if (this.trackingIntervalId !== null) {
      clearInterval(this.trackingIntervalId);
      this.trackingIntervalId = null;
    }

    if (this.renderFrameId !== null) {
      cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }

    this.camera.stop();
    this.audioManager.stopAll();
    this.renderer.destroy();
    this.canvasManager.destroy();
    this.gameManager.stop();
  }

  /**
   * Tracking loop runs at ~30fps via setInterval.
   * Processes camera frames through hand tracker and gesture detector.
   */
  private startTrackingLoop(): void {
    const TRACKING_INTERVAL = 33; // ~30fps

    const processFrame = async () => {
      if (!this.running || !this.camera.isActive()) return;

      try {
        const video = this.camera.getVideoElement();
        const { width, height } = this.canvasManager.getSize();
        const result = await this.handTracker.processFrame(video, width, height);
        this.lastTrackingResult = result;
        this.gestureDetector.update(result);
        this.trackingFrameCount++;
      } catch (error) {
        console.warn('[App] Tracking frame error:', error);
      }
    };

    this.trackingIntervalId = window.setInterval(processFrame, TRACKING_INTERVAL);
  }

  /**
   * Render loop runs at ~60fps via requestAnimationFrame.
   * Draws video background, updates effects, renders frame, draws overlays.
   */
  private startRenderLoop(): void {
    const renderFrame = (timestamp: number) => {
      if (!this.running) return;

      const deltaTime = this.lastRenderTime > 0 ? timestamp - this.lastRenderTime : 16;
      this.lastRenderTime = timestamp;

      // Update FPS counters every second
      this.updateFpsCounters(timestamp);

      // Update effects coordinator timers
      this.effectsCoordinator.update(deltaTime);

      // Update game (targets movement, score combo timer)
      const { width, height } = this.canvasManager.getSize();
      this.gameManager.update(deltaTime, width, height, timestamp);

      // Draw video background
      if (this.camera.isActive()) {
        this.canvasManager.drawVideoBackground(this.camera.getVideoElement());
      }

      // Build render state from current effects
      const effects = this.effectsCoordinator.getCurrentEffects();
      const chargeIntensity = effects.glow?.intensity ?? effects.beam?.intensity ?? 0;
      const renderState: RenderState = {
        gestureState: this.gestureDetector.getState(),
        handsCenterPosition: effects.glow?.position ?? effects.beam?.origin ?? null,
        chargeTime: this.gestureDetector.getChargeTime(),
        chargeIntensity,
        firingDirection: effects.beam?.direction ?? null,
        flashActive: effects.flash !== null,
        shakeActive: effects.shake !== null,
        canvasHeight: height,
        isFullyCharged: this.gestureDetector.getChargeIntensity() >= 0.3,
      };

      // Render effects
      this.renderer.render(renderState);

      // Colisão contínua enquanto o raio está ativo
      if (
        renderState.gestureState === 'firing' &&
        renderState.handsCenterPosition &&
        renderState.firingDirection
      ) {
        this.gameManager.onBeamActive(
          renderState.handsCenterPosition,
          renderState.firingDirection,
          timestamp
        );
      }

      // Render game targets and HUD
      this.gameManager.render(this.canvasManager.getContext(), width);

      // Draw debug overlays
      this.overlayManager.setSize(width, height);
      if (this.lastTrackingResult) {
        this.overlayManager.drawLandmarks(this.lastTrackingResult.hands);
      }
      this.overlayManager.drawFps(this.trackingFps, this.renderFps);

      this.renderFrameCount++;
      this.renderFrameId = requestAnimationFrame(renderFrame);
    };

    this.renderFrameId = requestAnimationFrame(renderFrame);
  }

  /**
   * Update FPS counters every second.
   */
  private updateFpsCounters(timestamp: number): void {
    const elapsed = timestamp - this.fpsTimerStart;
    if (elapsed >= 1000) {
      this.trackingFps = (this.trackingFrameCount / elapsed) * 1000;
      this.renderFps = (this.renderFrameCount / elapsed) * 1000;
      this.trackingFrameCount = 0;
      this.renderFrameCount = 0;
      this.fpsTimerStart = timestamp;
    }
  }

  /**
   * Unlock audio playback (must be called from a user gesture event).
   */
  async unlockAudio(): Promise<void> {
    await this.audioManager.unlockAudio();
  }
}
