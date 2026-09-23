// Pure game logic: no DOM access, so it runs identically in the browser and
// under `node --test`. Fields prefixed with `_` are transient and never saved;
// serialize() relies on that prefix, hence the rule exemption below.
/* eslint-disable no-underscore-dangle */
import {
	GENERATORS, UPGRADES, SPELLS, TALENTS, ACHIEVEMENTS, WISP_EFFECTS,
	GEN_BY_ID, UPGRADE_BY_ID, SPELL_BY_ID, TALENT_BY_ID, ACHIEVEMENT_BY_ID,
} from './data.mjs';

export const SAVE_VERSION = 1;
export const COST_GROWTH = 1.15;
export const SIGIL_DIVISOR = 1e9;
export const SIGIL_BASE_BONUS = 0.02;
export const FOCUS_PER_CAST = 0.04;
export const WISP_LIFE = 13;
const FOCUS_IDLE_GRACE = 1.5;
const FOCUS_DRAIN = 0.08;

const rand = () => Math.random();

export const createState = (now = Date.now()) => ({
	version: SAVE_VERSION,
	mana: 0,
	runEarned: 0,
	lifetimeEarned: 0,
	gens: Object.fromEntries(GENERATORS.map((g) => [g.id, 0])),
	upgrades: {},
	buffs: [],
	spells: Object.fromEntries(SPELLS.map((s) => [s.id, 0])),
	focus: 0,
	wisps: [],
	wispTimer: 75,
	nextWispId: 1,
	sigils: 0,
	sigilsSpent: 0,
	talents: {},
	achievements: {},
	autoClickAcc: 0,
	stats: {
		clicks: 0,
		autoCasts: 0,
		clickMana: 0,
		wispsCaught: 0,
		spellsCast: 0,
		fireballs: 0,
		ascensions: 0,
		upgradesBought: 0,
		bestMps: 0,
		runStart: now,
		gameStart: now,
	},
	settings: {
		notation: 'short',
		sound: true,
		buyAmount: 1,
		autoBuy: false,
		reducedFx: false,
	},
	lastSave: now,
});

// Events ----------------------------------------------------------------
export const emit = (state, event) => {
	if (!state._events) state._events = [];
	state._events.push(event);
};
export const drainEvents = (state) => {
	const events = state._events || [];
	state._events = [];
	return events;
};

export const invalidate = (state) => { state._dirty = true; };
export const talentLevel = (state, id) => state.talents[id] || 0;
export const totalGens = (state) => GENERATORS.reduce((sum, g) => sum + state.gens[g.id], 0);

// Conditions ------------------------------------------------------------
export const meets = (state, cond) => {
	if (Array.isArray(cond)) return cond.every((c) => meets(state, c));
	switch (cond.type) {
		case 'owned': return state.gens[cond.gen] >= cond.n;
		case 'earned': return state.runEarned >= cond.n;
		case 'lifetime': return state.lifetimeEarned >= cond.n;
		case 'clicks': return state.stats.clicks >= cond.n;
		case 'wisps': return state.stats.wispsCaught >= cond.n;
		case 'spells': return state.stats.spellsCast >= cond.n;
		case 'fireballs': return state.stats.fireballs >= cond.n;
		case 'ascensions': return state.stats.ascensions >= cond.n;
		case 'upgrades': return state.stats.upgradesBought >= cond.n;
		case 'totalGens': return totalGens(state) >= cond.n;

		case 'mps': return baseMps(state) >= cond.n;
		case 'any': return cond.of.some((c) => meets(state, c));
		default: return false;
	}
};

// Rates -----------------------------------------------------------------
// All multipliers are folded once and cached until something invalidates them
// (a purchase, talent, or feat); buffs are applied on read since they tick.
export const computeRates = (state) => {
	if (state._cache && !state._dirty) return state._cache;
	const T = (id) => talentLevel(state, id);
	const genMult = Object.fromEntries(GENERATORS.map((g) => [g.id, 1]));
	const synergies = [];
	const m = {
		global: 1, click: 1, clickPct: 0, spellCd: 1, spellDur: 1, wispFreq: 1, wispDur: 1, focus: 1, fireball: 1,
	};
	Object.keys(state.upgrades).forEach((id) => {
		const u = UPGRADE_BY_ID[id];
		if (!u) return;
		u.effects.forEach((e) => {
			switch (e.type) {
				case 'gen': genMult[e.gen] *= e.mult; break;
				case 'synergy': synergies.push(e); break;
				case 'clickPct': m.clickPct += e.pct; break;
				default: m[e.type] *= e.mult;
			}
		});
	});
	synergies.forEach((e) => { genMult[e.gen] *= 1 + e.pct * state.gens[e.source]; });

	const achMult = 1 + 0.01 * Object.keys(state.achievements).length;
	const sigilMult = 1 + state.sigils * (SIGIL_BASE_BONUS + 0.005 * T('resonance'));
	const talentMult = 1 + 0.1 * T('well');
	const globalMult = m.global * achMult * sigilMult * talentMult;

	const perGen = {};
	let mps = 0;
	GENERATORS.forEach((g) => {
		perGen[g.id] = g.baseRate * genMult[g.id] * globalMult;
		mps += perGen[g.id] * state.gens[g.id];
	});

	state._cache = {
		perGen,
		baseMps: mps,
		globalMult,
		achMult,
		sigilMult,
		upgradeGlobal: m.global,
		clickMult: m.click * (1 + 0.5 * T('hands')),
		clickPct: m.clickPct,
		cdMult: m.spellCd * (1 - 0.08 * T('chrono')),
		durMult: m.spellDur * (1 + 0.15 * T('linger')),
		wispFreq: m.wispFreq * (1 + 0.12 * T('lure')),
		wispDur: m.wispDur * (1 + 0.15 * T('linger')),
		wispReward: 1 + 0.25 * T('fortune'),
		focusGain: m.focus * (1 + 0.2 * T('focus')),
		fireMult: m.fireball * (1 + 0.5 * T('focus')),
		costMult: 0.97 ** T('thrift'),
	};
	state._dirty = false;
	return state._cache;
};

export const baseMps = (state) => computeRates(state).baseMps;
export const buffMult = (state, kind) => state.buffs.reduce((acc, b) => (b.kind === kind ? acc * b.mult : acc), 1);
export const manaPerSecond = (state) => baseMps(state) * buffMult(state, 'prod');
export const clickPower = (state) => {
	const r = computeRates(state);
	return (r.clickMult + manaPerSecond(state) * r.clickPct) * buffMult(state, 'click');
};
// Fireballs scale off unbuffed values so they cannot multiply cast buffs.
export const fireballPower = (state) => {
	const r = computeRates(state);
	const baseClick = r.clickMult + r.baseMps * r.clickPct;
	return Math.max(r.baseMps * 30, baseClick * 20) * r.fireMult;
};

export const gain = (state, amount) => {
	if (!(amount > 0)) return;
	state.mana += amount;
	state.runEarned += amount;
	state.lifetimeEarned += amount;
};

// Summons ---------------------------------------------------------------
export const genCost = (state, id, amount = 1) => {
	const g = GEN_BY_ID[id];
	const first = g.baseCost * COST_GROWTH ** state.gens[id] * computeRates(state).costMult;
	return first * ((COST_GROWTH ** amount - 1) / (COST_GROWTH - 1));
};

export const maxAffordable = (state, id) => {
	const first = genCost(state, id, 1);
	if (state.mana < first) return 0;
	let n = Math.floor(Math.log((state.mana * (COST_GROWTH - 1)) / first + 1) / Math.log(COST_GROWTH));
	while (n > 0 && genCost(state, id, n) > state.mana) n -= 1;
	return n;
};

export const genVisible = (state, index) => index === 0 || state.gens[GENERATORS[index].id] > 0 || state.gens[GENERATORS[index - 1].id] > 0;

export const buyGen = (state, id, amount = 1) => {
	const n = amount === 'max' ? maxAffordable(state, id) : amount;
	if (!(n > 0)) return 0;
	const cost = genCost(state, id, n);
	if (cost > state.mana) return 0;
	state.mana -= cost;
	state.gens[id] += n;
	invalidate(state);
	emit(state, { type: 'buyGen', id, n });
	return n;
};

// Upgrades --------------------------------------------------------------
export const availableUpgrades = (state) => UPGRADES.filter((u) => !state.upgrades[u.id] && meets(state, u.unlock));

export const buyUpgrade = (state, id) => {
	const u = UPGRADE_BY_ID[id];
	if (!u || state.upgrades[id] || !meets(state, u.unlock) || state.mana < u.cost) return false;
	state.mana -= u.cost;
	state.upgrades[id] = true;
	state.stats.upgradesBought += 1;
	invalidate(state);
	emit(state, { type: 'buyUpgrade', id });
	return true;
};

export const buyAllUpgrades = (state) => {
	let bought = 0;
	availableUpgrades(state)
		.sort((a, b) => a.cost - b.cost)
		.forEach((u) => { if (buyUpgrade(state, u.id)) bought += 1; });
	return bought;
};

// Buffs & spells --------------------------------------------------------
export const addBuff = (state, buff) => {
	state.buffs = state.buffs.filter((b) => b.id !== buff.id);
	state.buffs.push({ ...buff, remaining: buff.duration });
	emit(state, { type: 'buffStart', id: buff.id, kind: buff.kind });
};

export const spellUnlocked = (state, spell) => meets(state, spell.unlock);

export const castSpell = (state, id) => {
	const spell = SPELL_BY_ID[id];
	if (!spell || !spellUnlocked(state, spell) || state.spells[id] > 0) return false;
	const r = computeRates(state);
	state.spells[id] = spell.cooldown * r.cdMult;
	state.stats.spellsCast += 1;
	const { effect } = spell;
	let amount = 0;
	if (effect.type === 'buff') {
		addBuff(state, {
			id: `spell:${id}`, name: spell.name, kind: effect.kind, mult: effect.mult, duration: spell.duration * r.durMult,
		});
	} else if (effect.type === 'rift') {
		amount = manaPerSecond(state) * effect.seconds;
		gain(state, amount);
	} else if (effect.type === 'lure') {
		for (let i = 0; i < effect.count; i += 1) spawnWisp(state);
	}
	emit(state, { type: 'spell', id, amount });
	return true;
};

// Casting (clicking) & focus --------------------------------------------
export const cast = (state) => {
	const amount = clickPower(state);
	gain(state, amount);
	state.stats.clicks += 1;
	state.stats.clickMana += amount;
	state._focusIdle = 0;
	state.focus += FOCUS_PER_CAST * computeRates(state).focusGain;
	let fireball = 0;
	if (state.focus >= 1) {
		state.focus = 0;
		fireball = fireballPower(state);
		gain(state, fireball);
		state.stats.fireballs += 1;
		emit(state, { type: 'fireball', amount: fireball });
	}
	return { amount, fireball };
};

const autoCast = (state, count) => {
	const amount = clickPower(state) * count;
	gain(state, amount);
	state.stats.autoCasts += count;
	state.stats.clickMana += amount;
	emit(state, { type: 'autoCast', count, amount });
};

// Wisps -----------------------------------------------------------------
export const spawnWisp = (state) => {
	const wisp = {
		id: state.nextWispId, age: 0, life: WISP_LIFE, seed: rand(), dir: rand() < 0.5 ? 1 : -1,
	};
	state.nextWispId += 1;
	state.wisps.push(wisp);
	emit(state, { type: 'wispSpawn', id: wisp.id });
	return wisp;
};

export const pickWispEffect = (roll = rand()) => {
	const total = WISP_EFFECTS.reduce((s, e) => s + e.weight, 0);
	let t = roll * total;
	return WISP_EFFECTS.find((e) => { t -= e.weight; return t < 0; }) || WISP_EFFECTS[0];
};

export const catchWisp = (state, id, roll = rand()) => {
	const idx = state.wisps.findIndex((w) => w.id === id);
	if (idx < 0) return null;
	state.wisps.splice(idx, 1);
	state.stats.wispsCaught += 1;
	const r = computeRates(state);
	const effect = pickWispEffect(roll);
	let amount = 0;
	if (effect.id === 'windfall') {
		amount = (Math.min(state.mana * 0.15, manaPerSecond(state) * 900) + 13) * r.wispReward;
		gain(state, amount);
	} else {
		addBuff(state, {
			id: `wisp:${effect.id}`, name: effect.name, kind: effect.kind, mult: effect.mult, duration: effect.duration * r.wispDur,
		});
	}
	const result = {
		type: 'wisp', effect: effect.id, name: effect.name, amount,
	};
	emit(state, result);
	return result;
};

// Feats -----------------------------------------------------------------
export const checkAchievements = (state) => {
	let earned = 0;
	ACHIEVEMENTS.forEach((a) => {
		if (state.achievements[a.id] || !meets(state, a.cond)) return;
		state.achievements[a.id] = true;
		earned += 1;
		emit(state, { type: 'achievement', id: a.id });
	});
	if (earned) invalidate(state);
	return earned;
};

// Auto-summon: buy whichever visible summon pays itself back fastest.
export const bestValueGen = (state) => {
	const r = computeRates(state);
	let best = null;
	let bestRatio = Infinity;
	GENERATORS.forEach((g, i) => {
		if (!genVisible(state, i)) return;
		const ratio = genCost(state, g.id) / r.perGen[g.id];
		if (ratio < bestRatio) { bestRatio = ratio; best = g.id; }
	});
	return best;
};

const autoBuy = (state) => {
	for (let i = 0; i < 25; i += 1) {
		const id = bestValueGen(state);
		if (!id || buyGen(state, id, 1) === 0) return;
	}
};

// Main tick -------------------------------------------------------------
export const tick = (state, dt) => {
	if (!(dt > 0)) return;
	const r = computeRates(state);
	const mps = manaPerSecond(state);
	gain(state, mps * dt);
	if (mps > state.stats.bestMps) state.stats.bestMps = mps;

	if (state.buffs.length) {
		state.buffs.forEach((b) => { b.remaining -= dt; });
		const expired = state.buffs.filter((b) => b.remaining <= 0);
		if (expired.length) {
			state.buffs = state.buffs.filter((b) => b.remaining > 0);
			expired.forEach((b) => emit(state, { type: 'buffEnd', id: b.id, name: b.name }));
		}
	}

	SPELLS.forEach((s) => {
		if (state.spells[s.id] > 0) state.spells[s.id] = Math.max(0, state.spells[s.id] - dt);
	});

	state._focusIdle = (state._focusIdle || 0) + dt;
	if (state._focusIdle > FOCUS_IDLE_GRACE && state.focus > 0) {
		state.focus = Math.max(0, state.focus - FOCUS_DRAIN * dt);
	}

	if (state.wisps.length) {
		state.wisps.forEach((w) => { w.age += dt; });
		state.wisps = state.wisps.filter((w) => w.age < w.life);
	}
	state.wispTimer -= dt * r.wispFreq;
	if (state.wispTimer <= 0) {
		spawnWisp(state);
		state.wispTimer = 60 + rand() * 120;
	}

	const autoLevel = talentLevel(state, 'auto');
	if (autoLevel) {
		state.autoClickAcc += autoLevel * dt;
		const n = Math.floor(state.autoClickAcc);
		if (n > 0) {
			state.autoClickAcc -= n;
			autoCast(state, n);
		}
	}

	state._slowAcc = (state._slowAcc || 0) + dt;
	if (state._slowAcc >= 1) {
		state._slowAcc = 0;
		if (state.settings.autoBuy && talentLevel(state, 'butler')) autoBuy(state);
		checkAchievements(state);
	}
};

// Prestige --------------------------------------------------------------
export const sigilsForLifetime = (lifetime) => Math.floor(Math.cbrt(Math.max(0, lifetime) / SIGIL_DIVISOR));
export const lifetimeForSigils = (sigils) => sigils ** 3 * SIGIL_DIVISOR;
export const pendingSigils = (state) => Math.max(0, sigilsForLifetime(state.lifetimeEarned) - state.sigils);
export const unspentSigils = (state) => state.sigils - state.sigilsSpent;

// Progress (0..1) toward the next pending sigil.
export const sigilProgress = (state) => {
	const next = sigilsForLifetime(state.lifetimeEarned) + 1;
	const lo = lifetimeForSigils(next - 1);
	const hi = lifetimeForSigils(next);
	return Math.min(1, Math.max(0, (state.lifetimeEarned - lo) / (hi - lo)));
};

export const ascend = (state, now = Date.now()) => {
	const gained = pendingSigils(state);
	if (gained < 1) return 0;
	state.sigils += gained;
	state.stats.ascensions += 1;
	const keepUpgrades = talentLevel(state, 'memory') > 0;
	state.mana = 0;
	state.runEarned = 0;
	state.gens = Object.fromEntries(GENERATORS.map((g) => [g.id, 0]));
	state.gens.apprentice = 10 * talentLevel(state, 'headstart');
	state.upgrades = keepUpgrades
		? Object.fromEntries(Object.keys(state.upgrades).filter((id) => UPGRADE_BY_ID[id]?.keep).map((id) => [id, true]))
		: {};
	state.buffs = [];
	state.spells = Object.fromEntries(SPELLS.map((s) => [s.id, 0]));
	state.focus = 0;
	state.wisps = [];
	state.wispTimer = 60;
	state.stats.runStart = now;
	invalidate(state);
	checkAchievements(state);
	emit(state, { type: 'ascend', gained });
	return gained;
};

export const talentCost = (talent, level) => Math.ceil(talent.base * talent.growth ** level);

export const talentRequirementsMet = (state, talent) => (talent.requires || [])
	.every(([id, lvl]) => talentLevel(state, id) >= lvl);

export const buyTalent = (state, id) => {
	const t = TALENT_BY_ID[id];
	if (!t) return false;
	const level = talentLevel(state, id);
	if (level >= t.max || !talentRequirementsMet(state, t)) return false;
	const cost = talentCost(t, level);
	if (unspentSigils(state) < cost) return false;
	state.sigilsSpent += cost;
	state.talents[id] = level + 1;
	invalidate(state);
	emit(state, { type: 'talent', id, level: level + 1 });
	return true;
};

// Offline progress --------------------------------------------------------
export const offlineParams = (state) => {
	const lvl = talentLevel(state, 'dream');
	return { efficiency: Math.min(1, 0.25 + 0.1 * lvl), capSeconds: (8 + 2 * lvl) * 3600 };
};

export const applyOffline = (state, now = Date.now()) => {
	const elapsed = Math.max(0, (now - state.lastSave) / 1000);
	state.lastSave = now;
	if (elapsed < 30) return null;
	const { efficiency, capSeconds } = offlineParams(state);
	const seconds = Math.min(elapsed, capSeconds);
	const amount = baseMps(state) * seconds * efficiency;
	gain(state, amount);
	SPELLS.forEach((s) => { state.spells[s.id] = Math.max(0, state.spells[s.id] - elapsed); });
	state.buffs = state.buffs.filter((b) => b.remaining > elapsed).map((b) => ({ ...b, remaining: b.remaining - elapsed }));
	state.wisps = [];
	state.focus = 0;
	checkAchievements(state);
	return {
		elapsed, seconds, amount, efficiency,
	};
};

// Saves -------------------------------------------------------------------
export const serialize = (state) => JSON.stringify(state, (key, value) => (key.startsWith('_') ? undefined : value));

const toBase64 = (text) => {
	const bytes = new TextEncoder().encode(text);
	let bin = '';
	bytes.forEach((b) => { bin += String.fromCharCode(b); });
	return btoa(bin);
};
const fromBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0)));

export const encodeSave = (state) => toBase64(serialize(state));

const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);
const pickFlags = (obj, valid) => Object.fromEntries(Object.keys(obj || {}).filter((k) => valid[k] && obj[k]).map((k) => [k, true]));

// Rebuild a state from untrusted JSON: unknown ids are dropped, numbers are
// clamped, and missing fields fall back to defaults so old saves keep loading.
export const hydrate = (raw, now = Date.now()) => {
	const s = createState(now);
	if (!raw || typeof raw !== 'object') return s;
	s.mana = num(raw.mana);
	s.runEarned = Math.max(num(raw.runEarned), 0);
	s.lifetimeEarned = Math.max(num(raw.lifetimeEarned), s.runEarned);
	GENERATORS.forEach((g) => { s.gens[g.id] = Math.floor(num(raw.gens?.[g.id])); });
	s.upgrades = pickFlags(raw.upgrades, UPGRADE_BY_ID);
	s.achievements = pickFlags(raw.achievements, ACHIEVEMENT_BY_ID);
	SPELLS.forEach((sp) => { s.spells[sp.id] = Math.min(num(raw.spells?.[sp.id]), sp.cooldown); });
	s.buffs = (Array.isArray(raw.buffs) ? raw.buffs : [])
		.filter((b) => b && typeof b.id === 'string' && (b.kind === 'prod' || b.kind === 'click'))
		.map((b) => ({
			id: b.id, name: String(b.name || ''), kind: b.kind, mult: Math.min(num(b.mult, 1), 1000), duration: num(b.duration), remaining: num(b.remaining),
		}));
	s.focus = Math.min(num(raw.focus), 0.99);
	s.wispTimer = num(raw.wispTimer, 75);
	s.nextWispId = Math.floor(num(raw.nextWispId, 1)) || 1;
	s.sigils = Math.floor(num(raw.sigils));
	s.sigilsSpent = Math.min(Math.floor(num(raw.sigilsSpent)), s.sigils);
	TALENTS.forEach((t) => {
		const lvl = Math.min(Math.floor(num(raw.talents?.[t.id])), t.max);
		if (lvl) s.talents[t.id] = lvl;
	});
	s.autoClickAcc = Math.min(num(raw.autoClickAcc), 1);
	Object.keys(s.stats).forEach((k) => { s.stats[k] = num(raw.stats?.[k], s.stats[k]); });
	const st = raw.settings || {};
	s.settings.notation = st.notation === 'sci' ? 'sci' : 'short';
	s.settings.sound = st.sound !== false;
	s.settings.buyAmount = [1, 10, 100, 'max'].includes(st.buyAmount) ? st.buyAmount : 1;
	s.settings.autoBuy = !!st.autoBuy;
	s.settings.reducedFx = !!st.reducedFx;
	s.lastSave = Math.min(num(raw.lastSave, now), now);
	invalidate(s);
	return s;
};

export const decodeSave = (text, now = Date.now()) => {
	const raw = JSON.parse(fromBase64(text));
	if (!raw || typeof raw !== 'object' || typeof raw.version !== 'number') throw new Error('Not a Starfall Spire save');
	return hydrate(raw, now);
};
