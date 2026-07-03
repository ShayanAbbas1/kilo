import type { Unit } from './units';

/** Plate math happens in DISPLAY units — a lifter loads 20kg or 45lb plates, never converted. */
const BAR: Record<Unit, number> = { kg: 20, lbs: 45 };
const PLATES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lbs: [45, 35, 25, 10, 5, 2.5],
};

// ponytail: integer cents (x100) sidesteps float drift from repeated 1.25/2.5 subtraction
const SCALE = 100;
const toInt = (n: number) => Math.round(n * SCALE);

export function platesPerSide(
  target: number,
  unit: Unit,
): { bar: number; plates: number[]; remainder: number } {
  const bar = BAR[unit];
  if (target <= bar) return { bar, plates: [], remainder: 0 };

  let perSide = toInt((target - bar) / 2);
  const plates: number[] = [];
  for (const p of PLATES[unit]) {
    const pInt = toInt(p);
    while (perSide >= pInt) {
      plates.push(p);
      perSide -= pInt;
    }
  }
  return { bar, plates, remainder: perSide / SCALE };
}
