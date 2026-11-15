// Every sound is synthesized with the Web Audio API — no audio files, no
// network. Short oscillator and noise envelopes give the shots, hits and
// pickups their voice; a slow arpeggio loop is the music. Nothing here runs
// until the player first interacts (browsers require a gesture), and the whole
// engine stays silent when muted or when audio is unavailable.

/** The music's slow arpeggio: A minor pentatonic, one note a beat. */
const MUSIC_NOTES = [220.0, 261.63, 293.66, 329.63, 392.0, 329.63, 293.66, 261.63];
const MUSIC_BEAT = 0.42;

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  /** Build the context on the first gesture; a no-op when audio is unavailable. */
  function ensure() {
    if (ctx !== null) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  /** A tone that slides from `from` to `to` over `seconds`, then fades out. */
  function tone({ type = 'sine', from = 440, to = null, seconds = 0.12, volume = 0.2, when = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  /** A burst of filtered noise — the body of explosions and hits. */
  function noise({ seconds = 0.2, volume = 0.25, low = 400, when = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  /** One step of the music loop: a soft plucked note and, every bar, a low root. */
  function musicTick() {
    if (!ctx || muted) return;
    const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
    tone({ type: 'triangle', from: note, seconds: 0.5, volume: 0.12 });
    if (musicStep % 8 === 0) tone({ type: 'sine', from: 110, seconds: 1.6, volume: 0.1 });
    musicStep += 1;
  }

  return {
    /** Call from a user gesture: unlocks audio and starts the music loop. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') void ctx.resume();
      if (musicTimer === null) musicTimer = window.setInterval(musicTick, MUSIC_BEAT * 1000);
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone({ type: 'square', from: 880, to: 520, seconds: 0.07, volume: 0.06 });
    },
    enemyHit() {
      tone({ type: 'sawtooth', from: 320, to: 180, seconds: 0.06, volume: 0.08 });
    },
    explode(big = false) {
      noise({ seconds: big ? 0.5 : 0.22, volume: big ? 0.4 : 0.2, low: big ? 300 : 900 });
      tone({ type: 'sine', from: big ? 160 : 220, to: 40, seconds: big ? 0.5 : 0.25, volume: 0.25 });
    },
    playerHit() {
      tone({ type: 'sawtooth', from: 200, to: 60, seconds: 0.25, volume: 0.25 });
      noise({ seconds: 0.18, volume: 0.2, low: 500 });
    },
    crystalHit() {
      tone({ type: 'sine', from: 140, to: 70, seconds: 0.3, volume: 0.3 });
    },
    pickup() {
      tone({ type: 'sine', from: 660, to: 990, seconds: 0.09, volume: 0.1 });
    },
    buy() {
      tone({ type: 'triangle', from: 523, seconds: 0.1, volume: 0.15 });
      tone({ type: 'triangle', from: 784, seconds: 0.16, volume: 0.15, when: 0.08 });
    },
    waveStart() {
      tone({ type: 'triangle', from: 392, seconds: 0.18, volume: 0.18 });
      tone({ type: 'triangle', from: 523, seconds: 0.18, volume: 0.18, when: 0.12 });
      tone({ type: 'triangle', from: 659, seconds: 0.28, volume: 0.18, when: 0.24 });
    },
    waveClear() {
      tone({ type: 'triangle', from: 659, seconds: 0.14, volume: 0.16 });
      tone({ type: 'triangle', from: 784, seconds: 0.14, volume: 0.16, when: 0.1 });
      tone({ type: 'triangle', from: 1047, seconds: 0.3, volume: 0.16, when: 0.2 });
    },
    click() {
      tone({ type: 'sine', from: 700, seconds: 0.05, volume: 0.08 });
    },
    gameOver() {
      tone({ type: 'triangle', from: 392, to: 380, seconds: 0.4, volume: 0.2 });
      tone({ type: 'triangle', from: 311, to: 300, seconds: 0.4, volume: 0.2, when: 0.35 });
      tone({ type: 'triangle', from: 233, to: 220, seconds: 0.8, volume: 0.2, when: 0.7 });
    },
    victory() {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone({ type: 'triangle', from: f, seconds: 0.5, volume: 0.18, when: i * 0.14 }));
    },
  };
}
