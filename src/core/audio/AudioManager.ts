// core/audio/AudioManager.ts - Gerenciamento de áudio via Web Audio API

import type { GestureStateEvent } from '../../shared/types';

/**
 * Interface pública do AudioManager.
 */
export interface IAudioManager {
  initialize(): Promise<void>;
  playChargingSound(): void;
  playFiringSound(): void;
  playExplosionSound(): void;
  stopAll(): void;
  setVolume(volume: number): void;
  isUnlocked(): boolean;
  unlockAudio(): Promise<void>;
  onGestureStateChange(event: GestureStateEvent): void;
}

/**
 * AudioManager implementa IAudioManager usando Web Audio API.
 *
 * Carregamento (charging): reproduz /audio.mp3 via AudioBuffer decodificado
 *   no AudioContext, em loop enquanto o estado for 'charging'.
 * Firing: burst sintético de alta frequência.
 * Explosion: rumble sintético grave.
 */
export class AudioManager implements IAudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];

  // Charging — reprodução do MP3
  private chargingBuffer: AudioBuffer | null = null;
  private chargingSource: AudioBufferSourceNode | null = null;
  private chargingGain: GainNode | null = null;

  // Firing — reprodução do MP3
  private firingBuffer: AudioBuffer | null = null;

  private volume: number = 1;

  /** Caminho do MP3 de carregamento, relativo à raiz do servidor */
  private static readonly CHARGING_MP3 = '/pt-br.mp3';

  /** Caminho do MP3 de disparo, relativo à raiz do servidor */
  private static readonly FIRING_MP3 = '/disparo.mp3';

  async initialize(): Promise<void> {
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.context.destination);

    // Pré-carrega os MP3s em background (não bloqueia se falhar)
    this.loadChargingAudio().catch(() => {
      // Se o MP3 não carregar, cai no fallback sintético silenciosamente
    });
    this.loadFiringAudio().catch(() => {
      // Fallback sintético se o MP3 de disparo não carregar
    });
  }

  /**
   * Faz fetch do MP3 de carregamento e decodifica como AudioBuffer.
   */
  private async loadChargingAudio(): Promise<void> {
    if (!this.context) return;
    const response = await fetch(AudioManager.CHARGING_MP3);
    if (!response.ok) throw new Error(`Failed to fetch ${AudioManager.CHARGING_MP3}`);
    const arrayBuffer = await response.arrayBuffer();
    this.chargingBuffer = await this.context.decodeAudioData(arrayBuffer);
  }

  /**
   * Faz fetch do MP3 de disparo e decodifica como AudioBuffer.
   */
  private async loadFiringAudio(): Promise<void> {
    if (!this.context) return;
    const response = await fetch(AudioManager.FIRING_MP3);
    if (!response.ok) throw new Error(`Failed to fetch ${AudioManager.FIRING_MP3}`);
    const arrayBuffer = await response.arrayBuffer();
    this.firingBuffer = await this.context.decodeAudioData(arrayBuffer);
  }

  async unlockAudio(): Promise<void> {
    if (!this.context) {
      await this.initialize();
    }
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  isUnlocked(): boolean {
    return this.context !== null && this.context.state === 'running';
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  /**
   * Reproduz o MP3 de carregamento em loop.
   * Se o buffer ainda não estiver pronto, usa o oscilador sintético como fallback.
   */
  playChargingSound(): void {
    if (!this.context || !this.masterGain) return;
    this.stopChargingSound();

    if (this.chargingBuffer) {
      // ── MP3 carregado: usa AudioBuffer ──────────────────────────────────
      const source = this.context.createBufferSource();
      const gainNode = this.context.createGain();

      source.buffer = this.chargingBuffer;
      source.loop = true;

      gainNode.gain.setValueAtTime(0, this.context.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, this.context.currentTime + 0.3);

      source.connect(gainNode);
      gainNode.connect(this.masterGain);
      source.start();

      this.chargingSource = source;
      this.chargingGain = gainNode;
      this.activeNodes.push(source, gainNode);
    } else {
      // ── Fallback sintético enquanto o MP3 ainda carrega ──────────────────
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(80, this.context.currentTime);
      oscillator.frequency.linearRampToValueAtTime(300, this.context.currentTime + 3);

      gainNode.gain.setValueAtTime(0, this.context.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.4, this.context.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      oscillator.start();

      // Reutiliza os campos de charging para que stopChargingSound funcione
      this.chargingSource = oscillator as unknown as AudioBufferSourceNode;
      this.chargingGain = gainNode;
      this.activeNodes.push(oscillator, gainNode);
    }
  }

  playFiringSound(): void {
    if (!this.context || !this.masterGain) return;

    this.stopChargingSound();

    if (this.firingBuffer) {
      // ── MP3 carregado: usa AudioBuffer ──────────────────────────────────
      const source = this.context.createBufferSource();
      source.buffer = this.firingBuffer;
      source.connect(this.masterGain);
      source.start();
      this.activeNodes.push(source);
    } else {
      // ── Fallback sintético ───────────────────────────────────────────────
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(800, this.context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, this.context.currentTime + 0.5);

      gainNode.gain.setValueAtTime(0.6, this.context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.8);

      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      oscillator.start();
      oscillator.stop(this.context.currentTime + 0.8);

      this.activeNodes.push(oscillator, gainNode);
    }
  }

  playExplosionSound(): void {
    if (!this.context || !this.masterGain) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(60, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(20, this.context.currentTime + 1.0);

    gainNode.gain.setValueAtTime(0.7, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 1.0);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    oscillator.start();
    oscillator.stop(this.context.currentTime + 1.0);

    this.activeNodes.push(oscillator, gainNode);
  }

  stopAll(): void {
    this.stopChargingSound();

    for (const node of this.activeNodes) {
      try {
        if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
          node.stop();
        }
        node.disconnect();
      } catch {
        // Node may already be stopped or disconnected
      }
    }
    this.activeNodes = [];
  }

  onGestureStateChange(event: GestureStateEvent): void {
    switch (event.currentState) {
      case 'charging':
        this.playChargingSound();
        break;
      case 'firing':
        this.playFiringSound();
        break;
      case 'idle':
        this.stopAll();
        break;
    }
  }

  private stopChargingSound(): void {
    if (this.chargingSource) {
      try {
        this.chargingSource.stop();
        this.chargingSource.disconnect();
      } catch {
        // Already stopped
      }
      this.chargingSource = null;
    }
    if (this.chargingGain) {
      try {
        this.chargingGain.disconnect();
      } catch {
        // Already disconnected
      }
      this.chargingGain = null;
    }
  }
}
