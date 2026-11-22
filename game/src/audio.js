// audio.js — every sound is synthesized with WebAudio. No audio files ship
// with the game, so nothing loads over the network and the game folder stays
// small. The context is created on the first user gesture (the start click),
// which is also what browsers require before audio may play.

export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.sirenNodes = null;
  }

  // Call from a click or key handler. Safe to call repeatedly.
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.context.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setValueAtTime(muted ? 0 : 0.5, this.context.currentTime);
    }
  }

  // One short oscillator blip. Frequency slides from `from` to `to` over the
  // note so a single helper can make pickups, clicks and stings.
  blip({ from = 440, to = null, duration = 0.12, type = 'sine', volume = 0.5, delay = 0 }) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    if (to !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(to, 1), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }

  pickup() {
    this.blip({ from: 660, to: 990, duration: 0.14, type: 'triangle', volume: 0.5 });
    this.blip({ from: 990, to: 1320, duration: 0.16, type: 'triangle', volume: 0.4, delay: 0.07 });
  }

  coinThrow() {
    this.blip({ from: 300, to: 520, duration: 0.1, type: 'sine', volume: 0.25 });
  }

  coinLand() {
    this.blip({ from: 1900, to: 1500, duration: 0.09, type: 'square', volume: 0.16 });
    this.blip({ from: 1500, to: 1200, duration: 0.12, type: 'square', volume: 0.12, delay: 0.09 });
  }

  vaultTick() {
    this.blip({ from: 1200, to: 900, duration: 0.05, type: 'square', volume: 0.18 });
  }

  vaultOpen() {
    this.blip({ from: 392, duration: 0.16, type: 'triangle', volume: 0.5 });
    this.blip({ from: 523, duration: 0.16, type: 'triangle', volume: 0.5, delay: 0.12 });
    this.blip({ from: 784, duration: 0.28, type: 'triangle', volume: 0.5, delay: 0.24 });
  }

  spotted() {
    this.blip({ from: 880, to: 440, duration: 0.3, type: 'sawtooth', volume: 0.3 });
  }

  // A looping two-tone siren while the alarm is tripped.
  startSiren() {
    if (!this.context || !this.master || this.sirenNodes) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 740;
    lfo.type = 'sine';
    lfo.frequency.value = 1.6;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);
    gain.gain.value = 0.12;
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    lfo.start();
    this.sirenNodes = { oscillator, lfo, gain };
  }

  stopSiren() {
    if (!this.sirenNodes) return;
    try {
      this.sirenNodes.oscillator.stop();
      this.sirenNodes.lfo.stop();
    } catch (error) {
      // Already stopped; nothing to do.
    }
    this.sirenNodes = null;
  }

  win() {
    [523, 659, 784, 1047].forEach((frequency, index) => {
      this.blip({ from: frequency, duration: 0.22, type: 'triangle', volume: 0.5, delay: index * 0.13 });
    });
  }

  busted() {
    this.blip({ from: 320, to: 90, duration: 0.7, type: 'sawtooth', volume: 0.4 });
    this.blip({ from: 160, to: 60, duration: 0.7, type: 'square', volume: 0.25, delay: 0.1 });
  }
}
