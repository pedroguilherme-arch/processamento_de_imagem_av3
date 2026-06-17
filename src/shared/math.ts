// shared/math.ts - Tipos matemáticos e funções utilitárias

/**
 * Vetor 2D representando posição ou direção no plano.
 */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Vetor 3D representando posição ou direção no espaço.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Cor RGBA. r, g, b: 0..255, a: 0..1
 */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Retângulo definido por posição e dimensões.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calcula a distância euclidiana entre dois pontos 2D.
 * √((x₂-x₁)² + (y₂-y₁)²)
 */
export function distance2D(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normaliza um vetor 2D para comprimento unitário.
 * Retorna vetor zero se o comprimento for zero.
 */
export function normalize2D(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) {
    return { x: 0, y: 0 };
  }
  return { x: v.x / len, y: v.y / len };
}

/**
 * Interpolação linear entre dois valores.
 * Retorna a quando t=0, b quando t=1.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Restringe um valor ao intervalo [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calcula o ponto médio entre dois pontos 2D.
 */
export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}
