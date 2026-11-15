// The shop cards' icons: each upgrade gets a small glyph drawn in code (no
// image files), so a card reads at a glance. Every glyph is drawn centred on
// (x, y) inside a circle of radius `r`, in the given colour.
const TAU = Math.PI * 2;

/** Draw the glyph for upgrade `id` on `ctx`, centred at (x, y). */
export function drawGlyph(ctx, id, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (id === 'damage') {
    // A flame.
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.85, -r * 0.1, r * 0.5, r * 0.55);
    ctx.quadraticCurveTo(r * 0.25, r * 0.95, 0, r * 0.8);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.95, -r * 0.55, r * 0.4);
    ctx.quadraticCurveTo(-r * 0.6, -r * 0.2, 0, -r);
    ctx.fill();
  } else if (id === 'rapid') {
    // Three shots, one ahead of the others.
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(-r * 0.6 + i * r * 0.6, -r * 0.25 + i * r * 0.25, r * 0.22, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, r * 0.6);
    ctx.lineTo(r * 0.7, r * 0.6);
    ctx.stroke();
  } else if (id === 'swift') {
    // Wind: three strokes of rising length.
    for (let i = 0; i < 3; i += 1) {
      const yy = -r * 0.5 + i * r * 0.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, yy);
      ctx.lineTo(r * (0.2 + i * 0.25), yy);
      ctx.stroke();
    }
  } else if (id === 'vital') {
    // A heart.
    ctx.beginPath();
    ctx.moveTo(0, r * 0.8);
    ctx.bezierCurveTo(-r * 1.1, r * 0.1, -r * 0.7, -r * 0.9, 0, -r * 0.3);
    ctx.bezierCurveTo(r * 0.7, -r * 0.9, r * 1.1, r * 0.1, 0, r * 0.8);
    ctx.fill();
  } else if (id === 'twin') {
    // Two sparks side by side.
    for (const sx of [-0.45, 0.45]) {
      ctx.beginPath();
      ctx.moveTo(sx * r, -r * 0.7);
      ctx.lineTo(sx * r + r * 0.28, 0);
      ctx.lineTo(sx * r, r * 0.7);
      ctx.lineTo(sx * r - r * 0.28, 0);
      ctx.closePath();
      ctx.fill();
    }
  } else if (id === 'pierce') {
    // An arrow through a ring.
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.9);
    ctx.lineTo(r * 0.7, -r * 0.7);
    ctx.moveTo(r * 0.2, -r * 0.7);
    ctx.lineTo(r * 0.7, -r * 0.7);
    ctx.lineTo(r * 0.7, -r * 0.2);
    ctx.stroke();
  } else if (id === 'heavy') {
    // A heavy shot: a big disc with a bright core.
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#101828';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, TAU);
    ctx.fill();
  } else if (id === 'magnet') {
    // A horseshoe magnet with two sparks flying in.
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 0.6, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.1);
    ctx.lineTo(-r * 0.6, r * 0.55);
    ctx.moveTo(r * 0.6, -r * 0.1);
    ctx.lineTo(r * 0.6, r * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-r * 0.6, r * 0.75, r * 0.14, 0, TAU);
    ctx.arc(r * 0.6, r * 0.75, r * 0.14, 0, TAU);
    ctx.fill();
  } else if (id === 'mend') {
    // A plus in a ring: steady healing.
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, 0);
    ctx.lineTo(r * 0.4, 0);
    ctx.moveTo(0, -r * 0.4);
    ctx.lineTo(0, r * 0.4);
    ctx.stroke();
  } else if (id === 'repair') {
    // A crystal being mended: a diamond with a spark above it.
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.5);
    ctx.lineTo(r * 0.5, 0);
    ctx.lineTo(0, r * 0.85);
    ctx.lineTo(-r * 0.5, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.95);
    ctx.lineTo(r * 0.16, -r * 0.65);
    ctx.lineTo(0, -r * 0.35);
    ctx.lineTo(-r * 0.16, -r * 0.65);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'orbit') {
    // A centre with a blade on its orbit ring.
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.8, -r * 0.28);
    ctx.lineTo(r * 1.05, 0);
    ctx.lineTo(r * 0.8, r * 0.28);
    ctx.lineTo(r * 0.62, 0);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'aegis') {
    // A shield over the crystal's light.
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.85);
    ctx.lineTo(r * 0.7, -r * 0.5);
    ctx.lineTo(r * 0.7, r * 0.1);
    ctx.quadraticCurveTo(r * 0.7, r * 0.7, 0, r * 0.9);
    ctx.quadraticCurveTo(-r * 0.7, r * 0.7, -r * 0.7, r * 0.1);
    ctx.lineTo(-r * 0.7, -r * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.35);
    ctx.lineTo(r * 0.25, 0);
    ctx.lineTo(0, r * 0.4);
    ctx.lineTo(-r * 0.25, 0);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'step') {
    // A dash: three chevrons leaning forward.
    for (let i = 0; i < 3; i += 1) {
      const xx = -r * 0.6 + i * r * 0.45;
      ctx.beginPath();
      ctx.moveTo(xx, -r * 0.5);
      ctx.lineTo(xx + r * 0.35, 0);
      ctx.lineTo(xx, r * 0.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}
