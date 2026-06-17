// shared/ - Tipos compartilhados, constantes e utilitários
// Exports: math utilities, constants, types, events

export {
  type Vec2,
  type Vec3,
  type Color,
  type Rect,
  distance2D,
  normalize2D,
  lerp,
  clamp,
  midpoint,
} from './math';

export {
  GESTURE_CONSTANTS,
  RENDER_CONSTANTS,
  CAMERA_CONSTANTS,
} from './constants';

export {
  type GestureState,
  type GestureStateEvent,
  type GestureEventData,
  type CameraError,
  type HandTrackingResult,
  type HandData,
  type Landmark,
  type AppState,
} from './types';

export {
  type EventMap,
  type Listener,
  EventEmitter,
} from './events';
