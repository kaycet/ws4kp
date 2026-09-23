// Rift Trials: a weekly, seeded 15-minute sprint played in a separate save.
// Every player gets the same mutators, wisp stream and alignments, so scores
// are comparable. Rewards (Astral Shards) flow back into the main save.
import * as E from './engine.mjs';
import { MUTATORS } from './data.mjs';

export const TRIAL_SECONDS = 15 * 60;
const DAY_MS = 86400000;

// Tiers are "beat the Nth-weakest rival echo", so thresholds calibrate
// themselves to each week's mutators instead of fixed numbers.
export const TIERS = [
	{ name: 'Bronze', rank: 1, shards: 2 },
	{ name: 'Silver', rank: 3, shards: 3 },
	{ name: 'Gold', rank: 5, shards: 5 },
	{ name: 'Astral', rank: 7, shards: 8 },
];
export const FIRST_RUN_SHARDS = 1;

const RIFT_NAMES = ['Ember', 'Hollow', 'Shattered', 'Gilded', 'Drowned', 'Howling', 'Veiled', 'Starless', 'Crimson', 'Whispering', 'Frozen', 'Sunken'];
const RIVAL_NAMES = [
	'Mirelda the Grey', 'Old Fennick', 'Zara Emberwick', 'Brother Quill', 'Lysa of the Tides', 'Grimsby Owlfeather',
	'Thessaly Voidborn', 'Pip the Unready', 'Magister Oakhart', 'Vesper Nightjar', 'Corwin Ashgrove', 'Ilsa Frostmantle',
	'Dame Orrery', 'Hobb Candlewright', 'Sable Moonwhisper', 'Tamsin Riftwalker', 'Aldous Brightstaff', 'Nyx Hollowmere',
	'Wendeline Sparrow', 'Garrick Stonefist', 'Ophira Starling', 'Bram Cinderhook', 'Elowen Quickthorn', 'The Nameless Apprentice',
];

// ISO-8601 week in UTC, so the whole world shares one rift per week.
export const isoWeek = (ms) => {
	const d = new Date(ms);
	const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	const day = date.getUTCDay() || 7;
	date.setUTCDate(date.getUTCDate() + 4 - day);
	const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
	return { year: date.getUTCFullYear(), week: Math.ceil(((date - yearStart) / DAY_MS + 1) / 7) };
};

export const weekBounds = (ms) => {
	const d = new Date(ms);
	const sinceMonday = (d.getUTCDay() + 6) % 7;
	const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceMonday);
	return { start, end: start + 7 * DAY_MS };
};

export const trialForTime = (ms) => {
	const { year, week } = isoWeek(ms);
	const id = `${year}-W${String(week).padStart(2, '0')}`;
	const seed = E.hash32('rift', id);
	const first = seed % MUTATORS.length;
	const second = (first + 1 + (E.hash32('mut', id) % (MUTATORS.length - 1))) % MUTATORS.length;
	return {
		id,
		seed,
		name: `The ${RIFT_NAMES[E.hash32('name', id) % RIFT_NAMES.length]} Rift`,
		mutators: [MUTATORS[first].id, MUTATORS[second].id],
		...weekBounds(ms),
	};
};

export const createTrialState = (trial, nowMs, settings = {}) => {
	const s = E.createState(nowMs);
	s.mode = 'trial';
	s.trial = {
		id: trial.id, name: trial.name, seed: trial.seed, mutators: [...trial.mutators], startedAt: nowMs, endsAt: nowMs + TRIAL_SECONDS * 1000,
	};
	s.rngState = trial.seed;
	s.wispTimer = 25;
	['notation', 'sound', 'reducedFx', 'buyAmount'].forEach((k) => {
		if (settings[k] !== undefined) s.settings[k] = settings[k];
	});
	E.invalidate(s);
	return s;
};

export const trialRemaining = (s, nowMs) => Math.max(0, (s.trial.endsAt - nowMs) / 1000);

export const tierThresholds = (rivals) => {
	const sorted = rivals.map((r) => r.score).sort((a, b) => a - b);
	return TIERS.map((t) => sorted[Math.min(t.rank, sorted.length - 1)] + 1);
};

export const tierFor = (score, thresholds) => thresholds.reduce((best, min, i) => (score >= min ? i : best), -1);

// Keep a rolling window of weekly records so saves stay small.
const pruneRecords = (records, keep = 12) => Object.fromEntries(Object.entries(records).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, keep));

export const finishTrial = (main, trialState, thresholds) => {
	const { id } = trialState.trial;
	const score = Math.floor(trialState.runEarned);
	const rec = main.riftRecords[id] || { best: 0, attempts: 0, claimed: [] };
	const firstRun = rec.attempts === 0;
	rec.attempts += 1;
	const newBest = score > rec.best;
	rec.best = Math.max(rec.best, score);
	const reached = tierFor(rec.best, thresholds);
	const newTiers = [];
	for (let t = 0; t <= reached; t += 1) {
		if (!rec.claimed.includes(t)) {
			rec.claimed.push(t);
			newTiers.push(t);
		}
	}
	const shards = newTiers.reduce((sum, t) => sum + TIERS[t].shards, firstRun ? FIRST_RUN_SHARDS : 0);
	main.shards += shards;
	main.riftRecords = pruneRecords({ ...main.riftRecords, [id]: rec });
	main.stats.trials += 1;
	main.stats.bestTier = Math.max(main.stats.bestTier, reached);
	E.invalidate(main);
	E.checkAchievements(main);
	return {
		score, best: rec.best, newBest, tier: tierFor(score, thresholds), newTiers, shards, firstRun,
	};
};

// Rival echoes -------------------------------------------------------------
// Rivals are bots that play the exact same seeded rift on the real engine, so
// the ladder is meaningful without a server. Their decisions use a separate
// stream so the shared wisp stream stays identical to the player's.
export const simulateRun = (trial, skill, botSeed) => {
	const s = createTrialState(trial, 0);
	const bot = { rngState: botSeed };
	const r = () => E.nextRandom(bot);
	const buyEvery = skill > 0.6 ? 1 : 4;
	for (let t = 0; t < TRIAL_SECONDS; t += 1) {
		E.tick(s, 1, t * 1000);
		const casts = Math.floor(skill * 7 * (0.6 + r() * 0.4));
		for (let c = 0; c < casts; c += 1) E.cast(s);
		if (r() < skill) ['surge', 'frenzy', 'rift', 'lure'].forEach((id) => E.castSpell(s, id));
		s.wisps.filter((w) => w.age > 1 && r() < skill * 0.3).forEach((w) => E.catchWisp(s, w.id));
		if (t % buyEvery === 0) {
			if (skill > 0.3) E.buyAllUpgrades(s);
			for (let i = 0; i < 40; i += 1) {
				const id = E.bestValueGen(s);
				if (!id || !E.buyGen(s, id, 1)) break;
			}
		}
		E.drainEvents(s);
	}
	return Math.floor(s.runEarned);
};

export const rivalsFor = (trial, count = 9) => {
	const used = new Set();
	return Array.from({ length: count }, (_, i) => {
		let idx = E.hash32('rival', trial.id, i) % RIVAL_NAMES.length;
		while (used.has(idx)) idx = (idx + 1) % RIVAL_NAMES.length;
		used.add(idx);
		const jitter = (E.hash32('skill', trial.id, i) % 1000) / 1000;
		const skill = Math.min(1, 0.12 + i * 0.1 + jitter * 0.08);
		return { name: RIVAL_NAMES[idx], score: simulateRun(trial, skill, E.hash32('bot', trial.id, i)) };
	});
};

// Leaderboard adapter. The local implementation ranks you against rival
// echoes; a server-backed adapter can implement the same two async methods
// (and validate submissions by replaying the seed) without touching the UI.
export class LocalLeaderboard {
	constructor(rivalProvider = rivalsFor) {
		this.rivalProvider = rivalProvider;
		this.cache = new Map();
	}

	async submit(trialId, entry) {
		this.last = { trialId, ...entry };
		return { accepted: true };
	}

	async standings(trial, you) {
		if (!this.cache.has(trial.id)) this.cache.set(trial.id, this.rivalProvider(trial));
		return [...this.cache.get(trial.id), { ...you, you: true }].sort((a, b) => b.score - a.score);
	}
}
