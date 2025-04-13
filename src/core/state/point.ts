import Decimal from 'decimal.js';

/*
 * To ensure consistent behavior across all platforms and clients, we use decimal.js (deterministic floating
 * point library) to represent all floating point numbers in the game state.
 * In a real scenario, extra care must be taken when sending game state values over the network,
 * since transmission of floating point numbers can result in precision loss.
 */
export interface Point2D {
  x: Decimal;
  y: Decimal;
}

/* Non-deterministic floating point numbers can still be used for non-critical tasks, e.g. rendering. */
export interface UnsafePoint2D {
  x: number;
  y: number;
}

/**
 * Convert a Point2D object to an UnsafePoint2D object.
 *
 * @param {Point2D} point - The Point2D object to convert
 * @returns {UnsafePoint2D} The converted UnsafePoint2D object
 */
export function toUnsafePoint2D(point: Point2D): UnsafePoint2D {
  return { x: point.x.toNumber(), y: point.y.toNumber() };
}
