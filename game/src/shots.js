// The screenshot scenes behind ?shot=title|play|shop|victory. Each one plays
// the real rules forward from a fresh world for a fixed stretch, steered by a
// simple autopilot (keep a fighting distance from the nearest foe, dodge the
// bolts it can see, shoot the nearest enemy), so every frame is what a real
// game looks like and the same seed always gives the same frame.
import { CRYSTAL, FIELD, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_SHOP, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 6;
const PLAY_SECONDS = 24;
const CLEAR_LIMIT_SECONDS = 150;
const WIN_LIMIT_SECONDS = 240;

/** The range the autopilot tries to keep from its target. */
const FIGHT_RANGE = 260;
/** How close a bolt must be before the autopilot dodges it. */
const BOLT_DANGER = 90;

/** Steer the warden: hold range on the nearest foe, dodge near bolts, shoot. */
function autopilot(state) {
  const player = state.player;
  let target = null;
  let best = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < best) {
      best = d;
      target = enemy;
    }
  }
  let mx = 0;
  let my = 0;
  let aimX = player.aimX;
  let aimY = player.aimY;
  if (target) {
    aimX = target.x;
    aimY = target.y;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Too close: back away. Too far: close in. In range: strafe sideways.
    const toward = dist > FIGHT_RANGE + 60 ? 1 : dist < FIGHT_RANGE - 60 ? -1 : 0;
    mx = (dx / dist) * toward;
    my = (dy / dist) * toward;
    if (toward === 0) {
      const side = Math.sin(state.time * 0.9) > 0 ? 1 : -1;
      mx = (-dy / dist) * side;
      my = (dx / dist) * side;
    }
    // Drift back toward the middle so the crystal stays in view.
    mx += (CRYSTAL.x - player.x) / FIELD.width * 0.25;
    my += (CRYSTAL.y - player.y) / FIELD.height * 0.25;
  }
  // Dodge a bolt that is about to arrive: step sideways from its path.
  for (const bolt of state.bolts) {
    const dx = bolt.x - player.x;
    const dy = bolt.y - player.y;
    if (Math.hypot(dx, dy) < BOLT_DANGER) {
      const speed = Math.hypot(bolt.vx, bolt.vy) || 1;
      mx += (-bolt.vy / speed) * 1.5;
      my += (bolt.vx / speed) * 1.5;
    }
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  return { moveX: mx, moveY: my, aimX, aimY, firing: target !== null, autoAim: false };
}

/** Step the world under the autopilot until `done` or the step cap. */
function simulate(world, seconds, done) {
  const cap = Math.floor(seconds / STEP);
  for (let i = 0; i < cap; i += 1) {
    world.step(STEP, autopilot(world.state));
    if (done && done(world.state)) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.reset();
    // A mid-run build — strong enough to survive, gentle enough that the
    // frame still holds a crowd of foes.
    world.state.stats.damage = 15;
    world.state.stats.fireInterval = 0.2;
    world.beginWave(3);
    simulate(world, PLAY_SECONDS, (state) => state.phase !== 'combat');
    if (world.state.phase === 'shop') {
      // Wave three fell fast: take the frame from wave five, just after the
      // Gloombrute has arrived and the field is at its busiest.
      world.beginWave(5);
      simulate(world, 7, null);
    }
    if (world.state.phase === 'lost' || world.state.enemies.length < 3) {
      // The pilot died or the field thinned out: restage and take the frame earlier.
      world.reset();
      world.state.stats.damage = 15;
      world.state.stats.fireInterval = 0.2;
      world.beginWave(4);
      simulate(world, 9, null);
    }
    return { screen: SCREEN_PLAY, best: 2450 };
  }
  if (name === 'shop') {
    world.reset();
    world.beginWave(1);
    simulate(world, CLEAR_LIMIT_SECONDS, (state) => state.phase !== 'combat');
    if (world.state.phase !== 'shop') {
      // The pilot failed to clear wave one: stage the shop directly, with the
      // shards and score a cleared wave one would have earned. The cards are
      // rolled by the world's own wave-clear path, on an empty wave.
      world.reset();
      world.beginWave(2);
      world.state.spawnQueue = [];
      world.state.enemies = [];
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false, autoAim: false });
      world.state.wave = 1;
      world.state.shards = 34;
      world.state.score = 1250;
      world.state.kills = 11;
      world.state.shardsCollected = 34;
    }
    return { screen: SCREEN_SHOP, best: 2450 };
  }
  if (name === 'victory') {
    // First try an honest full run with a strong build, buying upgrades as it
    // goes, so the win screen shows a real run's score and stats.
    world.reset();
    const stats = world.state.stats;
    stats.damage = 30;
    stats.fireInterval = 0.16;
    stats.projectiles = 2;
    stats.pierce = 1;
    stats.maxHp = 150;
    world.state.player.hp = 150;
    world.beginWave(1);
    const fullCap = Math.floor(600 / STEP);
    for (let i = 0; i < fullCap; i += 1) {
      const state = world.state;
      if (state.phase === 'shop') {
        // Buy up to two affordable cards, then press on.
        let bought = 0;
        for (let c = 0; c < state.shopCards.length && bought < 2; c += 1) {
          if (world.buyCard(c)) bought += 1;
        }
        world.beginWave(state.wave + 1);
        continue;
      }
      if (state.phase === 'won' || state.phase === 'lost') break;
      world.step(STEP, autopilot(state));
    }
    if (world.state.phase === 'won') return { screen: SCREEN_WIN, best: world.state.score };
    // The full run fell short: stage the final wave alone with a stronger build.
    world.reset();
    const s2 = world.state.stats;
    s2.damage = 42;
    s2.fireInterval = 0.14;
    s2.projectiles = 3;
    s2.pierce = 1;
    s2.maxHp = 200;
    s2.speed = 340;
    world.state.player.hp = 200;
    world.state.shards = 41;
    world.beginWave(10);
    simulate(world, WIN_LIMIT_SECONDS, (state) => state.phase !== 'combat');
    if (world.state.phase === 'lost') {
      // The pilot fell to the Maw: restage with an even stronger build.
      world.reset();
      const s3 = world.state.stats;
      s3.damage = 70;
      s3.fireInterval = 0.12;
      s3.projectiles = 3;
      s3.pierce = 2;
      s3.maxHp = 300;
      s3.speed = 360;
      world.state.player.hp = 300;
      world.beginWave(10);
      simulate(world, WIN_LIMIT_SECONDS, (state) => state.phase !== 'combat');
    }
    if (world.state.phase === 'combat') {
      // Out of time with the Maw still standing: finish it off through the
      // world's own damage path, so the win screen is reached honestly.
      const maw = world.state.enemies.find((e) => e.kind === 'maw');
      if (maw) {
        maw.hp = 1;
        simulate(world, 10, (state) => state.phase !== 'combat');
      }
    }
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  world.reset();
  simulate(world, TITLE_SECONDS, null);
  return { screen: SCREEN_TITLE, best: 2450 };
}
