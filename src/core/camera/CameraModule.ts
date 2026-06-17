// core/camera/CameraModule.ts - Gerenciamento de acesso à webcam

import { CAMERA_CONSTANTS } from '../../shared/constants';
import type { CameraError } from '../../shared/types';

/**
 * Interface do módulo de câmera.
 */
export interface ICameraModule {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): void;
  getVideoElement(): HTMLVideoElement;
  getStream(): MediaStream | null;
  isActive(): boolean;
  onError(callback: (error: CameraError) => void): void;
}

/**
 * CameraModule gerencia o acesso à webcam do usuário.
 *
 * Responsabilidades:
 * - Solicitar permissão de câmera via getUserMedia
 * - Criar e configurar elemento de vídeo oculto para captura de frames
 * - Tratar erros de permissão, dispositivo ausente e stream
 * - Fornecer o HTMLVideoElement para processamento por outros módulos
 */
export class CameraModule implements ICameraModule {
  private videoElement: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private active = false;
  private errorCallbacks: Array<(error: CameraError) => void> = [];

  constructor() {
    this.videoElement = document.createElement('video');
    this.videoElement.setAttribute('autoplay', '');
    this.videoElement.setAttribute('playsinline', '');
    this.videoElement.setAttribute('muted', '');
    this.videoElement.muted = true;
    // Usar visibility:hidden + position:fixed em vez de display:none
    // display:none pode travar o readyState em HAVE_METADATA em alguns browsers,
    // impedindo que drawVideoBackground consiga desenhar o frame.
    this.videoElement.style.position = 'fixed';
    this.videoElement.style.top = '-9999px';
    this.videoElement.style.left = '-9999px';
    this.videoElement.style.width = '1px';
    this.videoElement.style.height = '1px';
    this.videoElement.style.opacity = '0';
    this.videoElement.style.pointerEvents = 'none';
    document.body.appendChild(this.videoElement);
  }

  /**
   * Inicializa o módulo de câmera solicitando acesso via getUserMedia.
   * Configura constraints de resolução mínima e fps alvo.
   *
   * @throws Emite CameraError via callbacks registrados em caso de falha.
   */
  async initialize(): Promise<void> {
    const constraints: MediaStreamConstraints = {
      video: {
        width: { min: CAMERA_CONSTANTS.MIN_WIDTH },
        height: { min: CAMERA_CONSTANTS.MIN_HEIGHT },
        frameRate: { ideal: CAMERA_CONSTANTS.TARGET_FPS },
      },
      audio: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
    } catch (error) {
      const cameraError = this.mapError(error);
      this.emitError(cameraError);
      throw error;
    }
  }

  /**
   * Inicia a reprodução do vídeo capturado.
   * Deve ser chamado após initialize().
   */
  async start(): Promise<void> {
    if (!this.stream) {
      const error: CameraError = { type: 'stream_error', message: 'Stream not initialized. Call initialize() first.' };
      this.emitError(error);
      throw new Error(error.message);
    }

    try {
      await this.videoElement.play();
      this.active = true;
    } catch (error) {
      const cameraError: CameraError = {
        type: 'stream_error',
        message: error instanceof Error ? error.message : 'Failed to start video playback',
      };
      this.emitError(cameraError);
      throw error;
    }
  }

  /**
   * Para a captura de vídeo e libera os recursos da câmera.
   */
  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.videoElement.srcObject = null;
    this.active = false;

    // Remove o elemento de vídeo do DOM ao parar
    if (this.videoElement.parentElement) {
      this.videoElement.parentElement.removeChild(this.videoElement);
    }
  }

  /**
   * Retorna o elemento de vídeo usado para captura de frames.
   */
  getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }

  /**
   * Retorna o MediaStream ativo ou null se não inicializado.
   */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Indica se a câmera está ativamente capturando vídeo.
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Registra um callback para receber notificações de erro.
   */
  onError(callback: (error: CameraError) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Mapeia erros do getUserMedia para o tipo CameraError.
   */
  private mapError(error: unknown): CameraError {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          return { type: 'permission_denied' };

        case 'NotFoundError':
        case 'DevicesNotFoundError':
          return { type: 'no_device' };

        default:
          return { type: 'stream_error', message: error.message };
      }
    }

    if (error instanceof Error) {
      return { type: 'stream_error', message: error.message };
    }

    return { type: 'stream_error', message: 'Unknown camera error' };
  }

  /**
   * Emite um erro para todos os callbacks registrados.
   */
  private emitError(error: CameraError): void {
    for (const callback of this.errorCallbacks) {
      callback(error);
    }
  }
}
