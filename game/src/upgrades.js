// The upgrade cards offered between waves. Each card has a shard cost and an
// effect on the warden's build; some stack, some are one-off. The shop rolls
// three distinct cards a visit, so every run's build is a little different.
import { CRYSTAL } from './config.js';

/**
 * The catalogue. `max` is how many times a run may take it; `apply` mutates
 * the warden's stats (or the crystal) and returns a line for the log.
 */
export const UPGRADES = [
  {
    id: 'damage', name: 'Ember Rounds', cost: 12, max: 5,
    desc: '+25% shot damage',
    apply(stats) { stats.damage = Math.round(stats.damage * 1.25); return 'Damage up!'; },
  },
  {
    id: 'rapid', name: 'Rapid Sigil', cost: 12, max: 5,
    desc: '+20% fire rate',
    apply(stats) { stats.fireInterval = Math.max(0.09, stats.fireInterval * 0.83); return 'Faster shots!'; },
  },
  {
    id: 'swift', name: 'Gale Charm', cost: 8, max: 3,
    desc: '+12% move speed',
    apply(stats) { stats.speed = Math.round(stats.speed * 1.12); return 'Swifter!'; },
  },
  {
    id: 'vital', name: 'Vital Bloom', cost: 10, max: 4,
    desc: '+25 max health, heal 25',
    apply(stats, world) {
      stats.maxHp += 25;
      world.player.hp = Math.min(stats.maxHp, world.player.hp + 25);
      return 'Health up!';
    },
  },
  {
    id: 'twin', name: 'Twin Spark', cost: 22, max: 2,
    desc: '+1 projectile per shot',
    apply(stats) { stats.projectiles += 1; return 'Twin shots!'; },
  },
  {
    id: 'pierce', name: 'Lance Tip', cost: 18, max: 3,
    desc: 'Shots pierce +1 enemy',
    apply(stats) { stats.pierce += 1; return 'Piercing shots!'; },
  },
  {
    id: 'heavy', name: 'Heavy Light', cost: 14, max: 3,
    desc: '+30% bullet size and speed',
    apply(stats) { stats.bulletRadius *= 1.3; stats.bulletSpeed *= 1.15; return 'Heavier shots!'; },
  },
  {
    id: 'magnet', name: 'Shard Magnet', cost: 8, max: 2,
    desc: '+60% shard pickup range',
    apply(stats) { stats.magnet *= 1.6; return 'Wider magnet!'; },
  },
  {
    id: 'mend', name: 'Slow Mend', cost: 12, max: 2,
    desc: 'Regenerate 1 HP every second',
    apply(stats) { stats.regen += 1; return 'Slow mend!'; },
  },
  {
    id: 'repair', name: 'Mend the Light', cost: 15, max: 99,
    desc: 'Repair the crystal +40 HP',
    apply(_stats, world) {
      world.crystalHp = Math.min(CRYSTAL.maxHp, world.crystalHp + 40);
      return 'Crystal mended!';
    },
  },
];

/** Roll three distinct cards the run may still take, given what it already owns. */
export function rollShop(rng, owned) {
  const available = UPGRADES.filter((card) => (owned[card.id] ?? 0) < card.max);
  const picks = [];
  const pool = [...available];
  while (picks.length < 3 && pool.length > 0) {
    const index = Math.floor(rng.next() * pool.length);
    picks.push(pool.splice(index, 1)[0]);
  }
  // A run that has taken everything still gets the repair card.
  while (picks.length < 3) picks.push(UPGRADES.find((card) => card.id === 'repair'));
  return picks;
}
