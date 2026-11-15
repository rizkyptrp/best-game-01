// The letterbox transform: the logical 1280x720 field is scaled to fit the
// window, centred, keeping its shape. The renderer and the mouse both use it,
// so a click on the screen lands on the same logical point the player sees.
import { FIELD } from './config.js';

/** The scale and offset that map logical field coordinates onto a canvas. */
export function viewTransform(canvasWidth, canvasHeight) {
  const scale = Math.min(canvasWidth / FIELD.width, canvasHeight / FIELD.height);
  return {
    scale,
    x: (canvasWidth - FIELD.width * scale) / 2,
    y: (canvasHeight - FIELD.height * scale) / 2,
  };
}

/** A point in canvas pixels, as logical field coordinates. */
export function toLogical(view, px, py) {
  return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
}
