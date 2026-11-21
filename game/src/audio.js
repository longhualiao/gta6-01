// Synthesised sound: every effect is built from oscillators and filtered noise,
// so the game ships no audio files and loads nothing over the network.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t);
  }

  // A laid-back synthwave bassline loop: A minor, 100 BPM, eighth notes.
  const BASSLINE = [110, 0, 110, 0, 130.81, 0, 110, 0, 98, 0, 98, 0, 146.83, 0, 130.81, 0];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const freq = BASSLINE[musicStep % BASSLINE.length];
      musicStep += 1;
      if (freq > 0) tone(freq, 0.28, 'triangle', 0.10);
      if (musicStep % 4 === 0) noise(0.05, 0.03, 6000); // soft hat
    }, 300);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    startMusic,
    gunshot() { noise(0.14, 0.5, 900); tone(180, 0.08, 'square', 0.25, 60); },
    punch() { noise(0.08, 0.3, 500); },
    pickup() { tone(660, 0.09, 'sine', 0.25); window.setTimeout(() => tone(990, 0.14, 'sine', 0.25), 70); },
    crash() { noise(0.35, 0.55, 400); tone(90, 0.3, 'sawtooth', 0.3, 40); },
    siren() { tone(740, 0.32, 'sine', 0.10, 980); },
    horn() { tone(370, 0.18, 'square', 0.12); tone(466, 0.18, 'square', 0.10); },
    mission() { tone(523, 0.12, 'sine', 0.3); window.setTimeout(() => tone(784, 0.2, 'sine', 0.3), 110); },
    busted() { tone(220, 0.5, 'sawtooth', 0.25, 110); },
    engine(on, speedRatio) {
      if (!ensure()) return;
      if (!on) {
        if (engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; engineGain = null; }
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.02;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 500;
        engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speedRatio * 130;
      engineGain.gain.value = muted ? 0 : 0.015 + speedRatio * 0.03;
    },
  };
}
