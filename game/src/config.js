// LUMENHOLD — every tuning number and colour in one place.
//
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. The game is deterministic
// given its seed: all randomness flows through the seeded generator in random.js.

/** The logical playfield, in pixels. */
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves a run holds. Wave 5 is a mini-boss, wave 10 the final boss. */
export const WAVES = 10;

/** The crystal the player defends sits at the arena's heart. */
export const CRYSTAL = {
  x: FIELD.width / 2,
  y: FIELD.height / 2,
  radius: 34,
  maxHp: 160,
  /** Light radius the crystal throws around itself (purely visual). */
  glow: 150,
};

/** The warden's starting build; upgrades in upgrades.js improve these numbers. */
export const PLAYER = {
  radius: 15,
  speed: 305,
  maxHp: 100,
  damage: 12,
  /** Seconds between shots. */
  fireInterval: 0.22,
  bulletSpeed: 680,
  bulletRadius: 5,
  projectiles: 1,
  pierce: 0,
  magnet: 110,
  regen: 0,
  /** Orbiting blades from the Orbit Blades upgrade (0 until taken). */
  orbiters: 0,
  /** Seconds between dashes; the Swiftstep upgrade shortens it. */
  dashCooldown: 2.6,
  /** Seconds of mercy after a hit, during which the warden cannot be hurt again. */
  invulnerable: 0.8,
  /** Seconds the warden keeps firing after the aim key is released (forgiving feel). */
  fireGrace: 0.12,
};

/** A dash: a short burst of speed with brief mercy, then the cooldown. */
export const DASH = { duration: 0.16, speed: 950, invuln: 0.22 };

/** A kill streak: kills inside the window raise the score multiplier. */
export const COMBO = { window: 3.5, killsPerStep: 5, maxMult: 5 };

/** An orbiting blade: damage, orbit radius, and revolutions per second. */
export const ORBITER = { damage: 14, radius: 54, spin: 1.4, hitCooldown: 0.45 };

/** Contact damage an enemy deals, and how much it hurts the crystal, by kind. */
export const ENEMY = {
  wisp:   { hp: 22,  speed: 118, radius: 13, score: 50,  shards: 2, touch: 10, crystal: 5,  color: '#b388ff' },
  dasher: { hp: 34,  speed: 96,  radius: 14, score: 90,  shards: 3, touch: 14, crystal: 8,  color: '#ff9f43' },
  spitter:{ hp: 40,  speed: 82,  radius: 16, score: 120, shards: 4, touch: 10, crystal: 10, color: '#7dff9a' },
  sunder: { hp: 55,  speed: 74,  radius: 18, score: 150, shards: 4, touch: 12, crystal: 10, color: '#c86bff' },
  weaver: { hp: 48,  speed: 88,  radius: 16, score: 180, shards: 5, touch: 10, crystal: 12, color: '#ff7ad9' },
  husk:   { hp: 110, speed: 58,  radius: 22, score: 200, shards: 6, touch: 18, crystal: 14, color: '#ff5d73' },
  brute:  { hp: 420, speed: 42,  radius: 34, score: 800, shards: 20, touch: 24, crystal: 26, color: '#ff5d73' },
  herald: { hp: 750, speed: 52,  radius: 38, score: 1500, shards: 30, touch: 22, crystal: 22, color: '#ff3d81' },
  maw:    { hp: 1400, speed: 40, radius: 52, score: 5000, shards: 60, touch: 30, crystal: 40, color: '#ff3d81' },
};

/** An elite's multipliers: tougher, richer, and ringed in gold. */
export const ELITE = { hp: 2.2, score: 3, shards: 2, radius: 1.15, chance: 0.08, fromWave: 6 };

/** Enemy hit points and speed grow a little each wave, so later waves stay dangerous. */
export const WAVE_SCALING = { hpPerWave: 0.09, speedPerWave: 0.02 };

/** A spitter's bolt. */
export const BOLT = { speed: 260, radius: 7, damage: 12 };

/** A weaver's bolt: slower, but it is aimed at the crystal. */
export const WEAVER_BOLT = { speed: 210, radius: 8, damage: 8 };

/** Shards drift, then fly to the warden inside the magnet radius. */
export const SHARD = { radius: 7, score: 5, pickupRadius: 26, drift: 46 };

/** Score for clearing a wave, before the wave-number bonus. */
export const WAVE_CLEAR_SCORE = 250;

/** The palette: a cold void, warm gold light, and one hot colour per enemy kind. */
export const PALETTE = {
  void: '#070b16',
  voidEdge: '#0b1020',
  nebulaA: 'rgba(64, 48, 140, 0.35)',
  nebulaB: 'rgba(16, 96, 110, 0.30)',
  star: '#cfe6ff',
  gold: '#ffd166',
  goldSoft: '#ffe9a8',
  cyan: '#7ff0ff',
  player: '#ffd166',
  crystal: '#b8f1ff',
  crystalCore: '#ffffff',
  bullet: '#ffe9a8',
  shard: '#ffd166',
  panel: 'rgba(10, 14, 28, 0.88)',
  panelEdge: 'rgba(255, 209, 102, 0.45)',
  text: '#f2ead8',
  muted: '#9aa3b8',
  danger: '#ff5d73',
  heal: '#7dff9a',
  elite: '#ffd166',
  dim: 'rgba(7, 11, 22, 0.62)',
  dimTitle: 'rgba(7, 11, 22, 0.45)',
};

/** Typefaces: system stacks only, so the game loads no font over the network. */
export const FONT = {
  display: '"Avenir Next", "Segoe UI", system-ui, sans-serif',
  body: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumenhold.best';

/** Where the mute setting is kept between visits. */
export const MUTE_KEY = 'lumenhold.muted';
