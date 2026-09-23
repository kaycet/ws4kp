import * as E from './engine.mjs';
import { Scene, W, H } from './scene.mjs';
import UI, { toast } from './ui.mjs';
import Sfx from './audio.mjs';
import { ACHIEVEMENT_BY_ID, SPELL_BY_ID, TALENT_BY_ID } from './data.mjs';
import { spriteCanvas } from './sprites.mjs';
import { formatNumber } from './format.mjs';

const SAVE_KEY = 'starfall-spire-save-v1';
const AUTOSAVE_MS = 15000;
const MAX_MANUAL_CPS = 20;
const ORB_TARGET = { x: 156, y: 108 };

// Storage can be missing or throw (private mode, sandboxed frames), so every
// access is guarded and the game simply runs without persistence.
const storage = {
	get() { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } },
	set(value) { try { localStorage.setItem(SAVE_KEY, value); return true; } catch { return false; } },
};

const tryDecode = (text) => {
	try { return E.decodeSave(text); } catch { return null; }
};

const wandCursor = () => {
	const c = document.createElement('canvas');
	c.width = 20;
	c.height = 20;
	const ctx = c.getContext('2d');
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(spriteCanvas('wand'), 0, 0, 20, 20);
	return `url(${c.toDataURL()}) 17 1, pointer`;
};

const start = (hotData = {}) => {
	let state = hotData?.save ? tryDecode(hotData.save) : null;
	const fromHot = !!state;
	let restored = false;
	if (!state) {
		const raw = storage.get();
		state = raw ? tryDecode(raw) : null;
		restored = !!state;
	}
	if (!state) state = E.createState();

	const canvas = document.getElementById('scene');
	const game = {
		state,
		sfx: new Sfx(),
		scene: new Scene(canvas),
	};
	game.sfx.enabled = state.settings.sound;
	game.scene.reducedFx = state.settings.reducedFx;
	canvas.style.cursor = wandCursor();

	game.save = () => {
		game.state.lastSave = Date.now();
		return storage.set(E.encodeSave(game.state));
	};

	let ui = null;
	game.replaceState = (next) => {
		game.state = next;
		game.sfx.enabled = next.settings.sound;
		game.scene.reducedFx = next.settings.reducedFx;
		game.scene.walkers = { apprentice: [], golem: [] };
		E.drainEvents(next);
		ui.rebind();
		game.save();
	};

	game.castSpell = (id) => {
		game.sfx.ensure();
		E.castSpell(game.state, id);
	};

	game.ascend = () => {
		if (E.ascend(game.state)) {
			game.scene.walkers = { apprentice: [], golem: [] };
			game.save();
			ui.showTab('starfall');
		}
	};

	ui = new UI(game);
	window.claude?.hot?.snapshot?.(() => ({ save: E.encodeSave(game.state) }));

	if (restored) {
		const report = E.applyOffline(game.state, Date.now());
		if (report && report.amount > 0) ui.showOffline(report);
	} else if (fromHot) {
		game.state.lastSave = Date.now();
	}

	// Events -> effects ----------------------------------------------------
	const handleEvents = (dt, visible) => {
		E.drainEvents(game.state).forEach((ev) => {
			const { scene, sfx } = game;
			switch (ev.type) {
				case 'fireball':
					if (visible) scene.fireballFx(ev.amount);
					sfx.fireball();
					break;
				case 'autoCast':
					if (visible) scene.autoCastFx(ev.amount, dt);
					break;
				case 'wispSpawn':
					sfx.tone(1568, 0.12, { type: 'triangle', vol: 0.25 });
					break;
				case 'wisp':
					sfx.wisp();
					ui.wispToast(ev);
					break;
				case 'spell':
					if (visible) scene.spellFx(ev.id);
					sfx.spell();
					if (ev.amount) toast('loom', SPELL_BY_ID[ev.id].name, `+${formatNumber(ev.amount, game.state.settings.notation)} mana`, 'mana');
					break;
				case 'achievement': {
					const a = ACHIEVEMENT_BY_ID[ev.id];
					sfx.achievement();
					toast('trophy', 'Feat:', a.name);
					break;
				}
				case 'ascend':
					scene.ascendFx();
					sfx.ascend();
					toast('sigil', 'Ascended!', `+${formatNumber(ev.gained)} Starsigils`, 'mana');
					break;
				case 'talent':
					toast(TALENT_BY_ID[ev.id].icon, TALENT_BY_ID[ev.id].name, `rank ${ev.level}`, 'mana');
					break;
				default:
			}
		});
	};

	// Input ------------------------------------------------------------------
	const recentCasts = [];
	const manualCast = (x, y) => {
		const now = performance.now();
		while (recentCasts.length && now - recentCasts[0] > 1000) recentCasts.shift();
		if (recentCasts.length >= MAX_MANUAL_CPS) return;
		recentCasts.push(now);
		const { amount } = E.cast(game.state);
		game.scene.castFx(x, y, amount);
		game.sfx.cast();
	};

	canvas.addEventListener('pointerdown', (e) => {
		e.preventDefault();
		game.sfx.ensure();
		const rect = canvas.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * W;
		const y = ((e.clientY - rect.top) / rect.height) * H;
		const hit = game.scene.hitTest(game.state, x, y);
		if (hit.type === 'wisp') {
			const res = E.catchWisp(game.state, hit.id);
			if (res) {
				const label = res.effect === 'windfall' ? `+${formatNumber(res.amount)}` : res.name;
				game.scene.wispFx(hit.x, hit.y, label);
			}
		} else {
			manualCast(x, y);
		}
	});

	canvas.addEventListener('keydown', (e) => {
		if (e.code === 'Space' || e.code === 'Enter') {
			e.preventDefault();
			if (!e.repeat) manualCast(ORB_TARGET.x + (Math.random() - 0.5) * 30, ORB_TARGET.y - Math.random() * 20);
		}
	});

	document.addEventListener('keydown', (e) => {
		if (e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
		const spell = Object.values(SPELL_BY_ID).find((sp) => sp.key === e.key);
		if (spell) game.castSpell(spell.id);
		if (e.key === 'Escape') document.getElementById('modal').hidden = true;
	});

	// Loop ---------------------------------------------------------------------
	// Simulation advances by wall-clock time, so throttled or hidden tabs catch
	// up in bounded chunks instead of drifting.
	let last = performance.now();
	const step = () => {
		const now = performance.now();
		const dt = (now - last) / 1000;
		last = now;
		if (!(dt > 0)) return 0;
		if (dt > 1) {
			const n = Math.min(600, Math.ceil(dt));
			for (let i = 0; i < n; i += 1) E.tick(game.state, dt / n);
		} else {
			E.tick(game.state, dt);
		}
		return dt;
	};

	let uiAcc = 0;
	const frame = () => {
		const dt = step();
		handleEvents(dt, true);
		game.scene.render(game.state, Math.min(dt, 0.1));
		uiAcc += dt;
		if (uiAcc >= 0.1) {
			ui.update(uiAcc);
			uiAcc = 0;
		}
		requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);

	setInterval(() => {
		if (!document.hidden) return;
		step();
		handleEvents(0, false);
	}, 1000);

	setInterval(() => game.save(), AUTOSAVE_MS);
	document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
	window.addEventListener('pagehide', () => game.save());
};

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
