// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioManager } from './AudioManager';
import type { GestureStateEvent } from '../../shared/types';

function mockOsc() {
  return { type: 'sine' as OscillatorType, frequency: { value: 440, setValueAtTime: vi.fn().mockReturnThis(), linearRampToValueAtTime: vi.fn().mockReturnThis(), exponentialRampToValueAtTime: vi.fn().mockReturnThis() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
}

function mockGain() {
  return { gain: { value: 1, setValueAtTime: vi.fn().mockReturnThis(), linearRampToValueAtTime: vi.fn().mockReturnThis(), exponentialRampToValueAtTime: vi.fn().mockReturnThis() }, connect: vi.fn(), disconnect: vi.fn() };
}

function mockAudioCtx(state: AudioContextState = 'running') {
  return { state, currentTime: 0, destination: {}, createOscillator: vi.fn(() => mockOsc()), createGain: vi.fn(() => mockGain()), resume: vi.fn().mockResolvedValue(undefined) };
}

function chargingEvt(): GestureStateEvent {
  return { previousState: 'idle', currentState: 'charging', timestamp: 1000, data: { handsCenterPosition: { x: 0.5, y: 0.5 }, chargeTime: 0 } };
}

function firingEvt(): GestureStateEvent {
  return { previousState: 'charging', currentState: 'firing', timestamp: 2000, data: { handsCenterPosition: { x: 0.5, y: 0.5 }, chargeTime: 1000, firingDirection: { x: 1, y: 0 }, separationSpeed: 300 } };
}

function idleEvt(): GestureStateEvent {
  return { previousState: 'firing', currentState: 'idle', timestamp: 3000, data: {} };
}

describe('AudioManager', () => {
  let am: AudioManager;
  let ctx: ReturnType<typeof mockAudioCtx>;

  beforeEach(() => {
    ctx = mockAudioCtx('running');
    vi.stubGlobal('AudioContext', vi.fn(() => ctx));
    am = new AudioManager();
  });

  describe('initialize', () => {
    it('creates AudioContext and gain', async () => {
      await am.initialize();
      expect(AudioContext).toHaveBeenCalledOnce();
      expect(ctx.createGain).toHaveBeenCalled();
    });
  });

  describe('unlockAudio', () => {
    it('inits if needed and resumes suspended context', async () => {
      const suspended = mockAudioCtx('suspended');
      vi.stubGlobal('AudioContext', vi.fn(() => suspended));
      const mgr = new AudioManager();
      await mgr.unlockAudio();
      expect(suspended.resume).toHaveBeenCalled();
    });

    it('does not resume running context', async () => {
      await am.initialize();
      await am.unlockAudio();
      expect(ctx.resume).not.toHaveBeenCalled();
    });
  });

  describe('isUnlocked', () => {
    it('false before init', () => { expect(am.isUnlocked()).toBe(false); });
    it('true when running', async () => { await am.initialize(); expect(am.isUnlocked()).toBe(true); });
    it('false when suspended', async () => {
      const s = mockAudioCtx('suspended');
      vi.stubGlobal('AudioContext', vi.fn(() => s));
      const m = new AudioManager();
      await m.initialize();
      expect(m.isUnlocked()).toBe(false);
    });
  });

  describe('setVolume', () => {
    it('sets gain value clamped 0-1', async () => {
      await am.initialize();
      const g = ctx.createGain.mock.results[0].value;
      am.setVolume(0.5); expect(g.gain.value).toBe(0.5);
      am.setVolume(-1); expect(g.gain.value).toBe(0);
      am.setVolume(2); expect(g.gain.value).toBe(1);
    });
  });

  describe('playChargingSound', () => {
    it('does nothing if not initialized', () => { am.playChargingSound(); expect(ctx.createOscillator).not.toHaveBeenCalled(); });
    it('creates sine oscillator with low freq ramp', async () => {
      await am.initialize();
      am.playChargingSound();
      const osc = ctx.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('sine');
      expect(osc.start).toHaveBeenCalled();
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(80, 0);
      expect(osc.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(300, 3);
      expect(osc.connect).toHaveBeenCalled();
    });
  });

  describe('playFiringSound', () => {
    it('does nothing if not initialized', () => { am.playFiringSound(); expect(ctx.createOscillator).not.toHaveBeenCalled(); });
    it('creates sawtooth with high-to-low sweep', async () => {
      await am.initialize();
      am.playFiringSound();
      const osc = ctx.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('sawtooth');
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(800, 0);
      expect(osc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(200, 0.5);
      expect(osc.stop).toHaveBeenCalledWith(0.8);
    });
    it('stops charging sound first', async () => {
      await am.initialize();
      am.playChargingSound();
      const chOsc = ctx.createOscillator.mock.results[0].value;
      am.playFiringSound();
      expect(chOsc.stop).toHaveBeenCalled();
    });
  });

  describe('playExplosionSound', () => {
    it('does nothing if not initialized', () => { am.playExplosionSound(); expect(ctx.createOscillator).not.toHaveBeenCalled(); });
    it('creates square oscillator rumble', async () => {
      await am.initialize();
      am.playExplosionSound();
      const osc = ctx.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('square');
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(60, 0);
      expect(osc.stop).toHaveBeenCalledWith(1.0);
    });
  });

  describe('stopAll', () => {
    it('stops and disconnects active nodes', async () => {
      await am.initialize();
      am.playChargingSound();
      am.stopAll();
      const osc = ctx.createOscillator.mock.results[0].value;
      expect(osc.stop).toHaveBeenCalled();
      expect(osc.disconnect).toHaveBeenCalled();
    });
    it('allows playing again after stop', async () => {
      await am.initialize();
      am.playChargingSound();
      am.stopAll();
      am.playFiringSound();
      const osc2 = ctx.createOscillator.mock.results[1].value;
      expect(osc2.start).toHaveBeenCalled();
    });
  });

  describe('onGestureStateChange', () => {
    it('plays charging on charging transition', async () => {
      await am.initialize();
      am.onGestureStateChange(chargingEvt());
      const osc = ctx.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('sine');
      expect(osc.start).toHaveBeenCalled();
    });
    it('plays firing on firing transition', async () => {
      await am.initialize();
      am.onGestureStateChange(firingEvt());
      const osc = ctx.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('sawtooth');
    });
    it('stops all on idle transition', async () => {
      await am.initialize();
      am.onGestureStateChange(chargingEvt());
      am.onGestureStateChange(idleEvt());
      const osc = ctx.createOscillator.mock.results[0].value;
      expect(osc.stop).toHaveBeenCalled();
    });
    it('full lifecycle: charging -> firing -> idle', async () => {
      await am.initialize();
      am.onGestureStateChange(chargingEvt());
      const c = ctx.createOscillator.mock.results[0].value;
      expect(c.type).toBe('sine');
      am.onGestureStateChange(firingEvt());
      expect(c.stop).toHaveBeenCalled();
      const f = ctx.createOscillator.mock.results[1].value;
      expect(f.type).toBe('sawtooth');
      am.onGestureStateChange(idleEvt());
      expect(f.stop).toHaveBeenCalled();
    });
  });
});