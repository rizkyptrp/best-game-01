// The simulation: the warden, the crystal, the enemies, the bullets, the
// shards and the particles, advanced in fixed steps. It knows nothing about
// the screen or the keyboard — main.js feeds it a control each step and turns
// the events it returns into sounds and screen changes.
//
// Phases: 'ambient' (the title screen's drifting wisps, no combat), 'combat',
// 'shop' (frozen but for particles), 'won' and 'lost'.
import { BOLT, CRYSTAL, ENEMY, FIELD, PLAYER, SHARD, WAVES, WAVE_CLEAR_SCORE, WAVE_SCALING } from './config.js';
import { wavePlan } from './enemies.js';
import { rollShop } from './upgrades.js';

export const EVENT_SHOOT = 1 << 0;
export const EVENT_ENEMY_HIT = 1 << 1;
export const EVENT_KILL = 1 << 2;
export const EVENT_BIG_KILL = 1 << 3;
export const EVENT_PLAYER_HIT = 1 << 4;
export const EVENT_CRYSTAL_HIT = 1 << 5;
export const EVENT_PICKUP = 1 << 6;
export const EVENT_WAVE_CLEAR = 1 << 7;
export const EVENT_WAVE_START = 1 << 8;
export const EVENT_OVER = 1 << 9;
export const EVENT_WIN = 1 << 10;

const TAU = Math.PI * 2;
const ARENA_MARGIN = 26;

/** A point just outside a random edge of the field, where enemies arrive. */
function spawnPoint(rng) {
  const edge = rng.int(0, 3);
  if (edge === 0) return { x: rng.range(0, FIELD.width), y: -30 };
  if (edge === 1) return { x: FIELD.width + 30, y: rng.range(0, FIELD.height) };
  if (edge === 2) return { x: rng.range(0, FIELD.width), y: FIELD.height + 30 };
  return { x: -30, y: rng.range(0, FIELD.height) };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createWorld(rng) {
  let nextId = 1;

  const state = {
    phase: 'ambient',
    time: 0,
    runTime: 0,
    wave: 0,
    score: 0,
    shards: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    shardsCollected: 0,
    player: null,
    stats: null,
    crystalHp: CRYSTAL.maxHp,
    enemies: [],
    bullets: [],
    bolts: [],
    shardDrops: [],
    particles: [],
    floaters: [],
    spawnQueue: [],
    spawnTimer: 0,
    bossKind: null,
    bossAt: 0,
    bossSpawned: false,
    shopCards: [],
    owned: {},
    shake: 0,
    banner: null,
    loseReason: null,
  };

  function freshPlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height / 2 + 170,
      aimX: FIELD.width / 2,
      aimY: FIELD.height / 2,
      hp: PLAYER.maxHp,
      fireCooldown: 0,
      invuln: 0,
      fireHeld: 0,
    };
  }

  function burst(x, y, color, count, speed, size) {
    for (let i = 0; i < count; i += 1) {
      const angle = rng.range(0, TAU);
      const v = rng.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: rng.range(0.3, 0.7),
        maxLife: 0.7,
        size: rng.range(size * 0.5, size * 1.4),
        color,
      });
    }
  }

  function floater(x, y, text, color, size = 15) {
    state.floaters.push({ x, y, text, color, size, life: 0.9 });
  }

  function makeEnemy(kind, x, y) {
    const def = ENEMY[kind];
    const hpScale = 1 + WAVE_SCALING.hpPerWave * Math.max(0, state.wave - 1);
    const speedScale = 1 + WAVE_SCALING.speedPerWave * Math.max(0, state.wave - 1);
    const hp = Math.round(def.hp * hpScale);
    return {
      id: nextId++,
      kind,
      x, y,
      vx: 0, vy: 0,
      hp, maxHp: hp,
      radius: def.radius,
      speed: def.speed * speedScale,
      touch: def.touch,
      crystal: def.crystal,
      score: def.score,
      shards: def.shards,
      color: def.color,
      t: rng.range(0, TAU),
      state: 'chase',
      stateT: 0,
      dashX: 0, dashY: 0,
      shootT: rng.range(1, 2),
      burstT: 4,
      summoned: 0,
      flash: 0,
      recoilT: 0,
      spawnT: 0.35,
    };
  }

  function spawnEnemy(kind) {
    const at = spawnPoint(rng);
    state.enemies.push(makeEnemy(kind, at.x, at.y));
  }

  function dropShards(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = rng.range(0, TAU);
      state.shardDrops.push({
        x, y,
        vx: Math.cos(angle) * rng.range(30, 120),
        vy: Math.sin(angle) * rng.range(30, 120),
        t: rng.range(0, TAU),
      });
    }
  }

  function damageEnemy(enemy, amount, events) {
    enemy.hp -= amount;
    enemy.flash = 0.08;
    floater(enemy.x, enemy.y - enemy.radius, String(amount), '#ffe9a8', 13);
    if (enemy.hp <= 0) {
      killEnemy(enemy, events);
      return true;
    }
    return false;
  }

  function killEnemy(enemy, events) {
    enemy.hp = 0;
    state.kills += 1;
    state.score += enemy.score;
    burst(enemy.x, enemy.y, enemy.color, enemy.kind === 'maw' || enemy.kind === 'brute' ? 46 : 18, 260, 4);
    burst(enemy.x, enemy.y, '#ffffff', 6, 180, 3);
    dropShards(enemy.x, enemy.y, enemy.shards);
    floater(enemy.x, enemy.y - enemy.radius - 12, `+${enemy.score}`, '#ffd166', 16);
    state.shake = Math.max(state.shake, enemy.kind === 'maw' ? 16 : enemy.kind === 'brute' ? 10 : 4);
    if (enemy.kind === 'maw' || enemy.kind === 'brute') events.value |= EVENT_BIG_KILL;
    else events.value |= EVENT_KILL;
    if (enemy.kind === 'maw' && state.wave === WAVES) {
      state.phase = 'won';
      state.score += 2000;
      events.value |= EVENT_WIN;
    }
  }

  function hurtPlayer(amount, fromX, fromY, events) {
    const player = state.player;
    if (player.invuln > 0 || state.phase !== 'combat') return;
    player.hp -= amount;
    player.invuln = PLAYER.invulnerable;
    state.shake = Math.max(state.shake, 8);
    burst(player.x, player.y, '#ff5d73', 14, 220, 4);
    events.value |= EVENT_PLAYER_HIT;
    if (player.hp <= 0) {
      player.hp = 0;
      state.phase = 'lost';
      state.loseReason = 'player';
      burst(player.x, player.y, '#ffd166', 60, 340, 5);
      events.value |= EVENT_OVER;
    }
  }

  function hurtCrystal(amount, events) {
    if (state.phase !== 'combat') return;
    state.crystalHp -= amount;
    state.shake = Math.max(state.shake, 10);
    burst(CRYSTAL.x, CRYSTAL.y, '#b8f1ff', 16, 240, 4);
    events.value |= EVENT_CRYSTAL_HIT;
    if (state.crystalHp <= 0) {
      state.crystalHp = 0;
      state.phase = 'lost';
      state.loseReason = 'crystal';
      burst(CRYSTAL.x, CRYSTAL.y, '#b8f1ff', 80, 380, 5);
      events.value |= EVENT_OVER;
    }
  }

  /** A spitter's bolt, or one of the Maw's radial burst. */
  function fireBolt(x, y, angle, speed = BOLT.speed) {
    state.bolts.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: BOLT.radius,
      damage: BOLT.damage,
      t: 0,
    });
  }

  function updateEnemy(enemy, dt, events) {
    const player = state.player;
    enemy.t += dt;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.recoilT = Math.max(0, enemy.recoilT - dt);
    enemy.spawnT = Math.max(0, enemy.spawnT - dt);
    if (enemy.recoilT > 0) {
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      return;
    }
    const toPlayer = { x: player.x - enemy.x, y: player.y - enemy.y };
    const distPlayer = Math.hypot(toPlayer.x, toPlayer.y) || 1;
    const toCrystal = { x: CRYSTAL.x - enemy.x, y: CRYSTAL.y - enemy.y };
    const distCrystal = Math.hypot(toCrystal.x, toCrystal.y) || 1;

    if (enemy.kind === 'wisp') {
      // Chases the warden with a drunken wobble.
      const wobble = Math.sin(enemy.t * 3.1) * 0.5;
      const angle = Math.atan2(toPlayer.y, toPlayer.x) + wobble * 0.35;
      enemy.vx = Math.cos(angle) * enemy.speed;
      enemy.vy = Math.sin(angle) * enemy.speed;
    } else if (enemy.kind === 'dasher') {
      if (enemy.state === 'chase') {
        enemy.vx = (toPlayer.x / distPlayer) * enemy.speed;
        enemy.vy = (toPlayer.y / distPlayer) * enemy.speed;
        if (distPlayer < 240) {
          enemy.state = 'aim';
          enemy.stateT = 0.55;
          enemy.dashX = toPlayer.x / distPlayer;
          enemy.dashY = toPlayer.y / distPlayer;
        }
      } else if (enemy.state === 'aim') {
        enemy.vx *= 0.8;
        enemy.vy *= 0.8;
        enemy.stateT -= dt;
        if (enemy.stateT <= 0) {
          enemy.state = 'dash';
          enemy.stateT = 0.42;
          enemy.vx = enemy.dashX * enemy.speed * 5.2;
          enemy.vy = enemy.dashY * enemy.speed * 5.2;
        }
      } else {
        enemy.stateT -= dt;
        if (enemy.stateT <= 0) enemy.state = 'chase';
      }
    } else if (enemy.kind === 'spitter') {
      // Keeps its distance and fires bolts at the warden.
      const want = 300;
      const dir = distPlayer > want + 40 ? 1 : distPlayer < want - 40 ? -1 : 0;
      const strafe = Math.sin(enemy.t * 0.9) * 0.6;
      const angle = Math.atan2(toPlayer.y, toPlayer.x) + (dir === 0 ? Math.PI / 2 : 0) * Math.sign(strafe || 1);
      enemy.vx = Math.cos(angle) * enemy.speed * (dir === 0 ? 0.7 : dir);
      enemy.vy = Math.sin(angle) * enemy.speed * (dir === 0 ? 0.7 : dir);
      enemy.shootT -= dt;
      if (enemy.shootT <= 0 && distPlayer < 520) {
        enemy.shootT = rng.range(1.9, 2.5);
        fireBolt(enemy.x, enemy.y, Math.atan2(toPlayer.y, toPlayer.x));
        burst(enemy.x, enemy.y, enemy.color, 3, 90, 3);
      }
    } else if (enemy.kind === 'husk' || enemy.kind === 'brute') {
      // Marches on the crystal; swats the warden only if they get in the way.
      const target = distPlayer < 110 ? toPlayer : toCrystal;
      const dist = distPlayer < 110 ? distPlayer : distCrystal;
      enemy.vx = (target.x / dist) * enemy.speed;
      enemy.vy = (target.y / dist) * enemy.speed;
    } else if (enemy.kind === 'maw') {
      // The Hollow Maw: slow pursuit, radial bursts, and it summons wisps as it weakens.
      enemy.vx = (toPlayer.x / distPlayer) * enemy.speed;
      enemy.vy = (toPlayer.y / distPlayer) * enemy.speed;
      enemy.burstT -= dt;
      if (enemy.burstT <= 0) {
        enemy.burstT = 5.5;
        const count = 10;
        const offset = rng.range(0, TAU);
        for (let i = 0; i < count; i += 1) fireBolt(enemy.x, enemy.y, offset + (i / count) * TAU, 210);
        burst(enemy.x, enemy.y, enemy.color, 20, 200, 4);
      }
      const phase = (enemy.hp < enemy.maxHp * (2 / 3) ? 1 : 0) + (enemy.hp < enemy.maxHp * (1 / 3) ? 1 : 0);
      if (phase > enemy.summoned) {
        enemy.summoned = phase;
        for (let i = 0; i < 3; i += 1) {
          const angle = rng.range(0, TAU);
          state.enemies.push(makeEnemy('wisp', enemy.x + Math.cos(angle) * 70, enemy.y + Math.sin(angle) * 70));
        }
        floater(enemy.x, enemy.y - enemy.radius - 10, 'THE MAW CALLS ITS OWN', '#ff3d81', 17);
      }
    }

    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    // Enemies stay inside the field once they have entered it.
    enemy.x = Math.max(-20, Math.min(FIELD.width + 20, enemy.x));
    enemy.y = Math.max(-20, Math.min(FIELD.height + 20, enemy.y));
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - 42 * dt);
    if (state.banner) {
      state.banner.t -= dt;
      if (state.banner.t <= 0) state.banner = null;
    }
  }

  function updateCombat(dt, control, events) {
    const player = state.player;
    const stats = state.stats;
    state.runTime += dt;

    // Spawning.
    state.spawnTimer += dt;
    while (state.spawnQueue.length > 0 && state.spawnQueue[0].at <= state.spawnTimer) {
      spawnEnemy(state.spawnQueue.shift().kind);
    }
    if (state.bossKind && !state.bossSpawned && state.spawnTimer >= state.bossAt) {
      state.bossSpawned = true;
      spawnEnemy(state.bossKind);
      floater(FIELD.width / 2, 120, state.bossKind === 'maw' ? 'THE HOLLOW MAW AWAKENS' : 'THE GLOOMBRUTE ARRIVES', '#ff5d73', 20);
    }

    // The warden: regeneration, mercy time, movement.
    if (stats.regen > 0) player.hp = Math.min(stats.maxHp, player.hp + stats.regen * dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.x += control.moveX * stats.speed * dt;
    player.y += control.moveY * stats.speed * dt;
    player.x = Math.max(ARENA_MARGIN, Math.min(FIELD.width - ARENA_MARGIN, player.x));
    player.y = Math.max(ARENA_MARGIN, Math.min(FIELD.height - ARENA_MARGIN, player.y));
    // The crystal is solid: the warden slides around it.
    const fromCrystal = { x: player.x - CRYSTAL.x, y: player.y - CRYSTAL.y };
    const distCrystal = Math.hypot(fromCrystal.x, fromCrystal.y);
    const minDist = CRYSTAL.radius + PLAYER.radius + 4;
    if (distCrystal < minDist && distCrystal > 0) {
      player.x = CRYSTAL.x + (fromCrystal.x / distCrystal) * minDist;
      player.y = CRYSTAL.y + (fromCrystal.y / distCrystal) * minDist;
    }

    // Aiming and firing.
    let aimX = control.aimX;
    let aimY = control.aimY;
    if (control.autoAim) {
      let nearest = null;
      let best = Infinity;
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        const d = distance(player, enemy);
        if (d < best) {
          best = d;
          nearest = enemy;
        }
      }
      if (nearest) {
        aimX = nearest.x;
        aimY = nearest.y;
      }
    }
    player.aimX = aimX;
    player.aimY = aimY;
    if (control.firing) player.fireHeld = PLAYER.fireGrace;
    else player.fireHeld = Math.max(0, player.fireHeld - dt);
    if (player.fireHeld > 0 && player.fireCooldown <= 0 && state.enemies.length > 0) {
      player.fireCooldown = stats.fireInterval;
      const baseAngle = Math.atan2(aimY - player.y, aimX - player.x);
      const spread = 0.11;
      for (let i = 0; i < stats.projectiles; i += 1) {
        const offset = (i - (stats.projectiles - 1) / 2) * spread;
        const angle = baseAngle + offset;
        state.bullets.push({
          x: player.x + Math.cos(angle) * (PLAYER.radius + 6),
          y: player.y + Math.sin(angle) * (PLAYER.radius + 6),
          vx: Math.cos(angle) * stats.bulletSpeed,
          vy: Math.sin(angle) * stats.bulletSpeed,
          radius: stats.bulletRadius,
          damage: stats.damage,
          pierce: stats.pierce,
          hitIds: [],
        });
      }
      state.shotsFired += stats.projectiles;
      burst(player.x + Math.cos(baseAngle) * 20, player.y + Math.sin(baseAngle) * 20, '#ffe9a8', 2, 120, 2.5);
      events.value |= EVENT_SHOOT;
    }

    // Enemies act.
    for (const enemy of state.enemies) updateEnemy(enemy, dt, events);

    // The warden's bullets.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      let spent = false;
      if (bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        spent = true;
      } else {
        for (const enemy of state.enemies) {
          if (enemy.hp <= 0 || enemy.spawnT > 0.15 || bullet.hitIds.includes(enemy.id)) continue;
          if (Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < enemy.radius + bullet.radius) {
            bullet.hitIds.push(enemy.id);
            state.shotsHit += 1;
            events.value |= EVENT_ENEMY_HIT;
            burst(bullet.x, bullet.y, enemy.color, 3, 140, 2.5);
            damageEnemy(enemy, bullet.damage, events);
            if (bullet.pierce > 0) bullet.pierce -= 1;
            else {
              spent = true;
              break;
            }
          }
        }
      }
      if (spent) state.bullets.splice(i, 1);
    }
    state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

    // Enemy bolts.
    for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
      const bolt = state.bolts[i];
      bolt.t += dt;
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      let spent = bolt.x < -24 || bolt.x > FIELD.width + 24 || bolt.y < -24 || bolt.y > FIELD.height + 24;
      if (!spent && Math.hypot(bolt.x - player.x, bolt.y - player.y) < bolt.radius + PLAYER.radius) {
        hurtPlayer(bolt.damage, bolt.x, bolt.y, events);
        spent = true;
      }
      if (!spent && Math.hypot(bolt.x - CRYSTAL.x, bolt.y - CRYSTAL.y) < bolt.radius + CRYSTAL.radius) {
        hurtCrystal(bolt.damage, events);
        spent = true;
      }
      if (spent) state.bolts.splice(i, 1);
    }

    // Touch: enemies hurt the warden and the crystal, then recoil away.
    for (const enemy of state.enemies) {
      if (enemy.recoilT > 0 || enemy.spawnT > 0) continue;
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.radius + PLAYER.radius) {
        hurtPlayer(enemy.touch, enemy.x, enemy.y, events);
        const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        enemy.vx = Math.cos(angle) * 320;
        enemy.vy = Math.sin(angle) * 320;
        enemy.recoilT = 0.45;
      } else if (Math.hypot(enemy.x - CRYSTAL.x, enemy.y - CRYSTAL.y) < enemy.radius + CRYSTAL.radius) {
        hurtCrystal(enemy.crystal, events);
        const angle = Math.atan2(enemy.y - CRYSTAL.y, enemy.x - CRYSTAL.x);
        enemy.vx = Math.cos(angle) * 380;
        enemy.vy = Math.sin(angle) * 380;
        enemy.recoilT = 0.7;
      }
    }

    // Shards drift, then fly to the warden.
    for (let i = state.shardDrops.length - 1; i >= 0; i -= 1) {
      const shard = state.shardDrops[i];
      shard.t += dt;
      const toPlayer = { x: player.x - shard.x, y: player.y - shard.y };
      const dist = Math.hypot(toPlayer.x, toPlayer.y) || 1;
      if (dist < stats.magnet) {
        const pull = 620 * (1 - dist / (stats.magnet * 1.6));
        shard.vx += (toPlayer.x / dist) * pull * dt * 8;
        shard.vy += (toPlayer.y / dist) * pull * dt * 8;
      }
      shard.vx *= 0.92;
      shard.vy *= 0.92;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      if (dist < SHARD.pickupRadius) {
        state.shardDrops.splice(i, 1);
        state.shards += 1;
        state.shardsCollected += 1;
        state.score += SHARD.score;
        events.value |= EVENT_PICKUP;
      }
    }

    updateParticles(dt);

    // The wave is clear when nothing is left to spawn and nothing is left standing.
    if (
      state.phase === 'combat' &&
      state.spawnQueue.length === 0 &&
      (state.bossKind === null || state.bossSpawned) &&
      state.enemies.length === 0
    ) {
      state.score += WAVE_CLEAR_SCORE + state.wave * 100;
      // Shards left on the field fly home: a cleared wave never wastes its spoils.
      for (const shard of state.shardDrops) {
        state.shards += 1;
        state.shardsCollected += 1;
        state.score += SHARD.score;
      }
      if (state.shardDrops.length > 0) {
        burst(player.x, player.y, '#ffd166', Math.min(24, state.shardDrops.length * 2), 200, 3);
      }
      state.shardDrops = [];
      state.phase = 'shop';
      state.shopCards = rollShop(rng, state.owned).map((card) => ({ ...card, sold: false }));
      state.bolts = [];
      events.value |= EVENT_WAVE_CLEAR;
    }
  }

  function updateAmbient(dt) {
    // The title screen's drift: a few wisps wander the dark, harmless.
    if (state.enemies.length < 7 && rng.chance(dt * 0.8)) {
      const at = spawnPoint(rng);
      const wisp = makeEnemy('wisp', at.x, at.y);
      wisp.vx = rng.range(-40, 40);
      wisp.vy = rng.range(-40, 40);
      state.enemies.push(wisp);
    }
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      enemy.t += dt;
      enemy.x += enemy.vx * dt + Math.sin(enemy.t * 1.3) * 12 * dt;
      enemy.y += enemy.vy * dt + Math.cos(enemy.t * 1.1) * 12 * dt;
      if (enemy.x < -60 || enemy.x > FIELD.width + 60 || enemy.y < -60 || enemy.y > FIELD.height + 60) {
        state.enemies.splice(i, 1);
      }
    }
    updateParticles(dt);
  }

  return {
    state,

    /** A fresh run: the warden whole, the crystal lit, wave one about to begin. */
    reset() {
      state.phase = 'ambient';
      state.time = 0;
      state.runTime = 0;
      state.wave = 0;
      state.score = 0;
      state.shards = 0;
      state.kills = 0;
      state.shotsFired = 0;
      state.shotsHit = 0;
      state.shardsCollected = 0;
      state.player = freshPlayer();
      state.stats = { ...PLAYER };
      state.crystalHp = CRYSTAL.maxHp;
      state.enemies = [];
      state.bullets = [];
      state.bolts = [];
      state.shardDrops = [];
      state.particles = [];
      state.floaters = [];
      state.spawnQueue = [];
      state.spawnTimer = 0;
      state.bossKind = null;
      state.bossAt = 0;
      state.bossSpawned = false;
      state.shopCards = [];
      state.owned = {};
      state.shake = 0;
      state.banner = null;
      state.loseReason = null;
    },

    /** Open a wave: build its spawn plan and show its banner. */
    beginWave(wave) {
      const plan = wavePlan(wave, rng);
      state.wave = wave;
      state.phase = 'combat';
      state.spawnQueue = [...plan.queue];
      state.spawnTimer = 0;
      state.bossKind = plan.boss;
      state.bossAt = plan.bossAt;
      state.bossSpawned = false;
      state.enemies = [];
      state.bullets = [];
      state.bolts = [];
      state.banner = {
        title: wave === WAVES ? 'WAVE 10 — THE HOLLOW MAW' : wave === 5 ? 'WAVE 5 — THE GLOOMBRUTE' : `WAVE ${wave}`,
        subtitle: wave === WAVES
          ? 'Slay the Maw and the dawn returns.'
          : wave === 5
            ? 'Something huge stirs in the dark.'
            : wave === 1
              ? 'The void sends its wisps. Hold the light.'
              : 'The dark presses closer.',
        t: 2.4,
      };
    },

    /** Buy a shop card by index; returns its message, or null when it cannot be bought. */
    buyCard(index) {
      const card = state.shopCards[index];
      if (!card || card.sold || state.shards < card.cost) return null;
      state.shards -= card.cost;
      card.sold = true;
      state.owned[card.id] = (state.owned[card.id] ?? 0) + 1;
      return card.apply(state.stats, state);
    },

    /** How many enemies are still to come or still standing, for the HUD. */
    enemiesLeft() {
      let left = state.enemies.length + state.spawnQueue.length;
      if (state.bossKind && !state.bossSpawned) left += 1;
      return left;
    },

    /** Advance the world one fixed step. Returns the events that happened. */
    step(dt, control) {
      const events = { value: 0 };
      state.time += dt;
      if (state.phase === 'combat') updateCombat(dt, control, events);
      else if (state.phase === 'ambient') updateAmbient(dt);
      else updateParticles(dt);
      return events.value;
    },
  };
}
