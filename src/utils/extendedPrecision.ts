/**
 * Extended precision arithmetic using double-double representation.
 * Each number is stored as (hi, lo) where the true value is hi + lo.
 * This gives approximately 31 significant decimal digits of precision.
 */

export interface DoublePair {
  hi: number;
  lo: number;
}

/**
 * Create a DoublePair from a single number
 */
export function fromNumber(x: number): DoublePair {
  return { hi: x, lo: 0 };
}

/**
 * Convert DoublePair back to a single number (loses precision)
 */
export function toNumber(x: DoublePair): number {
  return x.hi + x.lo;
}

/**
 * Two-sum algorithm: computes (s, e) where a + b = s + e exactly,
 * with s being the rounded sum and e being the error.
 */
function twoSum(a: number, b: number): DoublePair {
  const s = a + b;
  const v = s - a;
  const e = (a - (s - v)) + (b - v);
  return { hi: s, lo: e };
}

/**
 * Quick two-sum when |a| >= |b|
 */
function quickTwoSum(a: number, b: number): DoublePair {
  const s = a + b;
  const e = b - (s - a);
  return { hi: s, lo: e };
}

/**
 * Add two DoublePairs with extended precision
 */
export function add(a: DoublePair, b: DoublePair): DoublePair {
  // Add the high parts
  let { hi: s1, lo: s2 } = twoSum(a.hi, b.hi);
  // Add the low parts
  const { hi: t1, lo: t2 } = twoSum(a.lo, b.lo);
  
  // Combine
  s2 += t1;
  const r = quickTwoSum(s1, s2);
  const lo = r.lo + t2;
  return quickTwoSum(r.hi, lo);
}

/**
 * Subtract two DoublePairs: a - b
 */
export function subtract(a: DoublePair, b: DoublePair): DoublePair {
  return add(a, { hi: -b.hi, lo: -b.lo });
}

/**
 * Add a regular number to a DoublePair
 */
export function addNumber(a: DoublePair, b: number): DoublePair {
  const { hi: s1, lo: s2 } = twoSum(a.hi, b);
  const lo = s2 + a.lo;
  return quickTwoSum(s1, lo);
}

/**
 * Subtract a regular number from a DoublePair
 */
export function subtractNumber(a: DoublePair, b: number): DoublePair {
  return addNumber(a, -b);
}

/**
 * Multiply DoublePair by a regular number
 */
export function multiplyNumber(a: DoublePair, b: number): DoublePair {
  // Split b into hi and lo parts for more precision
  const p1 = a.hi * b;
  const p2 = a.lo * b;
  return quickTwoSum(p1, p2);
}

/**
 * Normalize a DoublePair (ensure hi contains the main value)
 */
export function normalize(a: DoublePair): DoublePair {
  return quickTwoSum(a.hi, a.lo);
}

/**
 * Check if extended precision is needed based on zoom level.
 * At zoom > 1e13, standard float64 starts losing precision for panning.
 */
export function needsExtendedPrecision(zoom: number): boolean {
  return zoom > 1e13;
}
