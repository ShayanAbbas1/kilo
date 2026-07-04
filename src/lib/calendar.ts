/** Pure calendar/streak math — node-testable, no RN imports. Days are local YYYY-MM-DD strings. */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDayStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Weeks (Mon-first) of local-day strings covering `month` (0-11) of `year`; null pads days outside the month. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first offset: getDay() is 0=Sun..6=Sat.
  const leadingBlanks = (first.getDay() + 6) % 7;

  const cells: (string | null)[] = Array(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDayStr(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Monday's YYYY-MM-DD of the week containing `dayStr`. */
export function weekKey(dayStr: string): string {
  const [y, m, d] = dayStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return toDayStr(date);
}

/** Consecutive-week streaks (weekly, not daily) from a set of workout days. */
export function weekStreaks(days: Set<string>, today: string): { current: number; longest: number } {
  const weeks = new Set([...days].map(weekKey));
  const todayWeek = weekKey(today);

  const stepWeek = (wk: string, delta: number): string => {
    const [y, m, d] = wk.split('-').map(Number);
    const date = new Date(y, m - 1, d + delta * 7);
    return toDayStr(date);
  };

  // current: walk back from this week; an empty current week doesn't zero the
  // streak, it just doesn't count toward it — start counting from last week instead.
  let current = 0;
  let cursor = todayWeek;
  if (!weeks.has(cursor)) {
    cursor = stepWeek(cursor, -1);
  }
  while (weeks.has(cursor)) {
    current++;
    cursor = stepWeek(cursor, -1);
  }

  // longest: scan all weeks that have a workout, find the longest consecutive run.
  let longest = 0;
  let run = 0;
  const sorted = [...weeks].sort();
  let prev: string | null = null;
  for (const wk of sorted) {
    if (prev !== null && stepWeek(prev, 1) === wk) {
      run++;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = wk;
  }

  return { current, longest: Math.max(longest, current) };
}
