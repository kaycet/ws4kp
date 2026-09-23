import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.mjs';
import * as R from '../js/rift.mjs';
import { MUTATOR_BY_ID } from '../js/data.mjs';

const WEEK = Date.UTC(2026, 8, 23, 12); // Wednesday of ISO week 2026-W39

test('ISO weeks and bounds are computed in UTC', () => {
	assert.deepEqual(R.isoWeek(WEEK), { year: 2026, week: 39 });
	assert.deepEqual(R.isoWeek(Date.UTC(2021, 0, 3)), { year: 2020, week: 53 });
	const { start, end } = R.weekBounds(WEEK);
	assert.equal(new Date(start).getUTCDay(), 1, 'weeks start on Monday');
	assert.equal(end - start, 7 * 86400000);
	assert.ok(start <= WEEK && WEEK < end);
});

test('every player gets the same rift for a week', () => {
	const a = R.trialForTime(WEEK);
	const b = R.trialForTime(WEEK + 86400000);
	assert.deepEqual(a, b);
	assert.equal(a.id, '2026-W39');
	assert.equal(a.mutators.length, 2);
	assert.notEqual(a.mutators[0], a.mutators[1]);
	a.mutators.forEach((id) => assert.ok(MUTATOR_BY_ID[id]));
	assert.notEqual(R.trialForTime(WEEK + 7 * 86400000).id, a.id);
});

test('alignment is deterministic, rotates, and only picks owned summons', () => {
	const s = E.createState(0);
	assert.equal(E.computeAlignment(s, 0), null, 'nothing owned, nothing aligns');
	s.gens.apprentice = 5;
	s.gens.owl = 2;
	const seen = new Set();
	for (let epoch = 0; epoch < 40; epoch += 1) {
		const a = E.computeAlignment(s, epoch * E.ALIGN_PERIOD * 1000);
		assert.deepEqual(a, E.computeAlignment(s, epoch * E.ALIGN_PERIOD * 1000));
		a.gens.forEach((id) => { assert.ok(['apprentice', 'owl'].includes(id)); seen.add(id); });
	}
	assert.equal(seen.size, 2, 'both unlocked summons take a turn');
});

test('alignment multiplies the aligned summon and emits an event', () => {
	const s = E.createState(0);
	s.gens.owl = 10;
	E.invalidate(s);
	const base = E.manaPerSecond(s);
	E.tick(s, 0.001, 1000);
	assert.equal(E.currentAlignment(s).gens[0], 'owl');
	assert.ok(Math.abs(E.computeRates(s).perGen.owl / (base / 10) - E.ALIGN_MULT) < 1e-9);
	assert.ok(E.drainEvents(s).some((e) => e.type === 'align'));
});

test('relics are bought with shards, equip up to three, and apply their mods', () => {
	const s = E.createState(0);
	assert.equal(E.buyRelic(s, 'coin'), false, 'no shards yet');
	s.shards = 40;
	['coin', 'grimoire', 'compass', 'prism'].forEach((id) => assert.ok(E.buyRelic(s, id)));
	assert.equal(E.buyRelic(s, 'coin'), false, 'already owned');
	const before = E.genCost(s, 'owl');
	assert.ok(E.toggleRelic(s, 'coin'));
	assert.ok(Math.abs(E.genCost(s, 'owl') / before - 0.9) < 1e-9);
	assert.ok(E.toggleRelic(s, 'grimoire'));
	assert.ok(E.toggleRelic(s, 'compass'));
	assert.equal(E.toggleRelic(s, 'prism'), false, 'slots full');
	assert.ok(E.toggleRelic(s, 'coin'), 'unequip frees a slot');
	assert.ok(E.toggleRelic(s, 'prism'));
	assert.equal(E.upgradeCost(s, { cost: 100 }), 75);
});

test('mutators rewrite the rules only inside a trial', () => {
	const trial = { ...R.trialForTime(WEEK), mutators: ['glass', 'bargain'] };
	const t = R.createTrialState(trial, 0);
	t.gens.owl = 10;
	E.invalidate(t);
	const plain = E.createState(0);
	plain.gens.owl = 10;
	E.invalidate(plain);
	assert.ok(Math.abs(E.manaPerSecond(t) / E.manaPerSecond(plain) - 0.5) < 1e-9);
	assert.equal(E.clickPower(t) / E.clickPower(plain), 10);
	assert.ok(Math.abs(E.genCost(t, 'owl') / E.genCost(plain, 'owl') - 0.6) < 1e-9);
	plain.equipped = ['coin'];
	t.equipped = ['coin'];
	E.invalidate(t);
	assert.ok(Math.abs(E.genCost(t, 'owl') / E.genCost(plain, 'owl') - 0.6) < 1e-9, 'relics are ignored in trials');
});

test('trial wisps and alignments are identical for every runner', () => {
	const trial = R.trialForTime(WEEK);
	const run = () => {
		const s = R.createTrialState(trial, 5000);
		s.gens.apprentice = 3;
		const log = [];
		for (let i = 0; i < 400; i += 1) {
			E.tick(s, 1, 5000 + i * 1000);
			s.wisps.forEach((w) => log.push([i, E.catchWisp(s, w.id).effect]));
			log.push(E.currentAlignment(s)?.key);
		}
		return log;
	};
	assert.deepEqual(run(), run());
});

test('finishing a trial awards shards once per tier and records the best', () => {
	const trial = R.trialForTime(WEEK);
	const thresholds = [100, 1e4, 1e6, 1e8];
	const main = E.createState(0);
	const t = R.createTrialState(trial, 0);
	t.runEarned = 2e4;
	let res = R.finishTrial(main, t, thresholds);
	assert.deepEqual(res.newTiers, [0, 1]);
	assert.equal(res.shards, R.FIRST_RUN_SHARDS + R.TIERS[0].shards + R.TIERS[1].shards);
	assert.equal(main.shards, res.shards);
	assert.equal(main.stats.bestTier, 1);
	assert.ok(main.achievements['rift-0'], 'Rift Walker feat');

	t.runEarned = 500;
	res = R.finishTrial(main, t, thresholds);
	assert.equal(res.shards, 0, 'worse run, no rewards');
	assert.equal(main.riftRecords[trial.id].best, 2e4);
	assert.equal(main.riftRecords[trial.id].attempts, 2);

	t.runEarned = 2e6;
	res = R.finishTrial(main, t, thresholds);
	assert.deepEqual(res.newTiers, [2]);
	assert.ok(res.newBest);
});

test('tier thresholds come from beating specific rival echoes', () => {
	const rivals = [5, 1, 9, 3, 7, 2, 8, 4, 6].map((score, i) => ({ name: `r${i}`, score }));
	assert.deepEqual(R.tierThresholds(rivals), [3, 5, 7, 9]);
	assert.equal(R.tierFor(6, [3, 5, 7, 9]), 1);
	assert.equal(R.tierFor(1, [3, 5, 7, 9]), -1);
});

test('rival echoes are deterministic and spread across skill', async () => {
	const trial = R.trialForTime(WEEK);
	const a = R.rivalsFor(trial);
	assert.deepEqual(a, R.rivalsFor(trial));
	assert.equal(new Set(a.map((r) => r.name)).size, a.length);
	const scores = a.map((r) => r.score).sort((x, y) => x - y);
	assert.ok(scores[scores.length - 1] > scores[0] * 10, 'strong echoes clearly beat weak ones');
	const board = new R.LocalLeaderboard(() => a);
	const standings = await board.standings(trial, { name: 'Me', score: scores[4] + 1 });
	assert.equal(standings.findIndex((row) => row.you), 4);
});

test('saves round-trip trials, relics and records, and reject junk', () => {
	const trial = R.trialForTime(WEEK);
	const t = R.createTrialState(trial, 1000);
	E.tick(t, 30, 31000);
	const back = E.decodeSave(E.encodeSave(t), 60000);
	assert.ok(E.isTrial(back));
	assert.equal(back.trial.id, trial.id);
	assert.equal(back.rngState, t.rngState);

	const evil = E.hydrate({
		version: 1,
		shards: 3.7,
		relics: { coin: true, bogus: true },
		equipped: ['coin', 'coin', 'prism', 'bogus'],
		riftRecords: { '2026-W39': { best: 5, attempts: 2, claimed: [0, 0, 99] }, hack: { best: 1e99 } },
		settings: { wizardName: '<img src=x onerror=alert(1)>Merlin' },
		stats: { bestTier: 'gold' },
	}, 0);
	assert.equal(evil.shards, 3);
	assert.deepEqual(evil.relics, { coin: true });
	assert.deepEqual(evil.equipped, ['coin']);
	assert.deepEqual(Object.keys(evil.riftRecords), ['2026-W39']);
	assert.deepEqual(evil.riftRecords['2026-W39'].claimed, [0]);
	assert.equal(evil.settings.wizardName, 'img srcx onerroralert1Me');
	assert.equal(evil.stats.bestTier, -1);
	assert.equal(E.isTrial(evil), false);
});
