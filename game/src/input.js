// Keyboard and mouse, read as state each frame plus edge-triggered actions
// the game consumes once. Movement is WASD or arrows; aiming follows the
// mouse; firing is a held mouse button or a held Space (which auto-aims at the
// nearest enemy, so the game is playable on keyboard alone).
import { toLogical, viewTransform } from './view.js';

export const ACTION_CONFIRM = 1 << 0;
export const ACTION_PAUSE = 1 << 1;
export const ACTION_MUTE = 1 << 2;
export const ACTION_BUY_1 = 1 << 3;
export const ACTION_BUY_2 = 1 << 4;
export const ACTION_BUY_3 = 1 << 5;

/** Keys the game owns: their browser defaults (scrolling, find) are suppressed. */
const HANDLED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let clicked = false;
  let mouseX = 0;
  let mouseY = 0;

  function logicalFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const view = viewTransform(rect.width, rect.height);
    return toLogical(view, event.clientX - rect.left, event.clientY - rect.top);
  }

  function onKeyDown(event) {
    if (HANDLED.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'Digit1') actions |= ACTION_BUY_1;
    else if (event.code === 'Digit2') actions |= ACTION_BUY_2;
    else if (event.code === 'Digit3') actions |= ACTION_BUY_3;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const at = logicalFromEvent(event);
    mouseX = at.x;
    mouseY = at.y;
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    const at = logicalFromEvent(event);
    mouseX = at.x;
    mouseY = at.y;
    mouseDown = true;
    clicked = true;
    actions |= ACTION_CONFIRM;
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** The movement vector, normalized; zero when no move key is held. */
    move() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    /** Where the mouse points, in logical field coordinates. */
    aim() {
      return { x: mouseX, y: mouseY };
    },
    /** Whether the player is firing: mouse held, or Space held. */
    firing() {
      return mouseDown || keys.has('Space');
    },
    /** Whether Space (not the mouse) is the firing key: aim then snaps to the nearest enemy. */
    firingWithKeyboard() {
      return keys.has('Space') && !mouseDown;
    },
    /** The actions pressed since the last call, then cleared. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Whether the mouse was clicked since the last call, and where (logical). */
    takeClick() {
      if (!clicked) return null;
      clicked = false;
      return { x: mouseX, y: mouseY };
    },
  };
}
