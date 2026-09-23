// Tiny WebAudio synth: every sound is generated, so there are no assets to ship.
// The context is created lazily on the first user gesture (autoplay policy).
export default class Sfx {
	constructor() {
		this.ctx = null;
		this.enabled = true;
		this.lastCast = 0;
	}

	ensure() {
		if (!this.enabled) return null;
		if (!this.ctx) {
			const AC = window.AudioContext || window.webkitAudioContext;
			if (!AC) return null;
			this.ctx = new AC();
			this.master = this.ctx.createGain();
			this.master.gain.value = 0.12;
			this.master.connect(this.ctx.destination);
			const len = this.ctx.sampleRate * 0.5;
			this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
			const data = this.noise.getChannelData(0);
			for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
		}
		if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
		return this.ctx;
	}

	tone(freq, dur, {
		type = 'square', vol = 0.6, slide = null, delay = 0,
	} = {}) {
		const ctx = this.ensure();
		if (!ctx) return;
		const t0 = ctx.currentTime + delay;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t0);
		if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
		g.gain.setValueAtTime(vol, t0);
		g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
		osc.connect(g).connect(this.master);
		osc.start(t0);
		osc.stop(t0 + dur + 0.02);
	}

	burst(dur, vol = 0.8, cutoff = 1200) {
		const ctx = this.ensure();
		if (!ctx) return;
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
		filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + dur);
		const g = ctx.createGain();
		g.gain.setValueAtTime(vol, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
		src.connect(filter).connect(g).connect(this.master);
		src.start();
		src.stop(ctx.currentTime + dur);
	}

	arp(notes, step = 0.06, opts = {}) {
		notes.forEach((f, i) => this.tone(f, step * 1.8, { ...opts, delay: i * step }));
	}

	cast() {
		const now = performance.now();
		if (now - this.lastCast < 45) return;
		this.lastCast = now;
		this.tone(620 + Math.random() * 260, 0.06, { vol: 0.35 });
	}

	buy() { this.arp([523, 784], 0.05, { vol: 0.35 }); }

	upgrade() { this.arp([523, 659, 784, 1047], 0.05, { type: 'triangle', vol: 0.5 }); }

	wisp() { this.arp([880, 1175, 1568, 2093], 0.045, { type: 'triangle', vol: 0.45 }); }

	fireball() {
		this.burst(0.6, 0.9, 1800);
		this.tone(220, 0.5, { type: 'sawtooth', vol: 0.4, slide: 55 });
	}

	spell() { this.tone(220, 0.45, { type: 'sine', vol: 0.7, slide: 1320 }); }

	achievement() { this.arp([659, 784, 988, 1319], 0.08, { type: 'square', vol: 0.3 }); }

	ascend() {
		this.arp([262, 330, 392, 523, 659, 784, 1047, 1319], 0.09, { type: 'triangle', vol: 0.5 });
		this.burst(1.2, 0.3, 4000);
	}
}
