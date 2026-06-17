// shared/constants.ts - Constantes da aplicação

export const GESTURE_CONSTANTS = {
  CHARGE_DISTANCE_THRESHOLD: 140,   // pixels — mãos a menos disso para iniciar/manter carga
  FIRE_DISTANCE_INCREASE: 120,      // pixels — separação rápida também dispara (fallback)
  FIRE_TIME_WINDOW: 600,            // ms — janela de tempo para gesto de separação
  IDLE_TIMEOUT: 1200,               // ms — tempo sem mãos antes de voltar ao idle
  MIN_CONFIDENCE: 0.7,              // 0..1
  DRIFT_CANCEL_DISTANCE: 320,       // pixels — distância máxima antes de cancelar carga por drift lento
  MAX_CHARGE_TIME: 3000,            // ms — tempo para carga máxima (intensity = 1)
  MIN_CHARGE_TO_FIRE: 0.3,          // intensidade mínima para poder disparar (0..1)
  // Gesto de push: mãos descem rapidamente enquanto permanecem juntas
  PUSH_Y_SPEED_THRESHOLD: 300,      // px/s — velocidade descendente mínima para detectar push
  PUSH_MAX_DISTANCE: 200,           // pixels — mãos ainda devem estar próximas durante o push
  FIRING_TIMEOUT: 1000,             // ms — duração máxima do estado firing (raio some após 1s)
} as const;

export const RENDER_CONSTANTS = {
  MAX_PARTICLES: 500,
  FLASH_DURATION: 150,               // ms
  SHAKE_DURATION: 400,               // ms
  BEAM_FADE_DURATION: 400,           // ms — fade do raio (deve ser <= FIRING_TIMEOUT)
  TARGET_FPS: 60,
  FRAME_BUDGET: 33,                  // ms (30fps mínimo)
} as const;

export const CAMERA_CONSTANTS = {
  MIN_WIDTH: 640,
  MIN_HEIGHT: 480,
  TARGET_FPS: 30,
} as const;
