// ponytail: time+random slug instead of a uuid dependency; collision odds are irrelevant at personal scale
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
