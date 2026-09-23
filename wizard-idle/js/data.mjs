// Static game content. Everything here is declarative so the engine can stay
// generic and the content can be rebalanced without touching game logic.

export const GENERATORS = [
	{
		id: 'apprentice', name: 'Apprentice', plural: 'Apprentices', baseCost: 15, baseRate: 0.1, flavor: 'Sweeps the spire and occasionally sparks a cantrip.',
	},
	{
		id: 'owl', name: 'Owl Familiar', plural: 'Owls', baseCost: 100, baseRate: 1, flavor: 'Hoots incantations at the moon all night.',
	},
	{
		id: 'candle', name: 'Candle Circle', plural: 'Candles', baseCost: 1100, baseRate: 8, flavor: 'Seven wicks that never burn down.',
	},
	{
		id: 'cauldron', name: 'Cauldron', plural: 'Cauldrons', baseCost: 12000, baseRate: 47, flavor: 'Bubbles with liquid starlight.',
	},
	{
		id: 'shelf', name: 'Grimoire Shelf', plural: 'Grimoires', baseCost: 130000, baseRate: 260, flavor: 'The books read themselves aloud after midnight.',
	},
	{
		id: 'golem', name: 'Rune Golem', plural: 'Golems', baseCost: 1.4e6, baseRate: 1400, flavor: 'Hauls ley-stones without complaint.',
	},
	{
		id: 'crystal', name: 'Crystal Spire', plural: 'Crystals', baseCost: 2e7, baseRate: 7800, flavor: 'Refracts moonlight into raw mana.',
	},
	{
		id: 'dragon', name: 'Bound Dragon', plural: 'Dragons', baseCost: 3.3e8, baseRate: 44000, flavor: 'Breathes arcane fire, grudgingly.',
	},
	{
		id: 'observatory', name: 'Star Observatory', plural: 'Observatories', baseCost: 5.1e9, baseRate: 260000, flavor: 'Harvests mana from dying stars.',
	},
	{
		id: 'portal', name: 'Void Portal', plural: 'Portals', baseCost: 7.5e10, baseRate: 1.6e6, flavor: 'Something on the other side pays rent.',
	},
	{
		id: 'loom', name: 'Time Loom', plural: 'Looms', baseCost: 1e12, baseRate: 1e7, flavor: 'Weaves yesterday\'s mana into today.',
	},
	{
		id: 'genesis', name: 'Genesis Rune', plural: 'Genesis Runes', baseCost: 1.4e13, baseRate: 6.5e7, flavor: 'The first word ever spoken, still echoing.',
	},
];

// Upgrades ----------------------------------------------------------------
// unlock: array of conditions that must all hold. Condition types:
//   owned {gen,n} | earned {n} (this ascension) | clicks {n} | wisps {n}
//   spells {n} | fireballs {n} | totalGens {n} | any {of:[...]}
// effects: array of { type, ... } consumed by engine.computeRates.
const TIER_THRESHOLDS = [1, 5, 25, 50, 100, 150, 200, 250, 300, 400];
const TIER_COST = [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e13, 5e16, 5e19];
export const TIER_NAMES = ['Runed', 'Gilded', 'Moonlit', 'Starforged', 'Eldritch', 'Mythic', 'Celestial', 'Primordial', 'Infinite', 'Transcendent'];

const upgrades = [];

GENERATORS.forEach((g) => {
	TIER_THRESHOLDS.forEach((n, tier) => {
		const effects = [{ type: 'gen', gen: g.id, mult: 2 }];
		let desc = `${g.plural} produce twice as much mana.`;
		// Early apprentice tiers also sharpen the wizard's own casting.
		if (g.id === 'apprentice' && tier < 3) {
			effects.push({ type: 'click', mult: 2 });
			desc = `${g.plural} and your casts are twice as potent.`;
		}
		upgrades.push({
			id: `${g.id}-t${tier}`,
			name: `${TIER_NAMES[tier]} ${g.plural}`,
			cat: 'gen',
			icon: g.id,
			tier,
			desc,
			cost: g.baseCost * TIER_COST[tier],
			unlock: [{ type: 'owned', gen: g.id, n }],
			effects,
		});
	});
});

const WANDS = [
	['Oak Wand', 100, 15, [{ type: 'click', mult: 2 }], 'Casts are twice as strong.'],
	['Silver-Tipped Wand', 800, 100, [{ type: 'click', mult: 2 }], 'Casts are twice as strong.'],
	['Crystal Wand', 1e4, 250, [{ type: 'clickPct', pct: 0.01 }], 'Each cast also channels 1% of your mana/sec.'],
	['Phoenix Feather Core', 1e6, 500, [{ type: 'clickPct', pct: 0.01 }], 'Casts channel another 1% of mana/sec.'],
	['Dragonbone Staff', 1e8, 1000, [{ type: 'clickPct', pct: 0.01 }], 'Casts channel another 1% of mana/sec.'],
	['Staff of Falling Stars', 1e10, 2000, [{ type: 'clickPct', pct: 0.01 }], 'Casts channel another 1% of mana/sec.'],
	['Void-Glass Scepter', 1e13, 3500, [{ type: 'clickPct', pct: 0.01 }], 'Casts channel another 1% of mana/sec.'],
	['Rod of First Light', 1e16, 5000, [{ type: 'clickPct', pct: 0.01 }], 'Casts channel another 1% of mana/sec.'],
	['Scepter of Eternity', 1e19, 7500, [{ type: 'clickPct', pct: 0.01 }], 'Casts channel another 1% of mana/sec.'],
];
WANDS.forEach(([name, cost, clicks, effects, desc], i) => {
	upgrades.push({
		id: `wand-${i}`,
		name,
		cat: 'click',
		icon: 'wand',
		tier: i,
		desc,
		cost,
		keep: true,
		unlock: [{ type: 'any', of: [{ type: 'clicks', n: clicks }, { type: 'earned', n: cost * 4 }] }],
		effects,
	});
});

const GLOBALS = [
	['Moonlit Meditation', 1.1, 5e4],
	['Ley Line Attunement', 1.1, 5e6],
	['Astral Projection', 1.15, 5e8],
	['Rune of Plenty', 1.15, 5e10],
	['Mana Tides', 1.2, 5e12],
	['Aetheric Resonance', 1.2, 5e14],
	['Arcane Singularity', 1.25, 5e16],
	['Whisper of the Void', 1.25, 5e19],
	['Starfall Covenant', 1.3, 5e22],
];
GLOBALS.forEach(([name, mult, cost], i) => {
	upgrades.push({
		id: `global-${i}`,
		name,
		cat: 'global',
		icon: 'star',
		tier: i,
		desc: `All mana production +${Math.round((mult - 1) * 100)}%.`,
		cost,
		unlock: [{ type: 'earned', n: cost * 0.2 }],
		effects: [{ type: 'global', mult }],
	});
});

// Synergies: `gen` gains `pct` per `source` owned.
const SYNERGIES = [
	['Owl Tutors', 'apprentice', 'owl', 0.05, 2e4],
	['Wax Seals', 'cauldron', 'candle', 0.02, 5e5],
	['Recipe Codex', 'cauldron', 'shelf', 0.01, 1e7],
	['Golem Librarians', 'shelf', 'golem', 0.01, 1e8],
	['Crystal Hearts', 'golem', 'crystal', 0.01, 2e9],
	['Dragon Hoard', 'crystal', 'dragon', 0.01, 3e10],
	['Star Charts', 'dragon', 'observatory', 0.01, 5e11],
	['Portal Relays', 'observatory', 'portal', 0.01, 8e12],
	['Threads of Nowhere', 'portal', 'loom', 0.01, 1e14],
	['The First Word', 'loom', 'genesis', 0.01, 1.5e15],
];
const GEN_NAME = Object.fromEntries(GENERATORS.map((g) => [g.id, g]));
SYNERGIES.forEach(([name, gen, source, pct, cost], i) => {
	upgrades.push({
		id: `syn-${i}`,
		name,
		cat: 'synergy',
		icon: source,
		tier: 3,
		desc: `${GEN_NAME[gen].plural} gain +${Math.round(pct * 100)}% per ${GEN_NAME[source].name} owned.`,
		cost,
		unlock: [{ type: 'owned', gen, n: 25 }, { type: 'owned', gen: source, n: 10 }],
		effects: [{
			type: 'synergy', gen, source, pct,
		}],
	});
});

const MISC = [
	['quick-1', 'Quickened Casting', 'spell', 'surge', 1e5, 'Spell cooldowns 10% shorter.', [{ type: 'spells', n: 3 }], [{ type: 'spellCd', mult: 0.9 }]],
	['echo-1', 'Lingering Echoes', 'spell', 'surge', 1e7, 'Spell effects last 20% longer.', [{ type: 'spells', n: 10 }], [{ type: 'spellDur', mult: 1.2 }]],
	['quick-2', 'Arcane Efficiency', 'spell', 'surge', 1e9, 'Spell cooldowns 10% shorter.', [{ type: 'spells', n: 25 }], [{ type: 'spellCd', mult: 0.9 }]],
	['echo-2', 'Everlasting Weave', 'spell', 'surge', 1e11, 'Spell effects last 20% longer.', [{ type: 'spells', n: 50 }], [{ type: 'spellDur', mult: 1.2 }]],
	['lantern', 'Will-o\'-Lantern', 'wisp', 'wisp', 7777, 'Wisps appear 10% more often.', [{ type: 'wisps', n: 1 }], [{ type: 'wispFreq', mult: 1.1 }]],
	['jar', 'Firefly Jar', 'wisp', 'wisp', 777777, 'Wisp blessings last 25% longer.', [{ type: 'wisps', n: 5 }], [{ type: 'wispDur', mult: 1.25 }]],
	['moth', 'Moth-Wing Charm', 'wisp', 'wisp', 7.7e7, 'Wisps appear 10% more often.', [{ type: 'wisps', n: 15 }], [{ type: 'wispFreq', mult: 1.1 }]],
	['breath', 'Meditative Breathing', 'focus', 'flame', 5000, 'Focus fills 25% faster.', [{ type: 'clicks', n: 100 }], [{ type: 'focus', mult: 1.25 }]],
	['palace', 'Mind Palace', 'focus', 'flame', 5e6, 'Fireballs are twice as strong.', [{ type: 'fireballs', n: 3 }], [{ type: 'fireball', mult: 2 }]],
	['pyro', 'Pyromancy', 'focus', 'flame', 5e9, 'Fireballs are twice as strong.', [{ type: 'fireballs', n: 10 }], [{ type: 'fireball', mult: 2 }]],
];
MISC.forEach(([id, name, cat, icon, cost, desc, unlock, effects]) => {
	upgrades.push({
		id, name, cat, icon, tier: 2, desc, cost, unlock, effects, keep: cat === 'spell',
	});
});

export const UPGRADES = upgrades;

// Spells -----------------------------------------------------------------
export const SPELLS = [
	{
		id: 'surge',
		name: 'Arcane Surge',
		icon: 'surge',
		key: '1',
		cooldown: 180,
		duration: 20,
		desc: 'Mana production ×5 for 20s.',
		effect: { type: 'buff', kind: 'prod', mult: 5 },
		unlock: [{ type: 'owned', gen: 'owl', n: 1 }],
		hint: 'Summon an Owl Familiar',
	},
	{
		id: 'frenzy',
		name: 'Channel Frenzy',
		icon: 'frenzy',
		key: '2',
		cooldown: 240,
		duration: 15,
		desc: 'Casts ×10 for 15s.',
		effect: { type: 'buff', kind: 'click', mult: 10 },
		unlock: [{ type: 'totalGens', n: 25 }],
		hint: 'Own 25 summons',
	},
	{
		id: 'rift',
		name: 'Temporal Rift',
		icon: 'loom',
		key: '3',
		cooldown: 900,
		duration: 0,
		desc: 'Instantly gain 10 minutes of production.',
		effect: { type: 'rift', seconds: 600 },
		unlock: [{ type: 'owned', gen: 'shelf', n: 1 }],
		hint: 'Summon a Grimoire Shelf',
	},
	{
		id: 'lure',
		name: 'Wisp Beacon',
		icon: 'wisp',
		key: '4',
		cooldown: 1200,
		duration: 0,
		desc: 'Call 3 wisps to the spire at once.',
		effect: { type: 'lure', count: 3 },
		unlock: [{ type: 'owned', gen: 'dragon', n: 1 }],
		hint: 'Bind a Dragon',
	},
];

// Wisps: golden sprites that drift across the sky. Catch one for a blessing.
export const WISP_EFFECTS = [
	{ id: 'windfall', name: 'Mana Windfall', weight: 50 },
	{
		id: 'wild', name: 'Wild Magic', weight: 35, kind: 'prod', mult: 7, duration: 77,
	},
	{
		id: 'storm', name: 'Spell Storm', weight: 15, kind: 'click', mult: 777, duration: 13,
	},
];

// Talents (bought with unspent Starsigils, kept forever) ----------------
export const TALENTS = [
	{
		id: 'well',
		name: 'Mana Wellspring',
		icon: 'crystal',
		max: 100,
		base: 1,
		growth: 1.35,
		desc: '+10% mana production per level.',
	},
	{
		id: 'hands',
		name: 'Nimble Fingers',
		icon: 'wand',
		max: 50,
		base: 1,
		growth: 1.4,
		desc: '+50% cast power per level.',
	},
	{
		id: 'headstart',
		name: 'Eager Pupils',
		icon: 'apprentice',
		max: 5,
		base: 1,
		growth: 2,
		desc: 'Begin every ascension with 10 Apprentices per level.',
	},
	{
		id: 'thrift',
		name: 'Haggler\'s Charm',
		icon: 'star',
		max: 10,
		base: 2,
		growth: 1.6,
		desc: 'Summons cost 3% less per level.',
	},
	{
		id: 'focus',
		name: 'Inner Fire',
		icon: 'flame',
		max: 5,
		base: 2,
		growth: 1.7,
		desc: 'Focus fills 20% faster and Fireballs hit 50% harder per level.',
	},
	{
		id: 'auto',
		name: 'Automancy',
		icon: 'frenzy',
		max: 10,
		base: 2,
		growth: 1.6,
		desc: 'An unseen hand casts once per second per level.',
	},
	{
		id: 'dream',
		name: 'Lucid Dreaming',
		icon: 'moon',
		max: 7,
		base: 2,
		growth: 1.7,
		desc: 'Offline gains +10% efficiency and +2h cap per level (base 25%, 8h).',
	},
	{
		id: 'chrono',
		name: 'Chronomancy',
		icon: 'loom',
		max: 5,
		base: 3,
		growth: 1.8,
		desc: 'Spell cooldowns 8% shorter per level.',
		requires: [['auto', 1]],
	},
	{
		id: 'linger',
		name: 'Lingering Magic',
		icon: 'candle',
		max: 5,
		base: 3,
		growth: 1.8,
		desc: 'Spell and wisp blessings last 15% longer per level.',
		requires: [['focus', 1]],
	},
	{
		id: 'lure',
		name: 'Wisp Whisperer',
		icon: 'wisp',
		max: 5,
		base: 3,
		growth: 1.8,
		desc: 'Wisps appear 12% more often per level.',
		requires: [['dream', 1]],
	},
	{
		id: 'fortune',
		name: 'Gilded Wisps',
		icon: 'wisp',
		max: 4,
		base: 4,
		growth: 1.8,
		desc: 'Wisp windfalls grant 25% more mana per level.',
		requires: [['lure', 2]],
	},
	{
		id: 'resonance',
		name: 'Sigil Resonance',
		icon: 'sigil',
		max: 10,
		base: 5,
		growth: 1.7,
		desc: 'Each Starsigil grants +0.5% more production per level (base 2%).',
		requires: [['well', 5]],
	},
	{
		id: 'memory',
		name: 'Arcane Memory',
		icon: 'shelf',
		max: 1,
		base: 10,
		growth: 1,
		desc: 'Wand and spell upgrades survive ascension.',
		requires: [['hands', 3]],
	},
	{
		id: 'butler',
		name: 'Spectral Steward',
		icon: 'golem',
		max: 1,
		base: 15,
		growth: 1,
		desc: 'Unlocks Auto-summon: buys the most efficient summon whenever affordable.',
		requires: [['auto', 2]],
	},
];

// Achievements ("Feats"): each one earned grants +1% production forever.
const achievements = [];
const RANKS = [[1, 'Novice'], [50, 'Adept'], [100, 'Master'], [200, 'Archmage']];
GENERATORS.forEach((g) => {
	RANKS.forEach(([n, rank]) => {
		achievements.push({
			id: `own-${g.id}-${n}`, name: `${g.name} ${rank}`, icon: g.id, desc: `Own ${n} ${n === 1 ? g.name : g.plural}.`, cond: { type: 'owned', gen: g.id, n },
		});
	});
});
[
	[1e3, 'First Sparks'], [1e6, 'Mana Millionaire'], [1e9, 'Brimming Reservoir'], [1e12, 'Ley Line Baron'],
	[1e15, 'Sea of Stars'], [1e18, 'Aether Tycoon'], [1e21, 'Cosmic Cistern'], [1e24, 'Unmaker'],
	[1e27, 'The Endless Well'], [1e30, 'Beyond Counting'],
].forEach(([n, name], i) => achievements.push({
	id: `life-${i}`, name, icon: 'crystal', desc: `Gather ${n.toExponential(0).replace('+', '')} mana across all lifetimes.`, cond: { type: 'lifetime', n },
}));
[[10, 'Steady Glow'], [1e3, 'Humming Spire'], [1e6, 'Roaring Ley'], [1e9, 'Starfire Engine'], [1e12, 'Living Sun'], [1e15, 'Singularity']]
	.forEach(([n, name], i) => achievements.push({
		id: `mps-${i}`, name, icon: 'surge', desc: `Reach ${n.toExponential(0).replace('+', '')} mana per second.`, cond: { type: 'mps', n },
	}));
[[100, 'Finger Wiggler'], [1000, 'Wand Waver'], [10000, 'Carpal Conjurer']]
	.forEach(([n, name], i) => achievements.push({
		id: `clicks-${i}`, name, icon: 'wand', desc: `Cast ${n} times by hand.`, cond: { type: 'clicks', n },
	}));
[[1, 'Will-o\'-the-Wisp'], [10, 'Lantern Keeper'], [50, 'Wisp Shepherd']]
	.forEach(([n, name], i) => achievements.push({
		id: `wisps-${i}`, name, icon: 'wisp', desc: `Catch ${n} wisp${n > 1 ? 's' : ''}.`, cond: { type: 'wisps', n },
	}));
[[1, 'First Incantation'], [25, 'Spellslinger'], [100, 'Weaver of Worlds']]
	.forEach(([n, name], i) => achievements.push({
		id: `spells-${i}`, name, icon: 'surge', desc: `Cast ${n} spell${n > 1 ? 's' : ''}.`, cond: { type: 'spells', n },
	}));
[[1, 'Kindling'], [25, 'Pyromancer'], [100, 'Living Inferno']]
	.forEach(([n, name], i) => achievements.push({
		id: `fire-${i}`, name, icon: 'flame', desc: `Unleash ${n} Fireball${n > 1 ? 's' : ''}.`, cond: { type: 'fireballs', n },
	}));
[[1, 'Starfallen'], [5, 'Wheel of Ages'], [10, 'Eternal Return'], [25, 'Constellation']]
	.forEach(([n, name], i) => achievements.push({
		id: `asc-${i}`, name, icon: 'sigil', desc: `Ascend ${n} time${n > 1 ? 's' : ''}.`, cond: { type: 'ascensions', n },
	}));
[[10, 'Tinkerer'], [50, 'Enchanter'], [100, 'Artificer']]
	.forEach(([n, name], i) => achievements.push({
		id: `upg-${i}`, name, icon: 'star', desc: `Buy ${n} upgrades (all lifetimes).`, cond: { type: 'upgrades', n },
	}));
export const ACHIEVEMENTS = achievements;

const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
export const GEN_BY_ID = byId(GENERATORS);
export const UPGRADE_BY_ID = byId(UPGRADES);
export const SPELL_BY_ID = byId(SPELLS);
export const TALENT_BY_ID = byId(TALENTS);
export const ACHIEVEMENT_BY_ID = byId(ACHIEVEMENTS);
