// DOM layer. Rows are built once and then patched in place; setText/setClass
// skip writes when nothing changed, so a 10 Hz refresh costs almost nothing.
import * as E from './engine.mjs';
import * as R from './rift.mjs';
import {
	GENERATORS, SPELLS, TALENTS, ACHIEVEMENTS, TALENT_BY_ID, UPGRADE_BY_ID, RELICS, MUTATOR_BY_ID, GEN_BY_ID,
} from './data.mjs';
import { formatNumber, formatTime } from './format.mjs';
import { iconURL } from './sprites.mjs';

const $ = (id) => document.getElementById(id);

const el = (tag, cls, text) => {
	const node = document.createElement(tag);
	if (cls) node.className = cls;
	if (text !== undefined) node.textContent = text;
	return node;
};

const img = (src, alt = '') => {
	const node = el('img');
	node.src = src;
	node.alt = alt;
	node.draggable = false;
	return node;
};

const setText = (node, text) => {
	if (node.cachedText !== text) {
		node.textContent = text;
		node.cachedText = text;
	}
};

const setClass = (node, cls, on) => {
	node.cachedClasses = node.cachedClasses || {};
	if (node.cachedClasses[cls] !== on) {
		node.classList.toggle(cls, on);
		node.cachedClasses[cls] = on;
	}
};

const article = (word) => (/^[AEIOU]/i.test(word) ? 'an' : 'a');

const share = (part, total) => {
	const pct = (part * 100) / total;
	return pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`;
};

const WISP_TEXT = {
	wild: 'production ×7',
	storm: 'casts ×777',
};

const bindTooltip = () => {
	const tip = $('tooltip');
	const show = (target, x, y) => {
		const [title, body] = target.dataset.tip.split('|');
		tip.replaceChildren(el('strong', '', title), document.createTextNode(body || ''));
		tip.hidden = false;
		const w = tip.offsetWidth;
		const h = tip.offsetHeight;
		tip.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x + 14))}px`;
		tip.style.top = `${Math.max(8, y - h - 12)}px`;
	};
	document.addEventListener('pointermove', (e) => {
		if (e.pointerType !== 'mouse') return;
		const target = e.target.closest?.('[data-tip]');
		if (target) show(target, e.clientX, e.clientY);
		else tip.hidden = true;
	});
	document.addEventListener('pointerdown', () => { tip.hidden = true; });
};

export const toast = (icon, title, text, kind = '') => {
	const wrap = $('toasts');
	while (wrap.children.length >= 3) wrap.firstChild.remove();
	const node = el('div', `toast ${kind ? `toast-${kind}` : ''}`);
	const body = el('span');
	body.append(el('strong', '', title), document.createTextNode(text ? ` ${text}` : ''));
	node.append(img(iconURL(icon), ''), body);
	wrap.append(node);
	setTimeout(() => node.remove(), 3400);
};

const modal = (title, paragraphs, actions) => {
	const overlay = $('modal');
	setText($('modal-title'), title);
	const body = $('modal-body');
	body.replaceChildren(...paragraphs.map((html) => {
		const p = el('p');
		p.innerHTML = html; // Only ever called with our own copy and formatted numbers.
		return p;
	}));
	const bar = $('modal-actions');
	bar.replaceChildren(...actions.map((a) => {
		const b = el('button', `btn${a.primary ? ' btn-ascend' : ''}`, a.label);
		b.type = 'button';
		b.addEventListener('click', () => {
			overlay.hidden = true;
			a.action();
		});
		return b;
	}));
	overlay.hidden = false;
	bar.lastChild?.focus();
};

export default class UI {
	constructor(game) {
		this.game = game;
		this.tab = 'summons';
		this.slowAcc = 1;
		this.upgradeKey = null;
		this.ownedKey = null;
		this.buffKey = null;
		this.featCount = -1;
		this.selectedFeat = null;
		this.buildTabs();
		this.buildGens();
		this.buildSpells();
		this.buildTalents();
		this.buildFeats();
		this.bindUpgrades();
		this.bindStarfall();
		this.bindTome();
		this.buildRift();
		bindTooltip();
		this.rebind();
	}

	// Active state (the trial while one runs) vs. the persistent main save.
	get s() { return this.game.state; }

	get m() { return this.game.main; }

	// Settings live on both saves so a trial inherits them; keep them in sync.
	eachState(fn) {
		fn(this.game.main);
		if (this.game.trial) fn(this.game.trial);
	}

	fmt(n) { return formatNumber(n, this.s.settings.notation); }

	// Called after a load/import/reset swaps the state object.
	rebind() {
		this.upgradeKey = null;
		this.ownedKey = null;
		this.buffKey = null;
		this.featCount = -1;
		this.slowAcc = 1;
		this.riftKey = null;
		this.ladderKey = null;
		const inRift = E.isTrial(this.s);
		document.body.classList.toggle('in-rift', inRift);
		$('rift-hud').hidden = !inRift;
		$('wizard-name').value = this.m.settings.wizardName;
		$('opt-sound').checked = this.s.settings.sound;
		$('opt-sci').checked = this.s.settings.notation === 'sci';
		$('opt-fx').checked = this.s.settings.reducedFx;
		$('autobuy').checked = this.s.settings.autoBuy;
		this.syncBuyAmount();
		this.update(0);
	}

	// Tabs ----------------------------------------------------------------
	buildTabs() {
		this.tabs = [...document.querySelectorAll('.tab')];
		this.tabs.forEach((btn) => btn.addEventListener('click', () => this.showTab(btn.dataset.tab)));
	}

	showTab(name) {
		this.tab = name;
		this.tabs.forEach((btn) => btn.setAttribute('aria-selected', String(btn.dataset.tab === name)));
		document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== `panel-${name}`; });
		this.slowAcc = 1;
		this.update(0);
	}

	// Summons -------------------------------------------------------------
	buildGens() {
		const list = $('gen-list');
		this.genRows = GENERATORS.map((g) => {
			const row = el('button', 'row-item');
			row.type = 'button';
			const icon = img(iconURL(g.id), '');
			const main = el('div');
			const name = el('div', 'row-name', g.name);
			const desc = el('div', 'row-desc', g.flavor);
			main.append(name, desc);
			const side = el('div', 'row-side');
			const owned = el('div', 'row-owned', '0');
			const cost = el('div', 'row-cost cost-mana', '');
			side.append(owned, cost);
			row.append(icon, main, side);
			row.addEventListener('click', () => {
				const amt = this.s.settings.buyAmount;
				if (E.buyGen(this.s, g.id, amt)) {
					this.game.sfx.buy();
					this.update(0);
				}
			});
			list.append(row);
			return {
				g, row, icon, name, desc, owned, cost, lockedShown: null,
			};
		});
		document.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => {
			const v = b.dataset.amount;
			this.s.settings.buyAmount = v === 'max' ? 'max' : Number(v);
			this.syncBuyAmount();
			this.update(0);
		}));
		$('autobuy').addEventListener('change', (e) => { this.s.settings.autoBuy = e.target.checked; });
	}

	syncBuyAmount() {
		document.querySelectorAll('.seg-btn').forEach((b) => {
			const v = b.dataset.amount === 'max' ? 'max' : Number(b.dataset.amount);
			b.setAttribute('aria-pressed', String(v === this.s.settings.buyAmount));
		});
	}

	updateGens() {
		const { s } = this;
		const r = E.computeRates(s);
		const total = r.baseMps || 1;
		const amt = s.settings.buyAmount;
		let revealedLocked = false;
		this.genRows.forEach((row, i) => {
			const visible = E.genVisible(s, i);
			if (!visible) {
				row.row.hidden = revealedLocked;
				if (!revealedLocked) {
					revealedLocked = true;
					if (row.lockedShown !== true) {
						row.icon.src = iconURL(row.g.id, { locked: true });
						row.lockedShown = true;
					}
					row.row.disabled = true;
					setClass(row.row, 'locked', true);
					setText(row.name, '???');
					setText(row.desc, `Summon ${article(GENERATORS[i - 1].name)} ${GENERATORS[i - 1].name} to reveal.`);
					setText(row.owned, '');
					setText(row.cost, this.fmt(row.g.baseCost * r.costMult));
				}
				return;
			}
			row.row.hidden = false;
			row.row.disabled = false;
			setClass(row.row, 'locked', false);
			if (row.lockedShown !== false) {
				row.icon.src = iconURL(row.g.id);
				row.lockedShown = false;
				row.row.title = row.g.flavor;
			}
			const owned = s.gens[row.g.id];
			setText(row.name, row.g.name);
			const each = r.perGen[row.g.id];
			const align = E.currentAlignment(s);
			const aligned = !!align?.gens.includes(row.g.id);
			setClass(row.row, 'aligned', aligned);
			const tag = aligned ? `✦ Aligned ×${this.fmt(align.mult)} · ` : '';
			setText(row.desc, owned
				? `${tag}${this.fmt(each)}/s each · ${this.fmt(each * owned)}/s (${share(each * owned, total)})`
				: `${tag}${row.g.flavor} +${this.fmt(each)}/s`);
			setText(row.owned, String(owned));
			let n = amt === 'max' ? E.maxAffordable(s, row.g.id) : amt;
			let label = '';
			if (amt === 'max') label = `×${n} `;
			else if (amt > 1) label = `×${amt} `;
			if (n === 0) n = 1;
			const cost = E.genCost(s, row.g.id, n);
			setText(row.cost, `${label}${this.fmt(cost)}`);
			const can = cost <= s.mana && (amt !== 'max' || E.maxAffordable(s, row.g.id) > 0);
			setClass(row.row, 'affordable', can);
			setClass(row.row, 'unaffordable', !can);
		});
		const steward = E.talentLevel(s, 'butler') > 0;
		$('autobuy-wrap').hidden = !steward;
	}

	// Upgrades ------------------------------------------------------------
	bindUpgrades() {
		$('buy-all').addEventListener('click', () => {
			if (E.buyAllUpgrades(this.s)) {
				this.game.sfx.upgrade();
				this.update(0);
			}
		});
	}

	updateUpgrades() {
		const { s } = this;
		const avail = E.availableUpgrades(s).sort((a, b) => a.cost - b.cost);
		const key = avail.map((u) => u.id).join(',');
		const list = $('upgrade-list');
		if (key !== this.upgradeKey) {
			this.upgradeKey = key;
			list.replaceChildren();
			this.upgradeRows = avail.map((u) => {
				const row = el('button', 'row-item');
				row.type = 'button';
				const main = el('div');
				main.append(el('div', 'row-name', u.name), el('div', 'row-desc', u.desc));
				const side = el('div', 'row-side');
				const cost = el('div', 'row-cost cost-mana', this.fmt(E.upgradeCost(s, u)));
				side.append(cost);
				row.append(img(iconURL(u.icon, { tier: u.tier }), ''), main, side);
				row.addEventListener('click', () => {
					if (E.buyUpgrade(this.s, u.id)) {
						this.game.sfx.upgrade();
						this.update(0);
					}
				});
				list.append(row);
				return { u, row, cost };
			});
			if (!avail.length) list.append(el('p', 'panel-note', 'No upgrades yet. Keep summoning and casting to reveal more.'));
		}
		let affordable = 0;
		this.upgradeRows.forEach(({ u, row, cost }) => {
			const price = E.upgradeCost(s, u);
			const can = s.mana >= price;
			if (can) affordable += 1;
			setClass(row, 'affordable', can);
			setClass(row, 'unaffordable', !can);
			setText(cost, this.fmt(price));
		});
		const badge = $('upgrade-badge');
		badge.hidden = affordable === 0;
		setText(badge, String(affordable));
		$('buy-all').disabled = affordable === 0;

		const ownedIds = Object.keys(s.upgrades);
		const ownedKey = ownedIds.join(',');
		if (ownedKey !== this.ownedKey) {
			this.ownedKey = ownedKey;
			const grid = $('owned-upgrades');
			grid.replaceChildren(...ownedIds.map((id) => {
				const u = UPGRADE_BY_ID[id];
				const i = img(iconURL(u.icon, { tier: u.tier }), u.name);
				i.dataset.tip = `${u.name}|${u.desc}`;
				return i;
			}));
			setText($('owned-count'), `· ${ownedIds.length}`);
		}
	}

	// Spells & buffs ------------------------------------------------------
	buildSpells() {
		const wrap = $('spells');
		this.spellBtns = SPELLS.map((sp) => {
			const btn = el('button', 'spell');
			btn.type = 'button';
			const cd = el('div', 'spell-cd');
			const name = el('span', 'spell-name', sp.name);
			const state = el('span', 'spell-state', '');
			const key = el('span', 'spell-key', sp.key);
			btn.append(cd, img(iconURL(sp.icon), ''), name, state, key);
			btn.dataset.tip = `${sp.name}|${sp.desc} Cooldown ${formatTime(sp.cooldown)}. Hotkey ${sp.key}.`;
			btn.addEventListener('click', () => this.game.castSpell(sp.id));
			wrap.append(btn);
			return {
				sp, btn, cd, state,
			};
		});
	}

	updateSpells() {
		const { s } = this;
		const r = E.computeRates(s);
		this.spellBtns.forEach(({
			sp, btn, cd, state,
		}) => {
			const unlocked = E.spellUnlocked(s, sp);
			const remaining = s.spells[sp.id];
			setClass(btn, 'locked', !unlocked);
			setClass(btn, 'ready', unlocked && remaining <= 0);
			btn.disabled = !unlocked || remaining > 0;
			if (!unlocked) setText(state, sp.hint);
			else if (remaining > 0) setText(state, formatTime(Math.ceil(remaining)));
			else setText(state, 'Ready');
			const pct = unlocked ? Math.min(100, (remaining / (sp.cooldown * r.cdMult)) * 100) : 0;
			cd.style.height = `${pct.toFixed(1)}%`;
		});
	}

	updateBuffs() {
		const { s } = this;
		const wrap = $('buffs');
		const align = E.currentAlignment(s);
		const key = `${align?.key}|${s.buffs.map((b) => b.id).join(',')}`;
		if (key !== this.buffKey) {
			this.buffKey = key;
			wrap.replaceChildren();
			this.alignTime = null;
			if (align) {
				const chip = el('span', 'buff buff-align');
				chip.append(el('b', '', `✦ ${align.gens.map((id) => GEN_BY_ID[id].name).join(' & ')} aligned ×${this.fmt(align.mult)}`));
				this.alignTime = el('span', '', '');
				chip.append(this.alignTime);
				chip.dataset.tip = 'Celestial Alignment|Every few minutes the sky favours one of your summons. Everyone shares the same sky.';
				wrap.append(chip);
			}
			this.buffRows = s.buffs.map((b) => {
				const chip = el('span', `buff buff-${b.kind}`);
				const label = el('b', '', `${b.name} ×${b.mult}`);
				const time = el('span', '', '');
				chip.append(label, time);
				wrap.append(chip);
				return { id: b.id, time };
			});
		}
		this.buffRows.forEach((row) => {
			const b = s.buffs.find((x) => x.id === row.id);
			if (b) setText(row.time, `${Math.ceil(b.remaining)}s`);
		});
		if (align && this.alignTime) setText(this.alignTime, formatTime(Math.max(0, (align.endsAt - Date.now()) / 1000)));
	}

	// Starfall ------------------------------------------------------------
	bindStarfall() {
		$('ascend-btn').addEventListener('click', () => this.confirmAscend());
	}

	confirmAscend() {
		const s = this.m;
		const gained = E.pendingSigils(s);
		if (gained < 1) return;
		const per = E.SIGIL_BASE_BONUS + 0.005 * E.talentLevel(s, 'resonance');
		const before = Math.round(s.sigils * per * 100);
		const after = Math.round((s.sigils + gained) * per * 100);
		modal('Ascend to the stars?', [
			`You will claim <strong>${this.fmt(gained)} Starsigils</strong>, raising your permanent bonus from +${this.fmt(before)}% to <strong>+${this.fmt(after)}%</strong>.`,
			'Mana, summons and upgrades return to the sky. Starsigils, talents and feats stay with you.',
		], [
			{ label: 'Stay a while', action: () => {} },
			{ label: 'Ascend', primary: true, action: () => this.game.ascend() },
		]);
	}

	buildTalents() {
		const grid = $('talent-grid');
		this.talentCards = TALENTS.map((t) => {
			const card = el('button', 'talent');
			card.type = 'button';
			const head = el('div', 'talent-head');
			const level = el('span', 'talent-level', '');
			head.append(el('span', 'talent-name', t.name), level);
			const desc = el('div', 'talent-desc', t.desc);
			const cost = el('div', 'talent-cost', '');
			card.append(img(iconURL(t.icon), ''), head, desc, cost);
			card.addEventListener('click', () => {
				if (E.buyTalent(this.m, t.id)) {
					this.game.sfx.upgrade();
					this.slowAcc = 1;
					this.update(0);
				}
			});
			grid.append(card);
			return {
				t, card, level, cost,
			};
		});
	}

	updateStarfall() {
		const s = this.m;
		const pending = E.pendingSigils(s);
		setText($('pending-sigils'), this.fmt(pending));
		const inRift = !!this.game.trial;
		$('ascend-btn').disabled = pending < 1 || inRift;
		setText($('ascend-btn'), inRift ? 'Sealed during a Rift run' : 'Ascend');
		$('sigil-progress').style.width = `${(E.sigilProgress(s) * 100).toFixed(1)}%`;
		const nextAt = E.lifetimeForSigils(E.sigilsForLifetime(s.lifetimeEarned) + 1);
		setText($('next-sigil'), `next at ${this.fmt(nextAt)} lifetime mana`);
		setText($('per-sigil'), `${+((E.SIGIL_BASE_BONUS + 0.005 * E.talentLevel(s, 'resonance')) * 100).toFixed(1)}%`);
		setText($('unspent'), this.fmt(E.unspentSigils(s)));
		const unspent = E.unspentSigils(s);
		this.talentCards.forEach(({
			t, card, level, cost,
		}) => {
			const lvl = E.talentLevel(s, t.id);
			const maxed = lvl >= t.max;
			const reqOk = E.talentRequirementsMet(s, t);
			const price = E.talentCost(t, lvl);
			setText(level, `${lvl}/${t.max}`);
			if (maxed) setText(cost, 'Mastered');
			else if (!reqOk) {
				setText(cost, `Requires ${t.requires.map(([id, n]) => `${TALENT_BY_ID[id].name} ${n}`).join(', ')}`);
			} else setText(cost, `✦ ${this.fmt(price)} Starsigil${price === 1 ? '' : 's'}`);
			setClass(card, 'maxed', maxed);
			setClass(card, 'locked', !maxed && !reqOk);
			const can = !maxed && reqOk && unspent >= price;
			setClass(card, 'affordable', can);
			setClass(card, 'unaffordable', !maxed && reqOk && !can);
			card.disabled = !can;
		});
	}

	// Feats ---------------------------------------------------------------
	buildFeats() {
		const grid = $('feat-grid');
		this.featBtns = ACHIEVEMENTS.map((a) => {
			const btn = el('button');
			btn.type = 'button';
			const i = img(iconURL(a.icon, { locked: true }), a.name);
			btn.append(i);
			btn.addEventListener('click', () => {
				this.selectedFeat = a.id;
				this.featCount = -1;
				this.updateFeats();
			});
			grid.append(btn);
			return {
				a, btn, i, earned: null,
			};
		});
	}

	updateFeats() {
		const s = this.m;
		const count = Object.keys(s.achievements).length;
		if (count === this.featCount) return;
		this.featCount = count;
		setText($('feat-count'), `${count} / ${ACHIEVEMENTS.length}`);
		this.featBtns.forEach((f) => {
			const earned = !!s.achievements[f.a.id];
			if (earned !== f.earned) {
				f.earned = earned;
				f.i.src = iconURL(f.a.icon, { locked: !earned, tier: earned ? 1 : null });
				setClass(f.btn, 'earned', earned);
			}
			f.btn.dataset.tip = earned ? `${f.a.name}|${f.a.desc}` : `Locked feat|${f.a.desc}`;
			setClass(f.btn, 'selected', f.a.id === this.selectedFeat);
		});
		const sel = this.featBtns.find((f) => f.a.id === this.selectedFeat);
		if (sel) {
			const detail = $('feat-detail');
			detail.replaceChildren(el('strong', '', sel.earned ? sel.a.name : 'Locked feat'), document.createTextNode(` · ${sel.a.desc}`));
		}
	}

	// Tome ------------------------------------------------------------------
	bindTome() {
		const { game } = this;
		$('opt-sound').addEventListener('change', (e) => {
			this.eachState((st) => { st.settings.sound = e.target.checked; });
			game.sfx.enabled = e.target.checked;
		});
		$('opt-sci').addEventListener('change', (e) => {
			this.eachState((st) => { st.settings.notation = e.target.checked ? 'sci' : 'short'; });
			this.upgradeKey = null;
			this.slowAcc = 1;
			this.update(0);
		});
		$('opt-fx').addEventListener('change', (e) => {
			this.eachState((st) => { st.settings.reducedFx = e.target.checked; });
			game.scene.reducedFx = e.target.checked;
		});
		const msg = (text) => setText($('save-msg'), text);
		$('export-btn').addEventListener('click', () => {
			game.save();
			const text = E.encodeSave(this.m);
			const area = $('save-text');
			area.value = text;
			const fallback = () => {
				area.focus();
				area.select();
				msg('Save selected. Copy it with your keyboard or long-press.');
			};
			try {
				navigator.clipboard.writeText(text).then(() => msg('Save copied to clipboard.'), fallback);
			} catch {
				fallback();
			}
		});
		$('import-btn').addEventListener('click', () => {
			const text = $('save-text').value.trim();
			if (!text) {
				msg('Paste a save into the box first.');
				return;
			}
			try {
				game.replaceState(E.decodeSave(text));
				msg('Save loaded.');
			} catch {
				msg('That text is not a Starfall Spire save. Check that the whole scroll was pasted.');
			}
		});
		const reset = $('reset-btn');
		let armTimer = null;
		reset.addEventListener('click', () => {
			if (!reset.classList.contains('armed')) {
				reset.classList.add('armed');
				reset.textContent = 'Click again to erase';
				armTimer = setTimeout(() => {
					reset.classList.remove('armed');
					reset.textContent = 'Erase everything';
				}, 4000);
				return;
			}
			clearTimeout(armTimer);
			reset.classList.remove('armed');
			reset.textContent = 'Erase everything';
			game.replaceState(E.createState());
			msg('All progress erased. A new apprentice arrives.');
		});
		this.statRows = [
			['Mana this ascension', (s) => this.fmt(s.runEarned)],
			['Lifetime mana', (s) => this.fmt(s.lifetimeEarned)],
			['Mana per second', (s) => this.fmt(E.manaPerSecond(s))],
			['Best mana per second', (s) => this.fmt(s.stats.bestMps)],
			['Cast power', (s) => this.fmt(E.clickPower(s))],
			['Casts by hand', (s) => this.fmt(s.stats.clicks)],
			['Automancy casts', (s) => this.fmt(s.stats.autoCasts)],
			['Mana from casting', (s) => this.fmt(s.stats.clickMana)],
			['Fireballs', (s) => this.fmt(s.stats.fireballs)],
			['Wisps caught', (s) => this.fmt(s.stats.wispsCaught)],
			['Spells cast', (s) => this.fmt(s.stats.spellsCast)],
			['Summons owned', (s) => this.fmt(E.totalGens(s))],
			['Upgrades bought (all time)', (s) => this.fmt(s.stats.upgradesBought)],
			['Ascensions', (s) => this.fmt(s.stats.ascensions)],
			['Starsigils (spent)', (s) => `${this.fmt(s.sigils)} (${this.fmt(s.sigilsSpent)})`],
			['Rift runs finished', (s) => this.fmt(s.stats.trials)],
			['Best rift tier', (s) => (s.stats.bestTier >= 0 ? R.TIERS[s.stats.bestTier].name : 'None yet')],
			['Astral Shards', (s) => this.fmt(s.shards)],
			['Feat bonus', (s) => `+${Object.keys(s.achievements).length}%`],
			['This ascension', (s) => formatTime((Date.now() - s.stats.runStart) / 1000)],
			['Since the first spark', (s) => formatTime((Date.now() - s.stats.gameStart) / 1000)],
		].map(([label, fn]) => {
			const dt = el('dt', '', label);
			const dd = el('dd', '', '');
			$('stats').append(dt, dd);
			return { dd, fn };
		});
	}

	updateStats() {
		this.statRows.forEach(({ dd, fn }) => setText(dd, fn(this.m)));
	}

	// Tooltip ---------------------------------------------------------------

	// Toasts & modal --------------------------------------------------------

	wispToast(result) {
		const detail = result.effect === 'windfall' ? `+${this.fmt(result.amount)} mana` : WISP_TEXT[result.effect];
		toast('wisp', result.name, detail);
	}

	showOffline(report) {
		const pct = Math.round(report.efficiency * 100);
		const capped = report.seconds < report.elapsed;
		modal('While you slept…', [
			`Your familiars kept the spire humming for <strong>${formatTime(report.elapsed)}</strong>${capped ? ` (dreams last ${formatTime(report.seconds)})` : ''}.`,
			`They gathered <strong>${this.fmt(report.amount)} mana</strong> at ${pct}% efficiency.`,
		], [{ label: 'Collect', primary: true, action: () => {} }]);
	}

	// Rift ------------------------------------------------------------------
	buildRift() {
		$('rift-enter').addEventListener('click', () => {
			if (this.game.trial) this.showTab('summons');
			else this.game.enterRift();
		});
		$('hud-leave').addEventListener('click', () => this.confirmEndRun());
		$('wizard-name').addEventListener('input', (e) => {
			this.m.settings.wizardName = e.target.value.replace(/[^\p{L}\p{N} '_.-]/gu, '').slice(0, 24);
			this.ladderKey = null;
		});
		const grid = $('relic-grid');
		this.relicCards = RELICS.map((relic) => {
			const card = el('button', 'talent relic');
			card.type = 'button';
			const head = el('div', 'talent-head');
			const status = el('span', 'talent-level', '');
			head.append(el('span', 'talent-name', relic.name), status);
			const cost = el('div', 'talent-cost', '');
			card.append(img(iconURL(relic.icon, { tier: 5 }), ''), head, el('div', 'talent-desc', relic.desc), cost);
			card.addEventListener('click', () => {
				const ok = this.m.relics[relic.id] ? E.toggleRelic(this.m, relic.id) : E.buyRelic(this.m, relic.id);
				if (ok) {
					this.game.sfx.buy();
					this.game.save();
					this.updateRift();
				}
			});
			grid.append(card);
			return {
				relic, card, status, cost,
			};
		});
	}

	updateRiftBadge() {
		const badge = $('rift-badge');
		const rift = this.game.currentRift();
		const played = this.m.riftRecords[rift.id]?.attempts > 0;
		badge.hidden = played && !this.game.trial;
		setText(badge, this.game.trial ? 'LIVE' : '!');
	}

	updateRift() {
		const { m } = this;
		const now = Date.now();
		const rift = this.game.currentRift();
		if (this.riftKey !== rift.id) {
			this.riftKey = rift.id;
			setText($('rift-name'), rift.name);
			$('rift-mutators').replaceChildren(...rift.mutators.map((id) => {
				const chip = el('div', 'mutator');
				chip.append(el('strong', '', MUTATOR_BY_ID[id].name), el('span', '', MUTATOR_BY_ID[id].desc));
				return chip;
			}));
			this.ladderKey = null;
		}
		setText($('rift-week'), `${rift.id} · new rift in ${formatTime((rift.end - now) / 1000)}`);
		const rec = m.riftRecords[rift.id];
		setText($('rift-best'), rec ? `Best ${this.fmt(rec.best)} · ${rec.attempts} run${rec.attempts === 1 ? '' : 's'}` : 'Your first run this week earns +1 shard');
		setText($('rift-enter'), this.game.trial ? 'Back to your run' : 'Enter the Rift');

		// Rival echoes cost ~0.1s to simulate; defer so the tab paints first.
		const ladderKey = `${rift.id}|${rec?.best || 0}|${m.settings.wizardName}`;
		if (ladderKey !== this.ladderKey) {
			this.ladderKey = ladderKey;
			setTimeout(() => this.renderLadder(rift, rec), 0);
		}

		setText($('shards'), this.fmt(m.shards));
		this.relicCards.forEach(({
			relic, card, status, cost,
		}) => {
			const owned = !!m.relics[relic.id];
			const equipped = m.equipped.includes(relic.id);
			setText(status, equipped ? 'Equipped' : '');
			if (!owned) setText(cost, `◈ ${relic.cost} Astral Shards`);
			else setText(cost, equipped ? 'Equipped · click to remove' : `Owned · click to equip (${m.equipped.length}/${E.MAX_EQUIPPED})`);
			setClass(card, 'maxed', equipped);
			const can = owned ? (equipped || m.equipped.length < E.MAX_EQUIPPED) : m.shards >= relic.cost;
			setClass(card, 'affordable', can && !equipped);
			setClass(card, 'unaffordable', !can);
			card.disabled = !can;
		});
	}

	async renderLadder(rift, rec) {
		const { rivals, thresholds } = this.game.rivals(rift);
		const sorted = [...rivals].sort((a, b) => a.score - b.score);
		$('rift-tiers').replaceChildren(...R.TIERS.map((tier, i) => {
			const claimed = !!rec?.claimed.includes(i);
			const card = el('div', `tier tier-${tier.name.toLowerCase()}${claimed ? ' claimed' : ''}`);
			card.append(
				el('strong', '', `${tier.name}${claimed ? ' ✓' : ''}`),
				el('span', '', `Beat ${sorted[tier.rank].name}`),
				el('span', 'tier-score', this.fmt(thresholds[i])),
				el('span', 'tier-reward', `+${tier.shards} ◈`),
			);
			return card;
		}));
		const you = { name: this.m.settings.wizardName || 'You', score: rec?.best || 0 };
		const standings = await this.game.leaderboard.standings(rift, you);
		$('rift-ladder').replaceChildren(...standings.map((row) => {
			const li = el('li', row.you ? 'you' : '');
			li.append(
				el('span', 'ladder-name', row.you && this.m.settings.wizardName ? `${row.name} (you)` : row.name),
				el('span', 'ladder-score', row.you && !rec ? 'no run yet' : this.fmt(row.score)),
			);
			return li;
		}));
	}

	updateHud() {
		const t = this.game.trial;
		const left = R.trialRemaining(t, Date.now());
		setText($('hud-name'), t.trial.name);
		setText($('hud-time'), `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`);
		setClass($('hud-time'), 'urgent', left < 60);
		setText($('hud-score'), this.fmt(t.runEarned));
		const cached = this.game.rivalCache.get(t.trial.id);
		if (!cached) {
			setText($('hud-next'), '');
			return;
		}
		const next = cached.thresholds.findIndex((min) => t.runEarned < min);
		setText($('hud-next'), next < 0 ? 'Astral reached!' : `${R.TIERS[next].name} at ${this.fmt(cached.thresholds[next])}`);
	}

	confirmEndRun() {
		const t = this.game.trial;
		if (!t) return;
		modal('End the run now?', [
			`Your score of <strong>${this.fmt(t.runEarned)}</strong> counts toward this week's rewards. You can run the rift as often as you like; only your best counts.`,
		], [
			{ label: 'Keep going', action: () => {} },
			{ label: 'End run', primary: true, action: () => this.game.endRift() },
		]);
	}

	showTrialResult(trial, result, standings) {
		const rank = standings.findIndex((row) => row.you) + 1;
		const lines = [
			`You gathered <strong>${this.fmt(result.score)} mana</strong> in ${trial.name}${result.newBest ? ', a new personal best' : ''}.`,
			`That places you <strong>#${rank} of ${standings.length}</strong> on the echo ladder.`,
		];
		if (result.newTiers.length) lines.push(`Tiers claimed: <strong>${result.newTiers.map((i) => R.TIERS[i].name).join(', ')}</strong>.`);
		if (result.shards) lines.push(`You earned <strong>${result.shards} Astral Shard${result.shards === 1 ? '' : 's'}</strong>. Spend them in the Relic vault.`);
		else lines.push('No new rewards this run. Beat the next echo to claim its tier.');
		modal('The rift seals', lines, [
			{ label: 'Back to the spire', action: () => {} },
			{ label: 'View ladder', primary: true, action: () => this.showTab('rift') },
		]);
	}

	// Frame -----------------------------------------------------------------
	update(dt) {
		const { s } = this;
		const mps = E.manaPerSecond(s);
		setText($('mana'), this.fmt(Math.floor(s.mana)));
		const prodBuff = E.buffMult(s, 'prod');
		setText($('mps'), `${this.fmt(mps)} / sec${prodBuff > 1 ? ` · ×${this.fmt(prodBuff)}` : ''}`);
		setText($('sigils'), this.fmt(this.m.sigils));
		setText($('sigil-bonus'), `+${this.fmt(Math.round((E.computeRates(this.m).sigilMult - 1) * 100))}% power`);
		const pending = E.pendingSigils(this.m);
		const sigilBadge = $('sigil-badge');
		sigilBadge.hidden = pending < 1;
		setText(sigilBadge, this.fmt(pending));
		$('focus-fill').style.width = `${Math.min(100, s.focus * 100).toFixed(1)}%`;
		setText($('focus-pct'), `${Math.floor(s.focus * 100)}%`);
		$('scene-hint').hidden = s.stats.clicks >= 5;
		this.updateSpells();
		this.updateBuffs();
		this.updateUpgrades();
		if (this.tab === 'summons') this.updateGens();
		if (this.game.trial) this.updateHud();

		this.slowAcc += dt;
		if (this.slowAcc >= 0.5) {
			this.slowAcc = 0;
			if (this.tab !== 'summons') this.updateGens();
			this.updateStarfall();
			this.updateFeats();
			this.updateRiftBadge();
			if (this.tab === 'rift') this.updateRift();
			if (this.tab === 'tome') this.updateStats();
		}
	}
}
