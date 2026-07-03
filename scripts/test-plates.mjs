// `node scripts/test-plates.mjs` — plate math (greedy per-side breakdown)
import assert from 'node:assert/strict';
import { platesPerSide } from '../src/lib/plates.ts';

// exact load: 100kg total, bar 20 -> 40/side -> greedy 25+15 (15kg plate makes this the optimal exact split)
assert.deepEqual(platesPerSide(100, 'kg'), { bar: 20, plates: [25, 15], remainder: 0 });

// inexact: 101kg total -> 40.5/side -> 25+15, 0.5kg per side left over
assert.deepEqual(platesPerSide(101, 'kg'), { bar: 20, plates: [25, 15], remainder: 0.5 });

// target == bar: nothing to load
assert.deepEqual(platesPerSide(20, 'kg'), { bar: 20, plates: [], remainder: 0 });

// target < bar: still nothing to load, no negative math
assert.deepEqual(platesPerSide(15, 'kg'), { bar: 20, plates: [], remainder: 0 });

// lbs: 225lb -> 90/side -> two 45s
assert.deepEqual(platesPerSide(225, 'lbs'), { bar: 45, plates: [45, 45], remainder: 0 });

// float-sensitive: 102.5kg -> 41.25/side -> 25+15+1.25, exact (no float drift remainder)
assert.deepEqual(platesPerSide(102.5, 'kg'), { bar: 20, plates: [25, 15, 1.25], remainder: 0 });

console.log('test-plates: all assertions passed');
