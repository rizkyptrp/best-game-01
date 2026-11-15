// Who attacks each wave, and when. A wave is a spawn queue: entries of
// { kind, at } in seconds from the wave's start, plus the boss of a boss wave.
// Normal waves spend a points budget that grows with the wave number; wave 5
// brings the Gloombrute, wave 10 the Hollow Maw, each with an escort.
import { ELITE, WAVES } from './config.js';

/** What each kind costs from a wave's budget. */
const COST = { wisp: 1, dasher: 2, spitter: 3, sunder: 3, weaver: 4, husk: 4 };

/** Which kinds a wave may spend its budget on (later waves unlock the rest). */
function unlockedKinds(wave) {
  const kinds = ['wisp'];
  if (wave >= 2) kinds.push('dasher');
  if (wave >= 3) kinds.push('spitter', 'sunder');
  if (wave >= 4) kinds.push('husk');
  if (wave >= 6) kinds.push('weaver');
  return kinds;
}

/** From wave 6, a few spawns arrive as elites: tougher, richer, ringed in gold. */
function maybeElite(wave, rng) {
  return wave >= ELITE.fromWave && rng.chance(ELITE.chance);
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
    queue.push({ kind, at, elite: maybeElite(wave, rng) });
    // Later waves spawn faster and in small clusters.
    at += rng.range(0.55, 1.15) * Math.max(0.45, 1 - wave * 0.05);
    if (rng.chance(0.25)) {
      queue.push({ kind, at: at + 0.15, elite: maybeElite(wave, rng) });
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
        // Reinforcements keep the final fight crowded while the Maw lives.
        { kind: 'wisp', at: 8.0 },
        { kind: 'wisp', at: 8.5 },
        { kind: 'sunder', at: 12.0 },
        { kind: 'dasher', at: 12.5 },
        { kind: 'weaver', at: 16.0 },
        { kind: 'wisp', at: 16.5 },
        { kind: 'dasher', at: 20.0 },
        { kind: 'spitter', at: 20.5 },
        { kind: 'sunder', at: 24.0 },
        { kind: 'husk', at: 30.0 },
        { kind: 'weaver', at: 30.5 },
        { kind: 'dasher', at: 36.0 },
      ],
      boss: 'maw',
      bossAt: 3.0,
    };
  }
  if (wave === 8) {
    return {
      queue: budgetQueue(8, rng),
      boss: 'herald',
      bossAt: 5.0,
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
  if (wave === 8) return 'WAVE 8 — THE DUSK HERALD';
  if (wave === 5) return 'WAVE 5 — THE GLOOMBRUTE';
  return `WAVE ${wave}`;
}

/** The flavour line under a wave's banner. */
export function waveSubtitle(wave) {
  if (wave === WAVES) return 'Slay the Maw and the dawn returns.';
  if (wave === 8) return 'The Maw sends its herald ahead of it.';
  if (wave === 5) return 'Something huge stirs in the dark.';
  if (wave === 1) return 'The void sends its wisps. Hold the light.';
  return 'The dark presses closer.';
}
