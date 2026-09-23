// Canvas renderer for the spire. Draws at a native 320x180 and lets CSS scale
// it up with nearest-neighbour filtering, so every frame is a few thousand
// fillRects at most. The static backdrop is rasterised once.
import {
	spriteCanvas, textCanvas, PALETTE,
} from './sprites.mjs';
import { formatNumber } from './format.mjs';
import { currentAlignment } from './engine.mjs';

export const W = 320;
export const H = 180;
const GROUND = 150;
const TAU = Math.PI * 2;
const ORB = { x: 156, y: 116 };
const MAX_PARTICLES = 420;

// Seeded PRNG so the backdrop (hills, grass, stars) is identical every load.
/* eslint-disable no-bitwise, operator-assignment */
const mulberry32 = (seed) => {
	let a = seed;
	return () => {
		a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};
/* eslint-enable no-bitwise, operator-assignment */

const wispPos = (w) => {
	const p = w.age / w.life;
	const x = w.dir > 0 ? -12 + p * 344 : W + 12 - p * 344;
	const y = 26 + w.seed * 72 + Math.sin(w.age * 2.2 + w.seed * 9) * 10;
	return { x, y };
};

const starColor = (b) => {
	if (b > 0.6) return '#ffffff';
	if (b > -0.2) return '#9e8fd6';
	return '#4a3d86';
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const SKY = [[0, '#07051a'], [0.45, '#140d33'], [0.78, '#2b1a55'], [1, '#4a2766']].map(([t, c]) => [t, rgb(c)]);

const farHill = (x) => 106 + 9 * Math.sin(x * 0.03 + 1) + 6 * Math.sin(x * 0.071) + 3 * Math.sin(x * 0.17);
const nearHill = (x) => 127 + 5 * Math.sin(x * 0.021 + 2) + 3 * Math.sin(x * 0.093);

const CRYSTAL_SPOTS = [118, 236, 100, 252, 132];
// Sky regions for aligned constellations (a second one appears under Twin Stars).
const CONSTELLATION_BOXES = [[180, 8, 54, 34], [72, 10, 52, 30]];

// Each summon owns a fixed star pattern, derived from its id.
const constellationCache = new Map();
const constellation = (id) => {
	if (!constellationCache.has(id)) {
		const rng = mulberry32([...id].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7));
		const pts = Array.from({ length: 6 }, () => [rng(), rng()]).sort((a, b) => a[0] - b[0]);
		constellationCache.set(id, pts);
	}
	return constellationCache.get(id);
};

export class Scene {
	constructor(canvas) {
		this.canvas = canvas;
		canvas.width = W;
		canvas.height = H;
		this.ctx = canvas.getContext('2d');
		this.ctx.imageSmoothingEnabled = false;
		const rng = mulberry32(1337);
		this.rng = Math.random;
		this.bg = this.buildBackground(rng);
		this.stars = Array.from({ length: 70 }, () => ({
			x: Math.floor(rng() * W), y: Math.floor(rng() * 112), p: rng() * TAU, s: 0.6 + rng() * 2, big: rng() < 0.12,
		}));
		this.particles = [];
		this.floaters = [];
		this.bolts = [];
		this.walkers = { apprentice: [], golem: [] };
		this.time = 0;
		this.castPose = 0;
		this.orbFlash = 0;
		this.flash = null;
		this.shake = 0;
		this.autoFloat = { amount: 0, t: 0 };
		this.alignPulse = 0;
		this.reducedFx = false;
	}

	// Backdrop ------------------------------------------------------------
	buildBackground(rng) {
		const c = document.createElement('canvas');
		c.width = W;
		c.height = H;
		const ctx = c.getContext('2d');
		const img = ctx.createImageData(W, H);
		for (let y = 0; y < GROUND; y += 1) {
			const t = Math.min(1, y / 135);
			let i = 0;
			while (i < SKY.length - 2 && t > SKY[i + 1][0]) i += 1;
			const [t0, c0] = SKY[i];
			const [t1, c1] = SKY[i + 1];
			const f = (t - t0) / (t1 - t0);
			for (let x = 0; x < W; x += 1) {
				const col = f * 16 > BAYER[(y % 4) * 4 + (x % 4)] ? c1 : c0;
				const o = (y * W + x) * 4;
				[img.data[o], img.data[o + 1], img.data[o + 2]] = col;
				img.data[o + 3] = 255;
			}
		}
		ctx.putImageData(img, 0, 0);

		// Moon with a dithered halo.
		const mx = 272;
		const my = 32;
		for (let y = -20; y <= 20; y += 1) {
			for (let x = -20; x <= 20; x += 1) {
				const d = Math.hypot(x, y);
				if (d <= 12) {
					ctx.fillStyle = d > 10.5 ? '#cdbf9c' : '#efe3c2';
					ctx.fillRect(mx + x, my + y, 1, 1);
				} else if (d < 19 && (x + y) % 2 === 0 && d < 14 + BAYER[((y + 20) % 4) * 4 + ((x + 20) % 4)] / 3) {
					ctx.fillStyle = '#3a2a6a';
					ctx.fillRect(mx + x, my + y, 1, 1);
				}
			}
		}
		[[-4, -3, 3], [3, 2, 2], [-2, 5, 2], [5, -5, 1]].forEach(([x, y, r]) => {
			ctx.fillStyle = '#d6c8a4';
			for (let yy = -r; yy <= r; yy += 1) {
				for (let xx = -r; xx <= r; xx += 1) if (xx * xx + yy * yy <= r * r) ctx.fillRect(mx + x + xx, my + y + yy, 1, 1);
			}
		});

		for (let x = 0; x < W; x += 1) {
			const fh = Math.round(farHill(x));
			ctx.fillStyle = '#1e1542';
			ctx.fillRect(x, fh, 1, GROUND - fh);
			ctx.fillStyle = '#2c2160';
			ctx.fillRect(x, fh, 1, 1);
			const nh = Math.round(nearHill(x));
			ctx.fillStyle = '#150f33';
			ctx.fillRect(x, nh, 1, GROUND - nh);
			ctx.fillStyle = '#251b52';
			ctx.fillRect(x, nh, 1, 1);
		}

		// Ground.
		ctx.fillStyle = '#14222b';
		ctx.fillRect(0, GROUND, W, H - GROUND);
		ctx.fillStyle = '#23483f';
		ctx.fillRect(0, GROUND, W, 1);
		ctx.fillStyle = '#1b3a36';
		ctx.fillRect(0, GROUND + 1, W, 1);
		for (let i = 0; i < 260; i += 1) {
			const x = Math.floor(rng() * W);
			const y = GROUND + 2 + Math.floor(rng() * (H - GROUND - 2));
			ctx.fillStyle = rng() < 0.5 ? '#1c3336' : '#0f1a22';
			ctx.fillRect(x, y, rng() < 0.3 ? 2 : 1, 1);
		}
		for (let i = 0; i < 40; i += 1) {
			const x = Math.floor(rng() * W);
			ctx.fillStyle = '#2f5a4b';
			ctx.fillRect(x, GROUND - 1, 1, 1);
			ctx.fillRect(x + 1, GROUND - 2, 1, 2);
		}
		// Rune circle the wizard stands in.
		for (let a = 0; a < TAU; a += 0.05) {
			const x = Math.round(148 + Math.cos(a) * 30);
			const y = Math.round(GROUND + 3 + Math.sin(a) * 4);
			ctx.fillStyle = '#2b3f6a';
			ctx.fillRect(x, y, 1, 1);
		}

		this.drawTower(ctx);
		return c;
	}

	drawTower(ctx) {
		const x0 = 14;
		const x1 = 54;
		const top = 48;
		ctx.fillStyle = '#0d0a1e';
		ctx.fillRect(x0 - 1, top, x1 - x0 + 2, GROUND - top);
		ctx.fillStyle = '#3a3553';
		ctx.fillRect(x0, top, x1 - x0, GROUND - top);
		ctx.fillStyle = '#57507a';
		ctx.fillRect(x0, top, 2, GROUND - top);
		ctx.fillStyle = '#27233a';
		ctx.fillRect(x1 - 3, top, 3, GROUND - top);
		ctx.fillStyle = '#2a2640';
		for (let y = top + 5; y < GROUND; y += 6) {
			ctx.fillRect(x0 + 2, y, x1 - x0 - 5, 1);
			const off = ((y - top) / 6) % 2 ? 4 : 10;
			for (let x = x0 + off; x < x1 - 3; x += 12) ctx.fillRect(x, y - 5, 1, 5);
		}
		// Conical roof.
		const cx = 34;
		for (let y = 8; y <= top; y += 1) {
			const hw = Math.round(((y - 8) / (top - 8)) * 25);
			ctx.fillStyle = '#0d0a1e';
			ctx.fillRect(cx - hw - 1, y, hw * 2 + 3, 1);
			ctx.fillStyle = '#6246c9';
			ctx.fillRect(cx - hw, y, hw + 1, 1);
			ctx.fillStyle = '#3d2a78';
			ctx.fillRect(cx + 1, y, hw, 1);
			if (y % 7 === 0) {
				ctx.fillStyle = '#9e84ff';
				ctx.fillRect(cx - hw + 2, y, 1, 1);
			}
		}
		ctx.fillStyle = '#251c45';
		ctx.fillRect(8, top, 53, 3);
		ctx.fillStyle = '#f2c14e';
		ctx.fillRect(cx, 5, 1, 3);
		ctx.fillRect(cx - 1, 6, 3, 1);
		// Door.
		ctx.fillStyle = '#0d0a1e';
		ctx.fillRect(27, 130, 14, 20);
		ctx.fillStyle = '#5e3d24';
		ctx.fillRect(28, 132, 12, 18);
		ctx.fillRect(29, 131, 10, 1);
		ctx.fillStyle = '#9a6b3c';
		ctx.fillRect(33, 132, 1, 18);
		ctx.fillStyle = '#f2c14e';
		ctx.fillRect(36, 141, 1, 1);
		// Window frames (the glow is animated per frame).
		this.windows = [[31, 62, 6, 9], [21, 94, 5, 8], [42, 108, 5, 8]];
		this.windows.forEach(([x, y, w, h]) => {
			ctx.fillStyle = '#0d0a1e';
			ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
		});
	}

	// Effects API -------------------------------------------------------
	burst(x, y, n, colors, speed = 40, gravity = 30, life = 0.8) {
		const count = this.reducedFx ? Math.ceil(n / 3) : n;
		for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i += 1) {
			const a = this.rng() * TAU;
			const v = speed * (0.3 + this.rng() * 0.7);
			this.particles.push({
				x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity, life: life * (0.5 + this.rng() * 0.5), max: life, color: colors[i % colors.length],
			});
		}
	}

	floater(x, y, text, color = PALETTE.C, life = 1.1) {
		if (this.floaters.length > 28) this.floaters.shift();
		const c = textCanvas(text, color);
		this.floaters.push({
			c, x: Math.round(Math.min(W - c.width - 2, Math.max(2, x - c.width / 2))), y, life, max: life,
		});
	}

	castFx(x, y, amount) {
		this.castPose = 0.14;
		this.orbFlash = 0.12;
		this.burst(ORB.x, ORB.y, 7, [PALETTE.C, PALETTE.c, PALETTE.W], 45, 10, 0.5);
		this.burst(x, y, 4, [PALETTE.Y, PALETTE.C], 30, 20, 0.4);
		this.floater(x, y - 6, `+${formatNumber(amount)}`);
	}

	autoCastFx(amount, dt) {
		this.autoFloat.amount += amount;
		this.autoFloat.t += dt;
		if (this.rng() < 0.5) this.burst(ORB.x, ORB.y, 2, [PALETTE.L, PALETTE.C], 25, 5, 0.4);
		if (this.autoFloat.t > 1) {
			this.floater(ORB.x + 14, ORB.y - 8, `+${formatNumber(this.autoFloat.amount)}`, PALETTE.L, 0.9);
			this.autoFloat = { amount: 0, t: 0 };
			this.alignPulse = 0;
		}
	}

	fireballFx(amount) {
		this.bolts.push({
			x: ORB.x, y: ORB.y, tx: 200 + this.rng() * 80, ty: 26 + this.rng() * 30, t: 0, dur: 0.55, amount,
		});
	}

	wispFx(x, y, label) {
		this.burst(x, y, 36, [PALETTE.Y, PALETTE.y, PALETTE.W], 70, 20, 1);
		this.floater(x, y - 10, label, PALETTE.Y, 1.8);
	}

	spellFx(id) {
		const colors = {
			surge: [PALETTE.Y, PALETTE.W], frenzy: [PALETTE.c, PALETTE.C], rift: [PALETTE.m, PALETTE.L], lure: [PALETTE.Y, PALETTE.y],
		}[id] || [PALETTE.W];
		for (let i = 0; i < 48; i += 1) {
			const a = (i / 48) * TAU;
			this.particles.push({
				x: ORB.x, y: ORB.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 50, g: 0, life: 0.9, max: 0.9, color: colors[i % colors.length],
			});
		}
		this.flash = { color: colors[0], t: 0.25, max: 0.25 };
		this.orbFlash = 0.4;
	}

	alignFx() {
		this.alignPulse = 1.5;
		const [bx, by, bw, bh] = CONSTELLATION_BOXES[0];
		this.burst(bx + bw / 2, by + bh / 2, 30, [PALETTE.C, PALETTE.W, PALETTE.c], 50, 0, 1.2);
	}

	riftFx() {
		this.flash = { color: '#d45ad4', t: 0.8, max: 0.8 };
		this.burst(W / 2, 60, 80, [PALETTE.m, PALETTE.L, PALETTE.W], 120, 0, 1.4);
	}

	ascendFx() {
		this.flash = { color: '#ffffff', t: 1.2, max: 1.2 };
		for (let i = 0; i < 120; i += 1) {
			this.particles.push({
				x: this.rng() * W, y: -this.rng() * 60, vx: -10 + this.rng() * 20, vy: 60 + this.rng() * 60, g: 0, life: 2.5, max: 2.5, color: [PALETTE.C, PALETTE.W, PALETTE.Y][i % 3],
			});
		}
	}

	// eslint-disable-next-line class-methods-use-this
	hitTest(state, x, y) {
		const hit = state.wisps.find((w) => {
			const p = wispPos(w);
			return Math.hypot(p.x - x, p.y - y) < 12;
		});
		return hit ? { type: 'wisp', id: hit.id, ...wispPos(hit) } : { type: 'cast' };
	}

	// Frame ---------------------------------------------------------------
	render(state, dt) {
		const { ctx } = this;
		this.time += dt;
		const t = this.time;
		ctx.save();
		if (this.shake > 0 && !this.reducedFx) {
			this.shake -= dt;
			ctx.translate(Math.round((this.rng() - 0.5) * 4), Math.round((this.rng() - 0.5) * 4));
		}
		ctx.drawImage(this.bg, 0, 0);
		this.drawStars(t);
		const prodBuff = state.buffs.some((b) => b.kind === 'prod');
		const clickBuff = state.buffs.some((b) => b.kind === 'click');
		if (prodBuff) this.drawAurora(t);
		const trial = state.mode === 'trial';
		if (trial) this.drawRiftSky(t);
		(currentAlignment(state)?.gens || []).slice(0, 2).forEach((id, i) => this.drawConstellation(t, dt, id, i));
		const g = state.gens;
		if (g.genesis) this.drawGenesis(t, g.genesis);
		if (g.dragon) this.drawDragons(t, Math.min(3, g.dragon));
		if (g.observatory) this.drawObservatory(t);
		if (g.crystal) this.drawCrystals(t, Math.min(CRYSTAL_SPOTS.length, g.crystal));
		if (g.loom) this.drawLoom(t);
		if (g.portal) this.drawPortal(t, dt, g.portal);
		this.drawWindows(t, prodBuff);
		if (g.owl) this.drawOwls(t, Math.min(7, g.owl));
		if (g.shelf) this.drawShelves(Math.min(3, g.shelf));
		const candles = Math.min(9, g.candle);
		if (candles) this.drawCandles(t, candles, true);
		this.drawWizard(t, dt, clickBuff);
		if (candles) this.drawCandles(t, candles, false);
		if (g.cauldron) this.drawCauldrons(t, Math.min(3, g.cauldron));
		this.drawWalkers(dt, 'apprentice', Math.min(12, g.apprentice));
		this.drawWalkers(dt, 'golem', Math.min(3, g.golem));
		this.drawWisps(state, t);
		this.updateBolts(dt);
		this.drawParticles(dt);
		this.drawFloaters(dt);
		ctx.restore();
		if (this.flash) {
			this.flash.t -= dt;
			if (this.flash.t <= 0) this.flash = null;
			else {
				ctx.globalAlpha = (this.flash.t / this.flash.max) * 0.45;
				ctx.fillStyle = this.flash.color;
				ctx.fillRect(0, 0, W, H);
				ctx.globalAlpha = 1;
			}
		}
	}

	drawStars(t) {
		const { ctx } = this;
		this.stars.forEach((s) => {
			const b = Math.sin(t * s.s + s.p);
			ctx.fillStyle = starColor(b);
			ctx.fillRect(s.x, s.y, 1, 1);
			if (s.big && b > 0.7) {
				ctx.fillStyle = '#6fe3f2';
				ctx.fillRect(s.x - 1, s.y, 1, 1);
				ctx.fillRect(s.x + 1, s.y, 1, 1);
				ctx.fillRect(s.x, s.y - 1, 1, 1);
				ctx.fillRect(s.x, s.y + 1, 1, 1);
			}
		});
	}

	drawConstellation(t, dt, id, slot) {
		const { ctx } = this;
		const [bx, by, bw, bh] = CONSTELLATION_BOXES[slot];
		const pts = constellation(id).map(([x, y]) => [Math.round(bx + x * bw), Math.round(by + y * bh)]);
		this.alignPulse = Math.max(0, this.alignPulse - dt);
		const bright = this.alignPulse > 0 ? '#ffffff' : '#6fe3f2';
		ctx.fillStyle = '#2f5f86';
		for (let i = 1; i < pts.length; i += 1) {
			const [x0, y0] = pts[i - 1];
			const [x1, y1] = pts[i];
			const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
			for (let k = 2; k < n - 1; k += 2) ctx.fillRect(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1);
		}
		pts.forEach(([x, y], i) => {
			const on = Math.sin(t * 3 + i * 1.7) > -0.3;
			ctx.fillStyle = on ? bright : '#9e8fd6';
			ctx.fillRect(x, y, 1, 1);
			if (on && i % 2 === 0) {
				ctx.fillRect(x - 1, y, 1, 1);
				ctx.fillRect(x + 1, y, 1, 1);
				ctx.fillRect(x, y - 1, 1, 1);
				ctx.fillRect(x, y + 1, 1, 1);
			}
		});
		const spr = spriteCanvas(id);
		ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 2);
		ctx.drawImage(spr, Math.round(bx + bw / 2 - spr.width / 2), Math.round(by + bh / 2 - spr.height / 2));
		ctx.globalAlpha = 1;
	}

	// A jagged tear across the sky plus drifting shards marks trial mode.
	drawRiftSky(t) {
		const { ctx } = this;
		ctx.globalAlpha = 0.12;
		ctx.fillStyle = '#d45ad4';
		ctx.fillRect(0, 0, W, GROUND);
		ctx.globalAlpha = 1;
		let y = 20;
		for (let x = 0; x < W; x += 1) {
			y += Math.sin(x * 0.37 + 1.3) * 1.6 + Math.sin(x * 0.11) * 0.7;
			const w = 1 + Math.round((Math.sin(x * 0.07 + t * 2) + 1) * 0.8);
			ctx.fillStyle = '#d45ad4';
			ctx.fillRect(x, Math.round(y) - w, 1, w * 2 + 1);
			ctx.fillStyle = Math.sin(x * 0.5 + t * 6) > 0.6 ? '#ffffff' : '#ffb0ff';
			ctx.fillRect(x, Math.round(y), 1, 1);
		}
		if (this.rng() < 0.25 && this.particles.length < MAX_PARTICLES) {
			this.particles.push({
				x: this.rng() * W, y: 20 + this.rng() * 20, vx: (this.rng() - 0.5) * 8, vy: 10 + this.rng() * 10, g: 0, life: 2, max: 2, color: this.rng() < 0.5 ? '#d45ad4' : '#9e84ff',
			});
		}
	}

	drawAurora(t) {
		const { ctx } = this;
		const cols = ['#2f7a45', '#74d06b', '#45d0e8'];
		for (let band = 0; band < 3; band += 1) {
			ctx.fillStyle = cols[band];
			// Every other column only, so the curtain reads as translucent.
			for (let x = (band % 2); x < W; x += 2) {
				const y = Math.round(34 + band * 7 + Math.sin(x * 0.045 + t * 1.3 + band) * 8 + Math.sin(x * 0.11 - t) * 3);
				ctx.fillRect(x, y, 1, 3 + (Math.floor(x / 8) % 3));
			}
		}
	}

	drawGenesis(t) {
		const { ctx } = this;
		const spr = spriteCanvas('genesis');
		const x = 160 - spr.width;
		const y = 8 + Math.round(Math.sin(t * 0.7) * 2);
		const pulse = (Math.sin(t * 2) + 1) / 2;
		ctx.fillStyle = pulse > 0.5 ? '#f2c14e' : '#8a6a2a';
		for (let a = 0; a < TAU; a += 0.12) ctx.fillRect(Math.round(160 + Math.cos(a) * 17), Math.round(y + 11 + Math.sin(a) * 17), 1, 1);
		ctx.drawImage(spr, x, y, spr.width * 2, spr.height * 2);
	}

	drawDragons(t, n) {
		const { ctx } = this;
		for (let i = 0; i < n; i += 1) {
			const period = 26 + i * 5;
			const phase = ((t + i * 9) % period) / period;
			const x = Math.round(-30 + phase * 390);
			const y = Math.round(58 + i * 14 + Math.sin(t * 1.4 + i) * 5);
			ctx.drawImage(spriteCanvas('dragon', Math.floor(t * 4 + i) % 2), x, y);
			if (Math.floor(t * 10 + i * 3) % 23 === 0 && this.particles.length < MAX_PARTICLES) {
				this.particles.push({
					x: x + 20, y: y + 6, vx: 50, vy: 4, g: 0, life: 0.4, max: 0.4, color: PALETTE.o,
				});
			}
		}
	}

	drawObservatory(t) {
		const { ctx } = this;
		ctx.drawImage(spriteCanvas('observatory'), 256, 116);
		if (Math.floor(t * 2) % 4 === 0) {
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(270, 114, 1, 1);
		}
	}

	drawCrystals(t, n) {
		const { ctx } = this;
		const spr = spriteCanvas('crystal');
		for (let i = 0; i < n; i += 1) {
			const x = CRYSTAL_SPOTS[i];
			const base = Math.round(nearHill(x + 3));
			ctx.drawImage(spr, x, base - spr.height + 2);
			if (Math.sin(t * 3 + i * 2) > 0.8) {
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(x + 2, base - spr.height + 5, 1, 1);
			}
		}
	}

	drawLoom(t) {
		const { ctx } = this;
		const x = 206;
		const y = 52 + Math.round(Math.sin(t * 1.1) * 3);
		ctx.drawImage(spriteCanvas('loom'), x, y);
		ctx.fillStyle = '#fff08a';
		ctx.fillRect(x + 4 + (Math.floor(t * 8) % 2), y + 5 + (Math.floor(t * 6) % 3), 1, 1);
	}

	drawPortal(t, dt, n) {
		const { ctx } = this;
		const cx = 298;
		const cy = 96;
		const scale = Math.min(1.3, 0.8 + n * 0.02);
		for (let yy = -12; yy <= 12; yy += 1) {
			const hw = Math.round(Math.sqrt(Math.max(0, 1 - (yy * yy) / 144)) * 6 * scale);
			ctx.fillStyle = '#0d0a1e';
			ctx.fillRect(cx - hw, Math.round(cy + yy * scale), hw * 2, 1);
		}
		for (let i = 0; i < 44; i += 1) {
			const a = (i / 44) * TAU + t * 2;
			ctx.fillStyle = i % 3 ? '#d45ad4' : '#9e84ff';
			ctx.fillRect(Math.round(cx + Math.cos(a) * 8 * scale), Math.round(cy + Math.sin(a) * 15 * scale), 1, 1);
			if (i % 2 === 0) {
				const b = -a * 1.3;
				ctx.fillStyle = '#6246c9';
				ctx.fillRect(Math.round(cx + Math.cos(b) * 5 * scale), Math.round(cy + Math.sin(b) * 10 * scale), 1, 1);
			}
		}
		if (this.rng() < dt * 12 && this.particles.length < MAX_PARTICLES) {
			const a = this.rng() * TAU;
			this.particles.push({
				x: cx + Math.cos(a) * 26, y: cy + Math.sin(a) * 26, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 30, g: 0, life: 0.8, max: 0.8, color: '#d45ad4',
			});
		}
	}

	drawWindows(t, bright) {
		const { ctx } = this;
		this.windows.forEach(([x, y, w, h], i) => {
			const flick = Math.sin(t * 7 + i * 3) + Math.sin(t * 13 + i);
			ctx.fillStyle = bright || flick > 0.8 ? '#fff08a' : '#f2c14e';
			ctx.fillRect(x, y, w, h);
			ctx.fillStyle = '#e0843a';
			ctx.fillRect(x, y + h - 2, w, 2);
			ctx.fillStyle = '#0d0a1e';
			ctx.fillRect(x + Math.floor(w / 2), y, 1, h);
		});
	}

	drawOwls(t, n) {
		const { ctx } = this;
		for (let i = 0; i < n; i += 1) {
			const a = t * (0.55 + i * 0.05) + (i * TAU) / n;
			const r = 24 + (i % 3) * 7;
			const x = Math.round(34 + Math.cos(a) * r - 4);
			const y = Math.round(40 + Math.sin(a) * 9 - (i % 2) * 8);
			ctx.drawImage(spriteCanvas('owl', Math.floor(t * 6 + i) % 2, { flip: Math.sin(a) > 0 }), x, y);
		}
	}

	drawShelves(n) {
		for (let i = 0; i < n; i += 1) this.ctx.drawImage(spriteCanvas('shelf'), 60 + i * 14, GROUND - 14);
	}

	drawCandles(t, n, back) {
		const { ctx } = this;
		for (let i = 0; i < n; i += 1) {
			const a = (i / n) * TAU + Math.PI / 2;
			const y = Math.round(GROUND + 3 + Math.sin(a) * 4);
			if ((y < GROUND + 3) === back) {
				const x = Math.round(146 + Math.cos(a) * 30);
				ctx.drawImage(spriteCanvas('candle', Math.floor(t * 5 + i * 1.7) % 2), x, y - 10);
			}
		}
	}

	drawWizard(t, dt, charged) {
		const { ctx } = this;
		this.castPose = Math.max(0, this.castPose - dt);
		this.orbFlash = Math.max(0, this.orbFlash - dt);
		const bob = Math.sin(t * 2.2) > 0.3 ? 1 : 0;
		const lift = this.castPose > 0 ? 3 : 0;
		const wx = 140;
		const wy = GROUND - 22 + bob;
		ctx.drawImage(spriteCanvas('wizard'), wx, wy);
		// Staff.
		const top = ORB.y + 3 - lift;
		ctx.fillStyle = '#0d0a1e';
		ctx.fillRect(ORB.x - 1, top, 3, GROUND - top);
		ctx.fillStyle = '#9a6b3c';
		ctx.fillRect(ORB.x, top, 1, GROUND - top - 1);
		// Orb with halo.
		const oy = ORB.y - lift;
		const r = 2 + (this.orbFlash > 0 ? 1 : 0) + (charged ? 1 : 0);
		const glow = r + 3 + Math.round((Math.sin(t * 4) + 1) * 0.8);
		ctx.fillStyle = charged ? '#45d0e8' : '#3a2a6a';
		for (let yy = -glow; yy <= glow; yy += 1) {
			for (let xx = -glow; xx <= glow; xx += 1) {
				if ((xx + yy) % 2 === 0 && xx * xx + yy * yy <= glow * glow) ctx.fillRect(ORB.x + xx, oy + yy, 1, 1);
			}
		}
		for (let yy = -r; yy <= r; yy += 1) {
			for (let xx = -r; xx <= r; xx += 1) {
				const d = xx * xx + yy * yy;
				if (d <= r * r) {
					ctx.fillStyle = this.orbFlash > 0 || d <= 1 ? '#ffffff' : '#45d0e8';
					ctx.fillRect(ORB.x + xx, oy + yy, 1, 1);
				}
			}
		}
	}

	drawCauldrons(t, n) {
		const { ctx } = this;
		for (let i = 0; i < n; i += 1) {
			const x = 188 + i * 16;
			ctx.drawImage(spriteCanvas('cauldron', Math.floor(t * 3 + i) % 2), x, GROUND - 9);
			if (this.rng() < 0.04 && this.particles.length < MAX_PARTICLES) {
				this.particles.push({
					x: x + 3 + this.rng() * 6, y: GROUND - 10, vx: 0, vy: -14, g: 0, life: 0.9, max: 0.9, color: '#74d06b',
				});
			}
		}
	}

	drawWalkers(dt, kind, n) {
		const list = this.walkers[kind];
		const golem = kind === 'golem';
		while (list.length < n) {
			list.push({
				x: 70 + this.rng() * 230, dir: this.rng() < 0.5 ? -1 : 1, speed: golem ? 5 + this.rng() * 3 : 9 + this.rng() * 8, y: golem ? 176 : 160 + Math.floor(this.rng() * 11), t: this.rng(),
			});
			list.sort((a, b) => a.y - b.y);
		}
		if (list.length > n) list.length = n;
		list.forEach((w) => {
			w.x += w.dir * w.speed * dt;
			w.t += dt;
			if (w.x < 66) w.dir = 1;
			if (w.x > 304) w.dir = -1;
			const spr = spriteCanvas(kind, Math.floor(w.t * (golem ? 2 : 6)) % 2, { flip: w.dir < 0 });
			this.ctx.drawImage(spr, Math.round(w.x), w.y - spr.height);
		});
	}

	drawWisps(state, t) {
		const { ctx } = this;
		state.wisps.forEach((w) => {
			if (w.life - w.age < 3 && Math.floor(t * 8) % 2) return;
			const { x, y } = wispPos(w);
			const px = Math.round(x);
			const py = Math.round(y);
			ctx.fillStyle = '#f2c14e';
			for (let yy = -7; yy <= 7; yy += 1) {
				for (let xx = -7; xx <= 7; xx += 1) {
					const d = xx * xx + yy * yy;
					if (d > 20 && d <= 49 && (xx + yy + Math.floor(t * 6)) % 3 === 0) ctx.fillRect(px + xx, py + yy, 1, 1);
				}
			}
			ctx.drawImage(spriteCanvas('wisp'), px - 3, py - 3);
			if (this.rng() < 0.3 && this.particles.length < MAX_PARTICLES) {
				this.particles.push({
					x: px - w.dir * 4, y: py, vx: -w.dir * 8, vy: 6, g: 0, life: 0.6, max: 0.6, color: '#fff08a',
				});
			}
		});
	}

	updateBolts(dt) {
		const { ctx } = this;
		this.bolts = this.bolts.filter((b) => {
			b.t += dt;
			const p = Math.min(1, b.t / b.dur);
			const x = b.x + (b.tx - b.x) * p;
			const y = b.y + (b.ty - b.y) * p - Math.sin(p * Math.PI) * 30;
			if (p >= 1) {
				this.burst(b.tx, b.ty, 70, [PALETTE.R, PALETTE.o, PALETTE.Y, PALETTE.W], 90, 40, 1.2);
				this.floater(b.tx, b.ty - 12, `FIREBALL +${formatNumber(b.amount)}`, PALETTE.Y, 2);
				this.shake = 0.35;
				this.flash = { color: '#ff7a4d', t: 0.3, max: 0.3 };
				return false;
			}
			ctx.drawImage(spriteCanvas('flame'), Math.round(x) - 3, Math.round(y) - 4);
			this.particles.push({
				x, y, vx: (this.rng() - 0.5) * 20, vy: 10, g: 0, life: 0.4, max: 0.4, color: this.rng() < 0.5 ? PALETTE.o : PALETTE.R,
			});
			return true;
		});
	}

	drawParticles(dt) {
		const { ctx } = this;
		this.particles = this.particles.filter((p) => {
			p.life -= dt;
			if (p.life <= 0) return false;
			p.vy += p.g * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			ctx.fillStyle = p.color;
			ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
			return true;
		});
	}

	drawFloaters(dt) {
		const { ctx } = this;
		this.floaters = this.floaters.filter((f) => {
			f.life -= dt;
			if (f.life <= 0) return false;
			f.y -= 14 * dt;
			ctx.globalAlpha = Math.min(1, f.life / (f.max * 0.35));
			ctx.drawImage(f.c, f.x, Math.round(f.y));
			ctx.globalAlpha = 1;
			return true;
		});
	}
}
