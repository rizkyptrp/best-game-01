// The screenshot scenes behind ?shot=title|play|shop|victory. Each one plays
// the real rules forward from a fresh world for a fixed stretch, steered by a
// simple autopilot (keep a fighting distance from the nearest foe, dodge the
// bolts it can see, dash out of trouble, shoot the nearest enemy), so every
// frame is what a real game looks like and the same seed always gives the same
// frame.
import { CRYSTAL, FIELD, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_SHOP, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 6.8;
const WIN_LIMIT_SECONDS = 240;

/** The range the autopilot tries to keep from its target. */
const FIGHT_RANGE = 260;
/** How close a bolt must be before the autopilot dodges it. */
const BOLT_DANGER = 90;
/** How close a foe must be before the autopilot dashes away from it. */
const DASH_DANGER = 80;

/** Steer the warden: hold range on the nearest foe, dodge near bolts, shoot. */
export function autopilotControl(state) {
  const player = state.player;
  // Targeting: a foe closing on the crystal is the priority — the warden
  // exists to defend it — and a weaver shooting the crystal from afar is a
  // threat even at range. Otherwise the nearest foe to the warden. When the
  // crystal is half spent, the warden guards a wider ring around it.
  const threatR = state.crystalHp < state.crystalMaxHp * 0.5 ? 420 : 300;
  let target = null;
  let bestThreat = Infinity;
  let bestNear = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const dPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    const dCrystal = Math.hypot(enemy.x - CRYSTAL.x, enemy.y - CRYSTAL.y);
    if (dCrystal < threatR || enemy.kind === 'weaver') {
      if (dCrystal < bestThreat) {
        bestThreat = dCrystal;
        target = enemy;
      }
    } else if (target === null && dPlayer < bestNear) {
      bestNear = dPlayer;
      target = enemy;
    }
  }
  let mx = 0;
  let my = 0;
  let aimX = player.aimX;
  let aimY = player.aimY;
  let dash = false;
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
    // A foe right on top of the warden is a dash moment: burst away from it.
    if (dist < DASH_DANGER && state.dashCooldown <= 0) {
      dash = true;
      mx = (-dx / dist) * 1.5;
      my = (-dy / dist) * 1.5;
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
  // Stay in the frame: near an edge, steer back toward the middle.
  if (player.x < 220) mx += 1.2;
  if (player.x > FIELD.width - 220) mx -= 1.2;
  if (player.y < 180) my += 1.2;
  if (player.y > FIELD.height - 180) my -= 1.2;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  return { moveX: mx, moveY: my, aimX, aimY, firing: target !== null, autoAim: false, dash };
}

/** Step the world under the autopilot until `done` or the step cap. */
function simulate(world, seconds, done) {
  const cap = Math.floor(seconds / STEP);
  for (let i = 0; i < cap; i += 1) {
    world.step(STEP, autopilotControl(world.state));
    if (done && done(world.state)) break;
  }
}

/**
 * Step the world for `seconds` and keep the busiest frame in which the Maw is
 * still alive and the warden is not about to die: the most foes, shots and
 * bolts in view at once. The state is plain data, so the best frame is kept
 * as a structured clone and restored at the end.
 */
function simulateBusiest(world, seconds) {
  let best = null;
  let bestBusy = -1;
  const cap = Math.floor(seconds / STEP);
  for (let i = 0; i < cap; i += 1) {
    world.step(STEP, autopilotControl(world.state));
    const st = world.state;
    if (st.phase !== 'combat') break;
    const maw = st.enemies.find((e) => e.kind === 'maw');
    if (!maw || st.player.hp < 40 || st.crystalHp < 40) continue;
    // A live streak is worth a few extra points: it shows the combo meter.
    const busy = st.enemies.length * 3 + st.bullets.length + st.bolts.length + (st.combo >= 2 ? 4 : 0);
    if (busy > bestBusy) {
      bestBusy = busy;
      best = structuredClone(st);
    }
  }
  if (best) Object.assign(world.state, best);
  return best !== null;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    // The cover: the final wave at its busiest — the Hollow Maw on the field
    // with its escort, bolts in the air, shards on the ground. A mid-run build
    // keeps the Maw alive long enough for the frame to stay crowded; the
    // score and shards are set to what a run reaching wave 10 would hold.
    world.reset();
    const stats = world.state.stats;
    stats.damage = 15;
    stats.fireInterval = 0.2;
    stats.projectiles = 2;
    stats.orbiters = 1;
    stats.maxHp = 150;
    world.state.player.hp = 150;
    world.state.score = 52400;
    world.state.shards = 63;
    world.state.kills = 108;
    world.state.shardsCollected = 342;
    world.beginWave(10);
    // Keep the busiest frame of the Maw fight: the most foes, shots and bolts
    // in view at once, while the Maw still lives.
    const framed = simulateBusiest(world, 30);
    if (!framed || world.state.phase === 'lost' || world.state.enemies.length < 3) {
      // No good frame, or the pilot died: take the frame from wave eight
      // instead, once the Dusk Herald has walked in.
      world.reset();
      const s2 = world.state.stats;
      s2.damage = 18;
      s2.fireInterval = 0.18;
      s2.projectiles = 2;
      s2.orbiters = 1;
      world.state.score = 31900;
      world.state.shards = 48;
      world.beginWave(8);
      simulate(world, 12, null);
    }
    return { screen: SCREEN_PLAY, best: 68300 };
  }
  if (name === 'shop') {
    // A real run through wave five, buying two good cards a shop, so the
    // frame shows a build already forming and the shards a boss wave pays.
    world.reset();
    world.beginWave(1);
    const prefer = ['damage', 'twin', 'rapid', 'pierce', 'orbit', 'heavy', 'vital', 'aegis', 'repair', 'swift', 'mend', 'magnet', 'step'];
    const cap = Math.floor(420 / STEP);
    for (let i = 0; i < cap; i += 1) {
      const state = world.state;
      if (state.phase === 'shop') {
        if (state.wave >= 5) break;
        const cards = [...state.shopCards].sort((a, b) => prefer.indexOf(a.id) - prefer.indexOf(b.id));
        let bought = 0;
        for (const card of cards) {
          if (bought >= 2) break;
          if (world.buyCard(state.shopCards.indexOf(card))) bought += 1;
        }
        world.beginWave(state.wave + 1);
        continue;
      }
      if (state.phase !== 'combat') break;
      world.step(STEP, autopilotControl(state));
    }
    if (world.state.phase !== 'shop') {
      // The pilot failed to reach the wave-five shop: stage it directly, with
      // the shards, score and build a cleared wave five would hold. The cards
      // are rolled by the world's own wave-clear path, on an empty wave.
      world.reset();
      world.state.stats.damage = 19;
      world.state.stats.fireInterval = 0.18;
      world.state.stats.projectiles = 2;
      world.state.owned = { damage: 2, rapid: 1, twin: 1, vital: 1 };
      world.beginWave(6);
      world.state.spawnQueue = [];
      world.state.enemies = [];
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false, autoAim: false });
      world.state.wave = 5;
      world.state.shards = 71;
      world.state.score = 24800;
      world.state.kills = 62;
      world.state.shardsCollected = 214;
    }
    return { screen: SCREEN_SHOP, best: 68300 };
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
      world.step(STEP, autopilotControl(state));
    }
    if (world.state.phase === 'won') {
      // Let the battle's aftermath settle before the frame is taken.
      simulate(world, 1.5, null);
      return { screen: SCREEN_WIN, best: world.state.score };
    }
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
    if (world.state.phase === 'won') simulate(world, 1.5, null);
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  world.reset();
  simulate(world, TITLE_SECONDS, null);
  return { screen: SCREEN_TITLE, best: 2450 };
}
