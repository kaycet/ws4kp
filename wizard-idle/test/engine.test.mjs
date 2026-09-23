// Run with: node --test wizard-idle/test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.mjs';
import {
	GENERATORS, UPGRADES, ACHIEVEMENTS, TALENT_BY_ID,
} from '../js/data.mjs';
import { formatNumber, formatTime } from '../js/format.mjs';

const fresh = () => E.createState(0);

test('content ids are unique', () => {
	[GENERATORS, UPGRADES, ACHIEVEMENTS].forEach((list) => {
		const ids = list.map((x) => x.id);
		assert.equal(new Set(ids).size, ids.length);
	});
});

test('bulk cost equals the sum of single purchases', () => {
	const s = fresh();
	const bulk = E.genCost(s, 'owl', 10);
	let sum = 0;
	s.mana = 1e12;
	for (let i = 0; i < 10; i += 1) {
		sum += E.genCost(s, 'owl', 1);
		E.buyGen(s, 'owl', 1);
	}
	assert.ok(Math.abs(bulk - sum) / sum < 1e-9);
});

test('maxAffordable never overspends', () => {
	const s = fresh();
	[15, 16, 1000, 123456, 9.87e9].forEach((mana) => {
		s.mana = mana;
		const n = E.maxAffordable(s, 'apprentice');
		assert.ok(E.genCost(s, 'apprentice', Math.max(1, n)) <= mana || n === 0);
		assert.ok(E.genCost(s, 'apprentice', n + 1) > mana);
	});
});

test('buying deducts mana and raises production', () => {
	const s = fresh();
	s.mana = 100;
	assert.equal(E.buyGen(s, 'apprentice', 1), 1);
	assert.equal(s.mana, 85);
	assert.ok(Math.abs(E.manaPerSecond(s) - 0.1) < 1e-12);
	assert.equal(E.buyGen(s, 'genesis', 1), 0);
});

test('tier upgrades double generator output', () => {
	const s = fresh();
	s.mana = 1e6;
	E.buyGen(s, 'owl', 1);
	const before = E.manaPerSecond(s);
	assert.ok(E.buyUpgrade(s, 'owl-t0'));
	assert.ok(Math.abs(E.manaPerSecond(s) - before * 2) < 1e-9);
	assert.equal(E.buyUpgrade(s, 'owl-t1'), false, 'locked until 5 owls');
});

test('synergy scales with source count', () => {
	const s = fresh();
	s.gens.apprentice = 25;
	s.gens.owl = 10;
	E.invalidate(s);
	const base = E.computeRates(s).perGen.apprentice;
	s.mana = 1e9;
	assert.ok(E.buyUpgrade(s, 'syn-0'));
	assert.ok(Math.abs(E.computeRates(s).perGen.apprentice - base * 1.5) < 1e-9);
});

test('casting fills focus and eventually launches a fireball', () => {
	const s = fresh();
	s.gens.owl = 10;
	E.invalidate(s);
	let fire = 0;
	for (let i = 0; i < 25; i += 1) fire += E.cast(s).fireball;
	assert.equal(s.stats.fireballs, 1);
	assert.ok(fire >= E.manaPerSecond(s) * 30);
	assert.ok(s.focus < 0.05);
});

test('fireballs ignore cast buffs', () => {
	const s = fresh();
	s.gens.owl = 10;
	E.invalidate(s);
	const plain = E.fireballPower(s);
	E.addBuff(s, {
		id: 'x', name: 'x', kind: 'click', mult: 777, duration: 10,
	});
	assert.equal(E.fireballPower(s), plain);
});

test('spells respect cooldowns and unlocks', () => {
	const s = fresh();
	assert.equal(E.castSpell(s, 'surge'), false, 'locked without an owl');
	s.gens.owl = 1;
	E.invalidate(s);
	assert.ok(E.castSpell(s, 'surge'));
	assert.equal(E.buffMult(s, 'prod'), 5);
	assert.equal(E.castSpell(s, 'surge'), false, 'on cooldown');
	E.tick(s, 25);
	assert.equal(E.buffMult(s, 'prod'), 1, 'buff expired');
});

test('wisps spawn on a timer and grant blessings when caught', () => {
	const s = fresh();
	s.gens.owl = 5;
	E.invalidate(s);
	s.mana = 1e6;
	E.tick(s, 80);
	assert.equal(s.wisps.length, 1);
	const res = E.catchWisp(s, s.wisps[0].id, 0);
	assert.equal(res.effect, 'windfall');
	assert.ok(res.amount > 0);
	E.spawnWisp(s);
	assert.equal(E.catchWisp(s, s.wisps[0].id, 0.99).effect, 'storm');
	assert.equal(E.buffMult(s, 'click'), 777);
});

test('sigils follow a cube-root curve', () => {
	assert.equal(E.sigilsForLifetime(0), 0);
	assert.equal(E.sigilsForLifetime(1e9), 1);
	assert.equal(E.sigilsForLifetime(7.99e9), 1);
	assert.equal(E.sigilsForLifetime(8e9), 2);
	assert.equal(E.sigilsForLifetime(1e15), 100);
});

test('ascension resets the run but keeps meta progress', () => {
	const s = fresh();
	s.lifetimeEarned = 1e12;
	s.runEarned = 1e12;
	s.mana = 5e11;
	s.gens.owl = 50;
	s.upgrades['owl-t0'] = true;
	s.upgrades['wand-0'] = true;
	s.achievements['own-owl-1'] = true;
	assert.equal(E.ascend(s, 0), 10);
	assert.equal(s.sigils, 10);
	assert.equal(s.mana, 0);
	assert.equal(s.gens.owl, 0);
	assert.deepEqual(s.upgrades, {});
	assert.ok(s.achievements['own-owl-1']);
	assert.equal(E.ascend(s, 0), 0, 'nothing pending right after ascending');
});

test('talents cost sigils, respect prerequisites, and shape the next run', () => {
	const s = fresh();
	s.sigils = 100;
	assert.equal(E.buyTalent(s, 'memory'), false, 'needs Nimble Fingers 3');
	for (let i = 0; i < 3; i += 1) assert.ok(E.buyTalent(s, 'hands'));
	assert.ok(E.buyTalent(s, 'memory'));
	assert.ok(E.buyTalent(s, 'headstart'));
	assert.equal(E.unspentSigils(s), 100 - s.sigilsSpent);
	s.upgrades['wand-0'] = true;
	s.upgrades['owl-t0'] = true;
	s.lifetimeEarned = 1e18;
	E.ascend(s, 0);
	assert.ok(s.upgrades['wand-0'], 'Arcane Memory keeps wands');
	assert.equal(s.upgrades['owl-t0'], undefined);
	assert.equal(s.gens.apprentice, 10);
	assert.equal(E.talentCost(TALENT_BY_ID.well, 0), 1);
});

test('offline progress is capped and scaled by efficiency', () => {
	const s = fresh();
	s.gens.owl = 10;
	E.invalidate(s);
	s.lastSave = 0;
	const report = E.applyOffline(s, 24 * 3600 * 1000);
	assert.equal(report.seconds, 8 * 3600);
	assert.ok(Math.abs(report.amount - 10 * 8 * 3600 * 0.25) < 1e-6);
	assert.equal(E.applyOffline(s, 24 * 3600 * 1000 + 5000), null, 'short gaps are ignored');
});

test('saves round-trip and hostile input is sanitised', () => {
	const s = fresh();
	s.mana = 12345;
	s.gens.owl = 3;
	s.talents.well = 4;
	const back = E.decodeSave(E.encodeSave(s), 0);
	assert.equal(back.mana, 12345);
	assert.equal(back.gens.owl, 3);
	assert.equal(back.talents.well, 4);
	assert.equal(back._cache, undefined); // eslint-disable-line no-underscore-dangle

	const evil = E.hydrate({
		version: 1,
		mana: 'lots',
		gens: { owl: -5, hacker: 9 },
		upgrades: { 'owl-t0': true, nope: true },
		talents: { well: 9999 },
		sigils: 10,
		sigilsSpent: 50,
		buffs: [{
			id: 'x', kind: 'prod', mult: 1e9, remaining: 5,
		}, { id: 'y', kind: 'evil' }],
		settings: { buyAmount: 7 },
	}, 0);
	assert.equal(evil.mana, 0);
	assert.equal(evil.gens.owl, 0);
	assert.equal(evil.gens.hacker, undefined);
	assert.deepEqual(Object.keys(evil.upgrades), ['owl-t0']);
	assert.equal(evil.talents.well, 100);
	assert.equal(evil.sigilsSpent, 10);
	assert.equal(evil.buffs.length, 1);
	assert.equal(evil.buffs[0].mult, 1000);
	assert.equal(evil.settings.buyAmount, 1);
	assert.throws(() => E.decodeSave('not base64 at all!'));
});

test('achievements unlock and boost production', () => {
	const s = fresh();
	s.gens.owl = 1;
	E.invalidate(s);
	const before = E.manaPerSecond(s);
	assert.ok(E.checkAchievements(s) >= 1);
	assert.ok(E.manaPerSecond(s) > before);
});

test('number formatting', () => {
	assert.equal(formatNumber(0), '0');
	assert.equal(formatNumber(0.1), '0.1');
	assert.equal(formatNumber(999), '999');
	assert.equal(formatNumber(1234), '1.23K');
	assert.equal(formatNumber(999999), '1.00M');
	assert.equal(formatNumber(1.5e15), '1.50Qa');
	assert.equal(formatNumber(1234, 'sci'), '1.23e3');
	assert.equal(formatNumber(1e100), '1.00e100');
	assert.equal(formatTime(3725), '1h 2m');
});
