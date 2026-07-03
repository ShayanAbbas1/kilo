export type Unit = 'kg' | 'lbs';

const KG_PER_LB = 0.45359237;

/** DB stores kg canonically; these convert at the display/input boundary only. */
export function toDisplayWeight(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

/** 92.49999 -> "92.5"; 100 -> "100" */
export function formatWeight(kg: number, unit: Unit): string {
  const v = toDisplayWeight(kg, unit);
  const rounded = Math.round(v * 100) / 100;
  return String(rounded);
}

export function weightLabel(kg: number, unit: Unit): string {
  return `${formatWeight(kg, unit)} ${unit}`;
}
