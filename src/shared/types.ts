// shared/types.ts - Tipos de eventos e interfaces compartilhadas

import type { Vec2 } from './math';

/**
 * Estados possíveis do gesto na máquina de estados.
 * - idle: nenhum gesto ativo
 * - charging: mãos próximas, acumulando energia
 * - firing: mãos se afastando rapidamente, disparando
 */
export type GestureState = 'idle' | 'charging' | 'firing';

/**
 * Dados associados a um evento de transição de gesto.
 */
export interface GestureEventData {
  /** Posição central entre as duas mãos */
  handsCenterPosition?: Vec2;
  /** Tempo acumulado de carga em milissegundos */
  chargeTime?: number;
  /** Direção normalizada do disparo */
  firingDirection?: Vec2;
  /** Velocidade de separação das mãos em pixels/segundo */
  separationSpeed?: number;
}

/**
 * Evento emitido quando o GestureState transiciona entre estados.
 */
export interface GestureStateEvent {
  previousState: GestureState;
  currentState: GestureState;
  timestamp: number;
  data: GestureEventData;
}

/**
 * Erro de câmera tipado.
 */
export type CameraError =
  | { type: 'permission_denied' }
  | { type: 'no_device' }
  | { type: 'stream_error'; message: string };

/**
 * Resultado do rastreamento de mãos.
 */
export interface HandTrackingResult {
  hands: HandData[];
  timestamp: number;
}

/**
 * Dados de uma mão detectada.
 */
export interface HandData {
  landmarks: Landmark[];
  handedness: 'left' | 'right';
  confidence: number;
}

/**
 * Ponto de referência 3D detectado pelo MediaPipe.
 */
export interface Landmark {
  x: number; // 0..1 normalizado
  y: number; // 0..1 normalizado
  z: number; // profundidade relativa
}

/**
 * Estado global da aplicação.
 */
export interface AppState {
  camera: {
    isActive: boolean;
    hasPermission: boolean;
    error: CameraError | null;
  };
  tracking: {
    isProcessing: boolean;
    lastResult: HandTrackingResult | null;
    fps: number;
  };
  gesture: {
    state: GestureState;
    chargeStartTime: number | null;
    chargeIntensity: number;
    lastTransition: GestureStateEvent | null;
  };
  render: {
    fps: number;
    activeParticles: number;
    isFlashing: boolean;
    isShaking: boolean;
  };
  debug: {
    showLandmarks: boolean;
    showFps: boolean;
  };
}
