// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, shop, paused, game over and victory.
//
// ?seed=N fixes the run's randomness. ?shot=title|play|shop|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, MUTE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BIG_KILL,
  EVENT_COMBO_UP,
  EVENT_CRYSTAL_HIT,
  EVENT_DASH,
  EVENT_ENEMY_HIT,
  EVENT_KILL,
  EVENT_OVER,
  EVENT_PICKUP,
  EVENT_PLAYER_HIT,
  EVENT_SHOOT,
  EVENT_WAVE_CLEAR,
  EVENT_WIN,
  comboMultiplier,
} from './world.js';
import {
  ACTION_BUY_1,
  ACTION_BUY_2,
  ACTION_BUY_3,
  ACTION_CONFIRM,
  ACTION_DASH,
  ACTION_MUTE,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_SHOP,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
  shopLayout,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : shot ? 7 : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readStored(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function saveStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be off (private windows): the value then lasts this visit only.
  }
}

function readBest() {
  return Number.parseInt(readStored(BEST_KEY, '0'), 10) || 0;
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = {
    best: scene.best,
    muted: false,
    enemiesLeft: world.enemiesLeft(),
    shopMessage: '',
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  world.reset();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = readStored(MUTE_KEY, '0') === '1';
  let shopMessage = '';
  let accumulator = 0;
  let last = performance.now();
  // A dash pressed this frame is latched and spent by the next simulation step.
  let dashQueued = false;
  audio.setMuted(muted);

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function toggleMute() {
    muted = !muted;
    audio.setMuted(muted);
    saveStored(MUTE_KEY, muted ? '1' : '0');
    announce(muted ? 'Sound off.' : 'Sound on.');
  }

  function startGame() {
    audio.unlock();
    world.reset();
    world.beginWave(1);
    shopMessage = '';
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.waveStart();
    announce('Playing. Wave 1. Defend the crystal.');
  }

  function nextWave() {
    audio.unlock();
    audio.waveStart();
    world.beginWave(world.state.wave + 1);
    shopMessage = '';
    screen = SCREEN_PLAY;
    announce(`Wave ${world.state.wave}.`);
  }

  function endRun(won) {
    if (world.state.score > best) {
      best = world.state.score;
      saveStored(BEST_KEY, String(best));
    }
    if (won) {
      screen = SCREEN_WIN;
      audio.victory();
      announce(`Victory! Score ${world.state.score}. Best ${best}.`);
    } else {
      screen = SCREEN_OVER;
      audio.gameOver();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function buyCard(index) {
    const message = world.buyCard(index);
    if (message) {
      shopMessage = message;
      audio.buy();
    } else {
      shopMessage = 'Not enough shards for that one.';
      audio.click();
    }
  }

  function clickIn(rect, at) {
    return at.x >= rect.x && at.x <= rect.x + rect.w && at.y >= rect.y && at.y <= rect.y + rect.h;
  }

  function handleShopClick(at) {
    const layout = shopLayout();
    for (let i = 0; i < layout.cards.length; i += 1) {
      if (clickIn(layout.cards[i], at)) {
        buyCard(i);
        return;
      }
    }
    if (clickIn(layout.begin, at)) nextWave();
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) toggleMute();
    if (actions & ACTION_DASH) dashQueued = true;
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_SHOP) {
      if (click) handleShopClick(click);
      if (actions & ACTION_BUY_1) buyCard(0);
      else if (actions & ACTION_BUY_2) buyCard(1);
      else if (actions & ACTION_BUY_3) buyCard(2);
      // A keyboard confirm (no click this frame) begins the next wave; a click
      // on the Begin button already did, through handleShopClick.
      if (actions & ACTION_CONFIRM && !click) nextWave();
    }
  }

  function playSounds(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_COMBO_UP) audio.combo(comboMultiplier(world.state.combo));
    if (events & EVENT_ENEMY_HIT) audio.enemyHit();
    if (events & EVENT_KILL) audio.explode(false);
    if (events & EVENT_BIG_KILL) audio.explode(true);
    if (events & EVENT_PLAYER_HIT) audio.playerHit();
    if (events & EVENT_CRYSTAL_HIT) audio.crystalHit();
    if (events & EVENT_PICKUP) audio.pickup();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false, autoAim: false });
      return;
    }
    const move = input.move();
    const aim = input.aim();
    const dash = dashQueued;
    dashQueued = false;
    const events = world.step(STEP, {
      moveX: move.x,
      moveY: move.y,
      aimX: aim.x,
      aimY: aim.y,
      firing: input.firing(),
      autoAim: input.firingWithKeyboard(),
      dash,
    });
    playSounds(events);
    if (events & EVENT_WIN) endRun(true);
    else if (events & EVENT_OVER) endRun(false);
    else if (events & EVENT_WAVE_CLEAR) {
      screen = SCREEN_SHOP;
      audio.waveClear();
      announce(`Wave ${world.state.wave} cleared. Choose an upgrade.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_SHOP || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      while (accumulator >= STEP && screen !== SCREEN_PAUSED) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, {
      best,
      muted,
      enemiesLeft: world.enemiesLeft(),
      shopMessage,
    });
  }

  // Leaving the tab pauses a running game rather than letting the void attack unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // The first gesture unlocks audio, even before the game starts.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  announce('Lumenhold. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
