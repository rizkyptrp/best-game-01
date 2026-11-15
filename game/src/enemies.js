// Who attacks each wave, and when. A wave is a spawn queue: entries of
// { kind, at } in seconds from the wave's start, plus the boss of a boss wave.
// Normal waves spend a points budget that grows with the wave number; wave 5
// brings the Gloombrute, wave 10 the Hollow Maw, each with an escort.
import { WAVES } from './config.js';

/** What each kind costs from a wave's budget. */
const COST = { wisp: 1, dasher: 2, spitter: 3, husk: 4 };

/** Which kinds a wave may spend its budget on (later waves unlock the rest). */
function unlockedKinds(wave) {
  const kinds = ['wisp'];
  if (wave >= 2) kinds.push('dasher');
  if (wave >= 3) kinds.push('spitter');
  if (wave >= 4) kinds.push('husk');
  return kinds;
}

/** The queue of ordinary spawns for a wave, cheapest kinds first, shuffled. */
function budgetQueue(wave, rng) {
  const budget = 7 + wave * 4;
  const kinds = unlockedKinds(wave);
  const queue = [];
  let spent = 0;
  let at = 0.6;
  while (spent < budget) {
    const affordable = kinds.filter((kind) => COST[kind] <= budget - spent);
    const kind = rng.pick(affordable);
    spent += COST[kind];
    queue.push({ kind, at });
    // Later waves spawn faster and in small clusters.
    at += rng.range(0.55, 1.15) * Math.max(0.45, 1 - wave * 0.05);
    if (rng.chance(0.25)) {
      queue.push({ kind, at: at + 0.15 });
      spent += COST[kind];
    }
  }
  return queue;
}

/**
 * The full spawn plan for a wave: the queue, and the boss kind when the wave
 * has one (it arrives a few seconds in, after its escort starts).
 */
export function wavePlan(wave, rng) {
  if (wave === WAVES) {
    return {
      queue: [
        { kind: 'wisp', at: 1.0 },
        { kind: 'wisp', at: 2.0 },
        { kind: 'spitter', at: 4.0 },
        { kind: 'dasher', at: 6.0 },
      ],
      boss: 'maw',
      bossAt: 3.0,
    };
  }
  if (wave === 5) {
    return {
      queue: budgetQueue(5, rng),
      boss: 'brute',
      bossAt: 5.0,
    };
  }
  return { queue: budgetQueue(wave, rng), boss: null, bossAt: 0 };
}

/** The banner text a wave opens with. */
export function waveTitle(wave) {
  if (wave === WAVES) return 'WAVE 10 — THE HOLLOW MAW';
  if (wave === 5) return 'WAVE 5 — THE GLOOMBRUTE';
  return `WAVE ${wave}`;
}

/** The flavour line under a wave's banner. */
export function waveSubtitle(wave) {
  if (wave === WAVES) return 'Slay the Maw and the dawn returns.';
  if (wave === 5) return 'Something huge stirs in the dark.';
  if (wave === 1) return 'The void sends its wisps. Hold the light.';
  return 'The dark presses closer.';
}
