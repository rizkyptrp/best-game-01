// Everything the player sees: the void, the crystal, the warden, the
// enemies, the HUD and every screen. The renderer paints the logical 1280x720
// field scaled to the window, and nothing else — it never changes the world.
import { COMBO, CRYSTAL, FIELD, FONT, ORBITER, PALETTE, PLAYER, WAVES } from './config.js';
import { createRandom } from './random.js';
import { viewTransform } from './view.js';
import { comboMultiplier } from './world.js';
import { drawGlyph } from './glyphs.js';
import { UPGRADES } from './upgrades.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_SHOP = 'shop';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

/** The shop's card and button rectangles, shared by drawing and click tests. */
export function shopLayout() {
  const cardW = 300;
  const cardH = 230;
  const gap = 28;
  const total = cardW * 3 + gap * 2;
  const top = 258;
  const cards = [0, 1, 2].map((i) => ({
    x: (FIELD.width - total) / 2 + i * (cardW + gap),
    y: top,
    w: cardW,
    h: cardH,
  }));
  return {
    cards,
    begin: { x: FIELD.width / 2 - 150, y: top + cardH + 36, w: 300, h: 56 },
  };
}

/** A starfield and nebula painted once, at boot, on an offscreen canvas. */
function paintBackdrop() {
  const rng = createRandom(1337);
  const off = document.createElement('canvas');
  off.width = FIELD.width;
  off.height = FIELD.height;
  const c = off.getContext('2d');
  const gradient = c.createRadialGradient(640, 360, 60, 640, 360, 760);
  gradient.addColorStop(0, '#101830');
  gradient.addColorStop(0.55, '#0a0f1e');
  gradient.addColorStop(1, '#05070f');
  c.fillStyle = gradient;
  c.fillRect(0, 0, FIELD.width, FIELD.height);
  for (let i = 0; i < 7; i += 1) {
    const x = rng.range(0, FIELD.width);
    const y = rng.range(0, FIELD.height);
    const r = rng.range(140, 320);
    const blob = c.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, i % 2 === 0 ? PALETTE.nebulaA : PALETTE.nebulaB);
    blob.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = blob;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Faint ley rings around the crystal's seat: the arena's old wards.
  for (const [radius, alpha] of [[180, 0.10], [300, 0.07], [430, 0.05]]) {
    c.strokeStyle = `rgba(184, 241, 255, ${alpha})`;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(CRYSTAL.x, CRYSTAL.y, radius, 0, TAU);
    c.stroke();
  }
  for (let i = 0; i < 220; i += 1) {
    const x = rng.range(0, FIELD.width);
    const y = rng.range(0, FIELD.height);
    const r = rng.range(0.4, 1.6);
    c.globalAlpha = rng.range(0.25, 0.95);
    c.fillStyle = PALETTE.star;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }
  // A few bright stars with a cross flare, so the dark has points of light.
  for (let i = 0; i < 26; i += 1) {
    const x = rng.range(30, FIELD.width - 30);
    const y = rng.range(30, FIELD.height - 30);
    const r = rng.range(1.6, 2.6);
    const arm = r * 3.4;
    c.globalAlpha = rng.range(0.6, 1);
    c.fillStyle = '#eaf6ff';
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(234, 246, 255, 0.55)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - arm, y);
    c.lineTo(x + arm, y);
    c.moveTo(x, y - arm);
    c.lineTo(x, y + arm);
    c.stroke();
  }
  c.globalAlpha = 1;
  // A soft vignette, so the eye stays on the field.
  const vignette = c.createRadialGradient(640, 360, 300, 640, 360, 780);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  c.fillStyle = vignette;
  c.fillRect(0, 0, FIELD.width, FIELD.height);
  return off;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const backdrop = paintBackdrop();
  let lastW = 0;
  let lastH = 0;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w !== lastW || h !== lastH) {
      lastW = w;
      lastH = h;
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
    }
  }

  function text(str, x, y, size, color, align = 'center', weight = 600, font = FONT.display) {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function panel(x, y, w, h, radius = 18) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.stroke();
  }

  function bar(x, y, w, h, ratio, color, back = 'rgba(255,255,255,0.12)') {
    ctx.fillStyle = back;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    if (ratio > 0) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w * Math.min(1, ratio), h, h / 2);
      ctx.fill();
    }
  }

  function drawCrystal(state) {
    const pulse = 1 + Math.sin(state.time * 2.2) * 0.05;
    const alive = state.crystalHp > 0;
    const glow = ctx.createRadialGradient(CRYSTAL.x, CRYSTAL.y, 10, CRYSTAL.x, CRYSTAL.y, CRYSTAL.glow * pulse);
    glow.addColorStop(0, alive ? 'rgba(184, 241, 255, 0.34)' : 'rgba(120, 120, 140, 0.12)');
    glow.addColorStop(1, 'rgba(184, 241, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(CRYSTAL.x, CRYSTAL.y, CRYSTAL.glow * pulse, 0, TAU);
    ctx.fill();
    if (alive) {
      // Slow-turning shafts of light: the crystal is the arena's sun.
      ctx.save();
      ctx.translate(CRYSTAL.x, CRYSTAL.y);
      ctx.rotate(state.time * 0.12);
      ctx.fillStyle = 'rgba(184, 241, 255, 0.05)';
      for (let i = 0; i < 6; i += 1) {
        ctx.rotate(TAU / 6);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(-0.1) * 190, Math.sin(-0.1) * 190);
        ctx.lineTo(Math.cos(0.1) * 190, Math.sin(0.1) * 190);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // A dashed rune ring, turning the other way.
      ctx.save();
      ctx.translate(CRYSTAL.x, CRYSTAL.y);
      ctx.rotate(-state.time * 0.2);
      ctx.strokeStyle = 'rgba(184, 241, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, CRYSTAL.radius + 24, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    // The gem: a faceted diamond, bright while it lives, grey when it dies.
    ctx.save();
    ctx.translate(CRYSTAL.x, CRYSTAL.y);
    ctx.rotate(Math.sin(state.time * 0.6) * 0.08);
    const r = CRYSTAL.radius * pulse;
    ctx.fillStyle = alive ? PALETTE.crystal : '#5a6274';
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.72, -r * 0.2);
    ctx.lineTo(r * 0.55, r * 0.8);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.55, r * 0.8);
    ctx.lineTo(-r * 0.72, -r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = alive ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.3, -r * 0.15);
    ctx.lineTo(0, r * 0.55);
    ctx.lineTo(-r * 0.3, -r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // The ring that shows its remaining light.
    ctx.strokeStyle = alive ? 'rgba(184, 241, 255, 0.5)' : 'rgba(120,120,140,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CRYSTAL.x, CRYSTAL.y, CRYSTAL.radius + 12, -Math.PI / 2, -Math.PI / 2 + TAU * (state.crystalHp / state.crystalMaxHp));
    ctx.stroke();
    // A hit on the crystal rings outward in red.
    if (state.crystalFlash > 0) {
      ctx.strokeStyle = `rgba(255, 93, 115, ${state.crystalFlash * 0.8})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(CRYSTAL.x, CRYSTAL.y, CRYSTAL.radius + 12 + (1 - state.crystalFlash) * 70, 0, TAU);
      ctx.stroke();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (state.phase === 'lost' && state.loseReason === 'player') return;
    const blink = player.invuln > 0 && Math.floor(state.time * 16) % 2 === 0;
    const aimAngle = Math.atan2(player.aimY - player.y, player.aimX - player.x);
    // Orbit blades first, behind the warden: golden fangs on their ring.
    if (state.stats.orbiters > 0) {
      for (let i = 0; i < state.stats.orbiters; i += 1) {
        const a = state.time * ORBITER.spin * TAU + (i / state.stats.orbiters) * TAU;
        const bx = player.x + Math.cos(a) * ORBITER.radius;
        const by = player.y + Math.sin(a) * ORBITER.radius;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 11);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff7dd';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.globalAlpha = blink ? 0.35 : 1;
    // A dash leaves cyan streaks behind the warden.
    if (state.dashT > 0) {
      ctx.strokeStyle = 'rgba(127, 240, 255, 0.7)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) {
        const off = (i - 1) * 10;
        const px = -Math.sin(aimAngle) * off;
        const py = Math.cos(aimAngle) * off;
        ctx.beginPath();
        ctx.moveTo(player.x - state.dashX * 18 + px, player.y - state.dashY * 18 + py);
        ctx.lineTo(player.x - state.dashX * 44 + px, player.y - state.dashY * 44 + py);
        ctx.stroke();
      }
    }
    // Aim line: a faint thread from the warden toward where it shoots.
    ctx.strokeStyle = 'rgba(255, 233, 168, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(aimAngle) * 22, player.y + Math.sin(aimAngle) * 22);
    ctx.lineTo(player.x + Math.cos(aimAngle) * 52, player.y + Math.sin(aimAngle) * 52);
    ctx.stroke();
    // Glow, then the warden: a hooded keeper in a gold-trimmed cloak, staff
    // raised toward the aim, eyes lit against the dark.
    const glow = ctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, 44);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.5)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 44, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(aimAngle);
    // Cloak: a cape swept back from the aim.
    ctx.fillStyle = '#2a2f5e';
    ctx.beginPath();
    ctx.moveTo(-6, -13);
    ctx.lineTo(-26, 0);
    ctx.lineTo(-6, 13);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, -13);
    ctx.lineTo(-26, 0);
    ctx.lineTo(-6, 13);
    ctx.stroke();
    // Staff: a shaft toward the aim with a bright orb at its tip.
    ctx.strokeStyle = '#8a6d3b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(2, 10);
    ctx.lineTo(24, -6);
    ctx.stroke();
    ctx.fillStyle = '#fff7dd';
    ctx.beginPath();
    ctx.arc(26, -8, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 233, 168, 0.5)';
    ctx.beginPath();
    ctx.arc(26, -8, 8.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Hood and face.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3a2c10';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(aimAngle) * 4, player.y + Math.sin(aimAngle) * 4, 9.5, 0, TAU);
    ctx.fill();
    // Two lit eyes, looking where the warden shoots.
    const ex = Math.cos(aimAngle);
    const ey = Math.sin(aimAngle);
    const nx = -ey;
    const ny = ex;
    ctx.fillStyle = '#7ff0ff';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(player.x + ex * 6 + nx * side * 4, player.y + ey * 6 + ny * side * 4, 2.2, 0, TAU);
      ctx.fill();
    }
    // The warden's ring: three small orbiters that mark it as the hero.
    for (let i = 0; i < 3; i += 1) {
      const a = state.time * 2.4 + (i / 3) * TAU;
      ctx.fillStyle = PALETTE.cyan;
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(a) * 24, player.y + Math.sin(a) * 24, 3.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    const scale = enemy.spawnT > 0 ? 1 - enemy.spawnT / 0.35 : 1;
    const r = enemy.radius * (0.4 + 0.6 * scale);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.1);
    glow.addColorStop(0, enemy.color + '55');
    glow.addColorStop(1, enemy.color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
    if (enemy.kind === 'wisp') {
      // A small orb with a trailing tail.
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(-enemy.vx * 0.06, -enemy.vy * 0.06, r * 0.55, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1b1030';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.15, r * 0.18, 0, TAU);
      ctx.arc(r * 0.3, -r * 0.15, r * 0.18, 0, TAU);
      ctx.fill();
    } else if (enemy.kind === 'dasher') {
      // A dart that flashes white while it aims its lunge.
      const angle = Math.atan2(enemy.vy, enemy.vx);
      ctx.rotate(angle);
      if (enemy.state === 'aim' && Math.floor(time * 14) % 2 === 0) ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(r * 1.3, 0);
      ctx.lineTo(-r * 0.8, r * 0.85);
      ctx.lineTo(-r * 0.35, 0);
      ctx.lineTo(-r * 0.8, -r * 0.85);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'spitter') {
      // A diamond with a glowing maw.
      ctx.rotate(Math.sin(enemy.t * 1.7) * 0.25);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r * 1.2);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#06210f';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.42, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#d8ffe2';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, TAU);
      ctx.fill();
    } else if (enemy.kind === 'sunder') {
      // A cracking orb: two wisp-cores glow through its fractures.
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3d1a5e';
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.2, r * 0.3, 0, TAU);
      ctx.arc(r * 0.35, r * 0.25, r * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e6ccff';
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.2, r * 0.14, 0, TAU);
      ctx.arc(r * 0.35, r * 0.25, r * 0.14, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 5, 40, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.5);
      ctx.lineTo(-r * 0.1, 0);
      ctx.lineTo(r * 0.5, -r * 0.6);
      ctx.moveTo(-r * 0.2, r * 0.6);
      ctx.lineTo(r * 0.3, r * 0.1);
      ctx.stroke();
    } else if (enemy.kind === 'weaver') {
      // A ringed diamond that spins as it circles the crystal, motes on its rim.
      ctx.rotate(enemy.t * 1.2);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.15);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(0, r * 1.15);
      ctx.lineTo(-r * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.35, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 3; i += 1) {
        const a = enemy.t * 2.6 + (i / 3) * TAU;
        ctx.fillStyle = '#ffd7f2';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35, r * 0.16, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#2b0218';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.34, 0, TAU);
      ctx.fill();
    } else if (enemy.kind === 'husk' || enemy.kind === 'brute') {
      // A chunky hexagon, cracked and heavy. The Gloombrute wears a crown of spikes.
      ctx.rotate(enemy.t * 0.4);
      if (enemy.kind === 'brute') {
        ctx.fillStyle = '#ff8fa3';
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * TAU;
          ctx.save();
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(r * 0.95, -r * 0.16);
          ctx.lineTo(r * 1.45, 0);
          ctx.lineTo(r * 0.95, r * 0.16);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.4);
      ctx.lineTo(0, 0);
      ctx.lineTo(r * 0.4, r * 0.5);
      ctx.stroke();
      if (enemy.kind === 'brute') {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.25, r * 0.14, 0, TAU);
        ctx.arc(r * 0.3, -r * 0.25, r * 0.14, 0, TAU);
        ctx.fill();
      }
    } else if (enemy.kind === 'maw') {
      // The Hollow Maw: a great ringed eye that opens as it weakens.
      const open = 1 - enemy.hp / enemy.maxHp;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a0210';
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.55 + open * 0.25), 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff8fb8';
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.3 + open * 0.15), 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-r * 0.12, -r * 0.12, r * 0.08, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 61, 129, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.18, time * 0.8, time * 0.8 + Math.PI * 1.4);
      ctx.stroke();
    } else if (enemy.kind === 'herald') {
      // The Dusk Herald: a crowned diamond, its core burning brighter as it weakens.
      const open = 1 - enemy.hp / enemy.maxHp;
      ctx.rotate(Math.sin(enemy.t * 0.9) * 0.12);
      ctx.fillStyle = '#ffb3d1';
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.42 - r * 0.12, -r * 0.95);
        ctx.lineTo(i * r * 0.42, -r * 1.45);
        ctx.lineTo(i * r * 0.42 + r * 0.12, -r * 0.95);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.1);
      ctx.lineTo(r * 0.85, 0);
      ctx.lineTo(0, r * 1.1);
      ctx.lineTo(-r * 0.85, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2b0218';
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.42 + open * 0.12), 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ff8fb8';
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.2 + open * 0.12), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 61, 129, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3, -time * 0.7, -time * 0.7 + Math.PI * 1.3);
      ctx.stroke();
    }
    // An elite wears a ring of gold.
    if (enemy.elite) {
      ctx.strokeStyle = PALETTE.elite;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.28, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // A health bar for anything hurt but not dead.
    if (enemy.hp < enemy.maxHp && enemy.kind !== 'wisp') {
      const w = enemy.radius * 2;
      bar(enemy.x - w / 2, enemy.y - enemy.radius - 12, w, 5, enemy.hp / enemy.maxHp, enemy.color);
    }
  }

  function drawWorld(state) {
    ctx.drawImage(backdrop, 0, 0);
    // The arena's edge: a thin golden ring the void presses against.
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(14, 14, FIELD.width - 28, FIELD.height - 28, 24);
    ctx.stroke();

    drawCrystal(state);
    for (const shard of state.shardDrops) {
      const bob = Math.sin(shard.t * 5) * 2;
      ctx.save();
      ctx.translate(shard.x, shard.y + bob);
      ctx.rotate(shard.t * 2);
      ctx.fillStyle = PALETTE.shard;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    for (const bolt of state.bolts) {
      ctx.fillStyle = '#ff8fb8';
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.radius + Math.sin(bolt.t * 12) * 1.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.radius * 0.45, 0, TAU);
      ctx.fill();
    }
    for (const enemy of state.enemies) drawEnemy(enemy, state.time);
    drawPlayer(state);
    for (const bullet of state.bullets) {
      // A short trail along the shot's path, then its bright head.
      const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
      const tx = (bullet.vx / speed) * 16;
      const ty = (bullet.vy / speed) * 16;
      ctx.strokeStyle = 'rgba(255, 233, 168, 0.55)';
      ctx.lineWidth = bullet.radius * 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bullet.x - tx, bullet.y - ty);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.fillStyle = PALETTE.bullet;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius * 0.5, 0, TAU);
      ctx.fill();
    }
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + p.life / p.maxLife), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      text(f.text, f.x, f.y, f.size, f.color, 'center', 700);
    }
    ctx.globalAlpha = 1;
    // When the warden or the crystal is near death, the dark closes in red.
    const lowHp = state.phase === 'combat' && (state.player.hp < 30 || state.crystalHp < 30);
    if (lowHp) {
      const pulse = 0.12 + Math.sin(state.time * 6) * 0.06;
      const danger = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 240, FIELD.width / 2, FIELD.height / 2, 640);
      danger.addColorStop(0, 'rgba(255, 30, 60, 0)');
      danger.addColorStop(1, `rgba(255, 30, 60, ${pulse})`);
      ctx.fillStyle = danger;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawHud(state, ui) {
    // Top-left: score and best.
    text(`SCORE  ${state.score.toLocaleString('en-US')}`, 28, 34, 22, PALETTE.text, 'left', 700);
    text(`BEST  ${Math.max(ui.best, state.score).toLocaleString('en-US')}`, 28, 60, 14, PALETTE.muted, 'left', 600);
    // The streak: a multiplier that fades unless the warden keeps killing.
    if (state.combo >= 2 && state.phase === 'combat') {
      const mult = comboMultiplier(state.combo);
      text(`COMBO ×${mult}`, 28, 88, 18, PALETTE.cyan, 'left', 800);
      bar(28, 102, 90, 6, state.comboTimer / COMBO.window, PALETTE.cyan);
    }
    // Top-center: the wave and what is left of it.
    text(`WAVE ${Math.max(1, state.wave)} / ${WAVES}`, FIELD.width / 2, 34, 22, PALETTE.text, 'center', 700);
    if (state.phase === 'combat') {
      text(`${ui.enemiesLeft} foes remain`, FIELD.width / 2, 60, 14, PALETTE.muted, 'center', 600);
    }
    // Wave pips: gold for cleared waves, a bright ring for the current one.
    for (let i = 0; i < WAVES; i += 1) {
      const px = FIELD.width / 2 - (WAVES - 1) * 11 + i * 22;
      const py = 80;
      if (i < state.wave - 1 || state.phase === 'won') {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, TAU);
        ctx.fill();
      } else if (i === state.wave - 1) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, TAU);
        ctx.fill();
      }
    }
    // Top-right: shards.
    text(`◆ ${state.shards}`, FIELD.width - 28, 34, 22, PALETTE.gold, 'right', 700);
    text(ui.muted ? 'M — sound off' : 'M — mute', FIELD.width - 28, 60, 14, PALETTE.muted, 'right', 600);
    // Bottom-left: the warden's health, and the dash meter above it.
    const dashReady = state.dashCooldown <= 0;
    text('DASH', 28, FIELD.height - 84, 12, dashReady ? PALETTE.cyan : PALETTE.muted, 'left', 700);
    bar(28, FIELD.height - 74, 120, 8, 1 - state.dashCooldown / state.stats.dashCooldown, dashReady ? PALETTE.cyan : 'rgba(127, 240, 255, 0.45)');
    text(dashReady ? 'SHIFT ready' : 'recharging…', 156, FIELD.height - 70, 12, PALETTE.muted, 'left', 600);
    text('WARDEN', 28, FIELD.height - 52, 13, PALETTE.muted, 'left', 700);
    bar(28, FIELD.height - 40, 220, 14, state.player.hp / state.stats.maxHp, state.player.hp < 30 ? PALETTE.danger : PALETTE.heal);
    text(`${Math.ceil(state.player.hp)} / ${state.stats.maxHp}`, 256, FIELD.height - 32, 13, PALETTE.text, 'left', 600);
    // Bottom-right: the crystal's health.
    text('CRYSTAL', FIELD.width - 28, FIELD.height - 52, 13, PALETTE.muted, 'right', 700);
    bar(FIELD.width - 248, FIELD.height - 40, 220, 14, state.crystalHp / state.crystalMaxHp, state.crystalHp < 30 ? PALETTE.danger : PALETTE.crystal);
    text(`${Math.ceil(state.crystalHp)} / ${state.crystalMaxHp}`, FIELD.width - 256, FIELD.height - 32, 13, PALETTE.text, 'right', 600);
    // A boss bar across the top when a boss is on the field.
    const boss = state.enemies.find((e) => e.kind === 'maw' || e.kind === 'brute' || e.kind === 'herald');
    if (boss) {
      const name = boss.kind === 'maw' ? 'THE HOLLOW MAW' : boss.kind === 'herald' ? 'THE DUSK HERALD' : 'THE GLOOMBRUTE';
      text(name, FIELD.width / 2, 104, 15, '#ff8fb8', 'center', 700);
      bar(FIELD.width / 2 - 220, 118, 440, 10, boss.hp / boss.maxHp, '#ff3d81');
    }
    // The wave banner, fading in the middle of the field.
    if (state.banner) {
      const alpha = Math.min(1, state.banner.t);
      ctx.globalAlpha = alpha;
      text(state.banner.title, FIELD.width / 2, 168, 40, PALETTE.gold, 'center', 800);
      text(state.banner.subtitle, FIELD.width / 2, 204, 17, PALETTE.text, 'center', 500, FONT.body);
      ctx.globalAlpha = 1;
    }
  }

  function drawTitle(state, ui) {
    ctx.fillStyle = PALETTE.dimTitle;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // The crystal emblem above the title: a small bright diamond with rays.
    ctx.save();
    ctx.translate(FIELD.width / 2, 84);
    const emblemGlow = ctx.createRadialGradient(0, 0, 4, 0, 0, 60);
    emblemGlow.addColorStop(0, 'rgba(184, 241, 255, 0.5)');
    emblemGlow.addColorStop(1, 'rgba(184, 241, 255, 0)');
    ctx.fillStyle = emblemGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, TAU);
    ctx.fill();
    ctx.rotate(Math.sin(state.time * 0.6) * 0.1);
    ctx.fillStyle = PALETTE.crystal;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(15, -4);
    ctx.lineTo(11, 16);
    ctx.lineTo(0, 22);
    ctx.lineTo(-11, 16);
    ctx.lineTo(-15, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(6, -3);
    ctx.lineTo(0, 12);
    ctx.lineTo(-6, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text('LUMENHOLD', FIELD.width / 2, 178, 92, PALETTE.gold, 'center', 800);
    text('WARDEN OF THE LAST LIGHT', FIELD.width / 2, 236, 22, PALETTE.cyan, 'center', 600);
    text('The void is coming for the crystal. You are all that stands between.', FIELD.width / 2, 286, 18, PALETTE.text, 'center', 500, FONT.body);
    panel(FIELD.width / 2 - 330, 318, 660, 200, 16);
    const rows = [
      ['Move', 'WASD or arrow keys'],
      ['Aim & fire', 'Mouse — hold to shoot'],
      ['Dash', 'SHIFT or right-click'],
      ['Keyboard fire', 'Hold SPACE to auto-aim'],
      ['Pause · Mute', 'P or ESC · M'],
    ];
    rows.forEach(([label, value], i) => {
      const y = 348 + i * 36;
      text(label, FIELD.width / 2 - 300, y, 17, PALETTE.gold, 'left', 700);
      text(value, FIELD.width / 2 + 300, y, 17, PALETTE.text, 'right', 500, FONT.body);
    });
    text('Survive 10 waves. Spend shards on upgrades between waves.', FIELD.width / 2, 552, 17, PALETTE.muted, 'center', 500, FONT.body);
    if (ui.best > 0) text(`BEST SCORE  ${ui.best.toLocaleString('en-US')}`, FIELD.width / 2, 584, 17, PALETTE.gold, 'center', 700);
    const blink = 0.78 + Math.sin(state.time * 3) * 0.22;
    ctx.globalAlpha = blink;
    text('CLICK OR PRESS SPACE TO BEGIN', FIELD.width / 2, 640, 24, PALETTE.text, 'center', 800);
    ctx.globalAlpha = 1;
  }

  function drawShop(state, ui) {
    ctx.fillStyle = PALETTE.dim;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 108, 40, PALETTE.gold, 'center', 800);
    text(`You hold ◆ ${state.shards} shards — spend them, then face wave ${state.wave + 1}.`, FIELD.width / 2, 152, 18, PALETTE.text, 'center', 500, FONT.body);
    const layout = shopLayout();
    state.shopCards.forEach((card, i) => {
      const rect = layout.cards[i];
      const afford = state.shards >= card.cost && !card.sold;
      panel(rect.x, rect.y, rect.w, rect.h, 16);
      ctx.globalAlpha = card.sold ? 0.45 : 1;
      text(`[${i + 1}]`, rect.x + rect.w / 2, rect.y + 26, 14, PALETTE.muted, 'center', 700);
      drawGlyph(ctx, card.id, rect.x + rect.w / 2, rect.y + 62, 19, afford || card.sold ? PALETTE.gold : PALETTE.muted);
      text(card.name, rect.x + rect.w / 2, rect.y + 104, 23, afford || card.sold ? PALETTE.gold : PALETTE.text, 'center', 800);
      text(card.desc, rect.x + rect.w / 2, rect.y + 138, 17, PALETTE.text, 'center', 500, FONT.body);
      text(card.sold ? 'TAKEN' : `◆ ${card.cost}`, rect.x + rect.w / 2, rect.y + 188, 22, card.sold ? PALETTE.heal : afford ? PALETTE.gold : PALETTE.danger, 'center', 800);
      ctx.globalAlpha = 1;
    });
    const begin = layout.begin;
    panel(begin.x, begin.y, begin.w, begin.h, 12);
    text(state.wave + 1 === WAVES ? 'BEGIN THE FINAL WAVE  →' : `BEGIN WAVE ${state.wave + 1}  →`, FIELD.width / 2, begin.y + begin.h / 2, 21, PALETTE.gold, 'center', 800);
    if (ui.shopMessage) text(ui.shopMessage, FIELD.width / 2, begin.y + begin.h + 34, 17, PALETTE.heal, 'center', 700);
    // The build so far: what the warden already carries into the next wave.
    const owned = Object.entries(state.owned)
      .map(([id, count]) => {
        const card = UPGRADES.find((u) => u.id === id);
        return card ? `${card.name}${count > 1 ? ` ×${count}` : ''}` : id;
      });
    if (owned.length > 0) {
      text(`OWNED  ${owned.join('  ·  ')}`, FIELD.width / 2, FIELD.height - 68, 15, PALETTE.cyan, 'center', 600);
    }
    text('Click a card or press 1–3 to buy · ENTER or click below to continue', FIELD.width / 2, FIELD.height - 40, 15, PALETTE.muted, 'center', 500, FONT.body);
  }

  function drawPaused() {
    ctx.fillStyle = PALETTE.dim;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, FIELD.height / 2 - 30, 56, PALETTE.text, 'center', 800);
    text('Press P, ESC or SPACE to return to the fight.', FIELD.width / 2, FIELD.height / 2 + 24, 18, PALETTE.muted, 'center', 500, FONT.body);
  }

  function statsGrid(state, y) {
    const minutes = Math.floor(state.runTime / 60);
    const seconds = Math.floor(state.runTime % 60);
    const upgrades = Object.values(state.owned).reduce((n, c) => n + c, 0);
    const rows = [
      ['Waves cleared', `${state.phase === 'won' ? WAVES : Math.max(0, state.wave - (state.phase === 'shop' ? 0 : 1))} / ${WAVES}`],
      ['Foes slain', String(state.kills)],
      ['Best streak', `${state.comboBest} kills`],
      ['Shards gathered', String(state.shardsCollected)],
      ['Upgrades taken', String(upgrades)],
      ['Time survived', `${minutes}:${String(seconds).padStart(2, '0')}`],
    ];
    rows.forEach(([label, value], i) => {
      const rowY = y + i * 34;
      text(label, FIELD.width / 2 - 190, rowY, 17, PALETTE.muted, 'left', 600);
      text(value, FIELD.width / 2 + 190, rowY, 17, PALETTE.text, 'right', 700);
    });
    return y + rows.length * 34;
  }

  function drawOver(state, ui) {
    ctx.fillStyle = 'rgba(7, 11, 22, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('THE LIGHT FADES', FIELD.width / 2, 150, 56, PALETTE.danger, 'center', 800);
    text(
      state.loseReason === 'crystal'
        ? 'The crystal shattered. The void takes the night.'
        : 'The warden has fallen. The crystal stands alone.',
      FIELD.width / 2, 202, 18, PALETTE.text, 'center', 500, FONT.body,
    );
    text(`SCORE  ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 262, 30, PALETTE.gold, 'center', 800);
    if (state.score >= ui.best && state.score > 0) text('★ A NEW BEST ★', FIELD.width / 2, 300, 17, PALETTE.gold, 'center', 700);
    const after = statsGrid(state, 348);
    const blink = 0.78 + Math.sin(state.time * 3) * 0.22;
    ctx.globalAlpha = blink;
    text('CLICK OR PRESS SPACE TO TRY AGAIN', FIELD.width / 2, after + 46, 22, PALETTE.text, 'center', 800);
    ctx.globalAlpha = 1;
  }

  function drawWin(state, ui) {
    ctx.fillStyle = 'rgba(7, 11, 22, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Dawn breaks over the field: gold light washing down from the top.
    const dawn = ctx.createRadialGradient(FIELD.width / 2, 40, 20, FIELD.width / 2, 40, 720);
    dawn.addColorStop(0, 'rgba(255, 209, 102, 0.20)');
    dawn.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = dawn;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('DAWN RESTORED', FIELD.width / 2, 150, 56, PALETTE.gold, 'center', 800);
    text('The Hollow Maw is unmade. The crystal burns bright again.', FIELD.width / 2, 202, 18, PALETTE.text, 'center', 500, FONT.body);
    text(`SCORE  ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 262, 30, PALETTE.gold, 'center', 800);
    if (state.score >= ui.best && state.score > 0) text('★ A NEW BEST ★', FIELD.width / 2, 300, 17, PALETTE.gold, 'center', 700);
    const after = statsGrid(state, 348);
    const blink = 0.78 + Math.sin(state.time * 3) * 0.22;
    ctx.globalAlpha = blink;
    text('CLICK OR PRESS SPACE TO PLAY AGAIN', FIELD.width / 2, after + 46, 22, PALETTE.text, 'center', 800);
    ctx.globalAlpha = 1;
  }

  return {
    /** Paint one frame: the world, the HUD, and the current screen's overlay. */
    draw(state, screen, ui) {
      resize();
      const view = viewTransform(canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = PALETTE.void;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      // Screen shake: a small random offset while the world is shaking.
      if (state.shake > 0.2) {
        ctx.translate((Math.random() * 2 - 1) * state.shake * 0.6, (Math.random() * 2 - 1) * state.shake * 0.6);
      }
      drawWorld(state);
      if (screen !== SCREEN_TITLE) drawHud(state, ui);
      if (screen === SCREEN_TITLE) drawTitle(state, ui);
      else if (screen === SCREEN_SHOP) drawShop(state, ui);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, ui);
      else if (screen === SCREEN_WIN) drawWin(state, ui);
    },
  };
}
