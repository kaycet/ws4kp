import * as E from './engine.mjs';
import * as R from './rift.mjs';
import { Scene, W, H } from './scene.mjs';
import UI, { toast } from './ui.mjs';
import Sfx from './audio.mjs';
import {
	ACHIEVEMENT_BY_ID, SPELL_BY_ID, TALENT_BY_ID, RELIC_BY_ID, GEN_BY_ID,
} from './data.mjs';
import { spriteCanvas } from './sprites.mjs';
import { formatNumber } from './format.mjs';

const MAIN_KEY = 'starfall-spire-save-v1';
const TRIAL_KEY = 'starfall-spire-rift-v1';
const AUTOSAVE_MS = 15000;
const MAX_MANUAL_CPS = 20;
const ORB_TARGET = { x: 156, y: 108 };

// Storage can be missing or throw (private mode, sandboxed frames), so every
// access is guarded and the game simply runs without persistence.
const storage = {
	get(key) { try { return localStorage.getItem(key); } catch { return null; } },
	set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
	remove(key) { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } },
};

const tryDecode = (text) => {
	if (!text) return null;
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

// Advance a state by dt seconds of wall-clock time ending at wallMs, in
// bounded chunks so long gaps (hidden tabs) stay accurate but cheap.
const advance = (state, dt, wallMs) => {
	if (!(dt > 0)) return;
	const steps = dt > 1 ? Math.min(600, Math.ceil(dt)) : 1;
	const chunk = dt / steps;
	for (let i = 0; i < steps; i += 1) {
		E.tick(state, chunk, wallMs - (dt - chunk * (i + 1)) * 1000);
	}
};

const start = (hotData = {}) => {
	let main = tryDecode(hotData?.save);
	const fromHot = !!main;
	let restored = false;
	if (!main) {
		main = tryDecode(storage.get(MAIN_KEY));
		restored = !!main;
	}
	if (!main) main = E.createState();
	let trial = tryDecode(hotData?.trial ?? storage.get(TRIAL_KEY));
	if (trial && !E.isTrial(trial)) trial = null;

	const canvas = document.getElementById('scene');
	const game = {
		main,
		trial,
		sfx: new Sfx(),
		scene: new Scene(canvas),
		rivalCache: new Map(),
		get state() { return this.trial || this.main; },
	};
	game.sfx.enabled = main.settings.sound;
	game.scene.reducedFx = main.settings.reducedFx;
	canvas.style.cursor = wandCursor();

	game.save = () => {
		const now = Date.now();
		game.main.lastSave = now;
		const ok = storage.set(MAIN_KEY, E.encodeSave(game.main));
		if (game.trial) {
			game.trial.lastSave = now;
			storage.set(TRIAL_KEY, E.encodeSave(game.trial));
		} else {
			storage.remove(TRIAL_KEY);
		}
		return ok;
	};

	// Rival echoes are deterministic per rift, so they are computed once
	// (about 0.1s) and cached for the session.
	game.rivals = (t) => {
		if (!game.rivalCache.has(t.id)) {
			const rivals = R.rivalsFor(t);
			game.rivalCache.set(t.id, { rivals, thresholds: R.tierThresholds(rivals) });
		}
		return game.rivalCache.get(t.id);
	};
	game.leaderboard = new R.LocalLeaderboard((t) => game.rivals(t).rivals);
	game.currentRift = () => R.trialForTime(Date.now());

	let ui = null;
	const resetScene = () => { game.scene.walkers = { apprentice: [], golem: [] }; };

	game.replaceState = (next) => {
		game.main = next;
		game.trial = null;
		game.sfx.enabled = next.settings.sound;
		game.scene.reducedFx = next.settings.reducedFx;
		resetScene();
		E.drainEvents(next);
		ui.rebind();
		game.save();
	};

	game.castSpell = (id) => {
		game.sfx.ensure();
		E.castSpell(game.state, id);
	};

	game.ascend = () => {
		if (E.ascend(game.main)) {
			resetScene();
			game.save();
			ui.showTab('starfall');
		}
	};

	game.enterRift = () => {
		game.sfx.ensure();
		if (!game.trial) {
			const rift = game.currentRift();
			game.rivals(rift);
			game.trial = R.createTrialState(rift, Date.now(), game.main.settings);
		}
		resetScene();
		game.scene.riftFx();
		ui.rebind();
		ui.showTab('summons');
		game.save();
	};

	game.endRift = () => {
		const t = game.trial;
		if (!t) return;
		const { thresholds } = game.rivals(t.trial);
		const result = R.finishTrial(game.main, t, thresholds);
		const name = game.main.settings.wizardName || 'You';
		game.leaderboard.submit(t.trial.id, { name, score: result.score });
		game.trial = null;
		resetScene();
		E.drainEvents(t);
		game.save();
		ui.rebind();
		game.leaderboard.standings(t.trial, { name, score: result.score }).then((standings) => {
			ui.showTrialResult(t.trial, result, standings, thresholds);
		});
	};

	ui = new UI(game);
	window.claude?.hot?.snapshot?.(() => ({
		save: E.encodeSave(game.main),
		trial: game.trial ? E.encodeSave(game.trial) : null,
	}));

	const now = Date.now();
	if (restored) {
		const report = E.applyOffline(game.main, now);
		if (report && report.amount > 0) ui.showOffline(report);
	} else if (fromHot) {
		game.main.lastSave = now;
	}
	if (game.trial) {
		// The rift clock kept running while the page was closed.
		const until = Math.min(now, game.trial.trial.endsAt);
		advance(game.trial, Math.max(0, (until - game.trial.lastSave) / 1000), until);
		E.drainEvents(game.trial);
		if (now >= game.trial.trial.endsAt) game.endRift();
		else ui.rebind();
	}

	// Events -> effects ----------------------------------------------------
	const handleEvents = (state, dt, visible, foreground) => {
		const { scene, sfx } = game;
		const fmt = (n) => formatNumber(n, game.state.settings.notation);
		E.drainEvents(state).forEach((ev) => {
			if (!foreground && ev.type !== 'achievement') return;
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
					if (ev.amount) toast('loom', SPELL_BY_ID[ev.id].name, `+${fmt(ev.amount)} mana`, 'mana');
					break;
				case 'align':
					if (visible) scene.alignFx();
					sfx.tone(988, 0.3, { type: 'sine', vol: 0.3, slide: 1480 });
					toast(ev.gens[0], 'The stars align:', `${ev.gens.map((id) => GEN_BY_ID[id].name).join(' & ')} ×${formatNumber(ev.mult)}`, 'mana');
					break;
				case 'achievement':
					sfx.achievement();
					toast('trophy', 'Feat:', ACHIEVEMENT_BY_ID[ev.id].name);
					break;
				case 'ascend':
					scene.ascendFx();
					sfx.ascend();
					toast('sigil', 'Ascended!', `+${formatNumber(ev.gained)} Starsigils`, 'mana');
					break;
				case 'talent':
					toast(TALENT_BY_ID[ev.id].icon, TALENT_BY_ID[ev.id].name, `rank ${ev.level}`, 'mana');
					break;
				case 'relic':
					sfx.upgrade();
					toast(RELIC_BY_ID[ev.id].icon, 'Relic claimed:', RELIC_BY_ID[ev.id].name, 'rift');
					break;
				default:
			}
		});
	};

	// Input ------------------------------------------------------------------
	const recentCasts = [];
	const manualCast = (x, y) => {
		const t = performance.now();
		while (recentCasts.length && t - recentCasts[0] > 1000) recentCasts.shift();
		if (recentCasts.length >= MAX_MANUAL_CPS) return;
		recentCasts.push(t);
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
	// Both saves advance by wall-clock time: the main spire keeps working while
	// you run a trial, and the trial clock is capped at its end time.
	let last = performance.now();
	const step = () => {
		const t = performance.now();
		const dt = (t - last) / 1000;
		last = t;
		if (!(dt > 0)) return 0;
		const wall = Date.now();
		advance(game.main, dt, wall);
		if (game.trial) {
			const { endsAt } = game.trial.trial;
			const until = Math.min(wall, endsAt);
			advance(game.trial, Math.min(dt, Math.max(0, (until - (wall - dt * 1000)) / 1000)), until);
			if (wall >= endsAt) game.endRift();
		}
		return dt;
	};

	let uiAcc = 0;
	const frame = () => {
		const dt = step();
		if (game.trial) handleEvents(game.main, dt, false, false);
		handleEvents(game.state, dt, true, true);
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
		if (game.trial) handleEvents(game.main, 0, false, false);
		handleEvents(game.state, 0, false, true);
	}, 1000);

	setInterval(() => game.save(), AUTOSAVE_MS);
	document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
	window.addEventListener('pagehide', () => game.save());
};

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
