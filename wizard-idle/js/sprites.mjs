// Palette-indexed ASCII sprites, rasterised once into offscreen canvases.
// '.' is transparent; every other character maps to a palette colour.

export const PALETTE = {
	k: '#0d0a1e',
	K: '#251c45',
	p: '#3d2a78',
	P: '#6246c9',
	L: '#9e84ff',
	b: '#22407e',
	B: '#3f7fe0',
	c: '#45d0e8',
	C: '#b8f6ff',
	w: '#efe3c2',
	W: '#ffffff',
	s: '#f3c9a0',
	S: '#c48b62',
	y: '#f2c14e',
	Y: '#fff08a',
	o: '#e0843a',
	r: '#b83a3a',
	R: '#ff6b5a',
	g: '#2f7a45',
	G: '#74d06b',
	n: '#5e3d24',
	N: '#9a6b3c',
	d: '#3d3854',
	D: '#6e6788',
	e: '#aaa3c4',
	m: '#d45ad4',
};

export const SPRITES = {
	wizard: [[
		'.......kk.......',
		'......kPLk......',
		'.....kPPLk......',
		'.....kPyPPk.....',
		'....kPPPPPk.....',
		'....kPPPPPPk....',
		'..kkkkkkkkkkkk..',
		'....kssssssk....',
		'....kskssksk....',
		'....kwssssSw....',
		'...kwwwwwwwwk...',
		'..kPkwwwwwwkPk..',
		'..kPPkwwwwkPPk..',
		'.kPPPPkwwkPPPPk.',
		'.ksPPPPkkPPPPsk.',
		'.kkPPPPPPPPPPkk.',
		'...kPPPyPPPPk...',
		'...kPPPPPPPPk...',
		'..kPPPPPPyPPPk..',
		'..kPPPPPPPPPPk..',
		'.kpPPPPPPPPPPpk.',
		'.kkkkkkkkkkkkkk.',
	]],
	apprentice: [[
		'...kk...',
		'..kBBk..',
		'.kBByBk.',
		'kkkkkkkk',
		'.kskskk.',
		'.kssssk.',
		'kBBssBBk',
		'kBBBBBBk',
		'ksBBBBsk',
		'.kBBBBk.',
		'.kk..kk.',
	], [
		'...kk...',
		'..kBBk..',
		'.kBByBk.',
		'kkkkkkkk',
		'.kskskk.',
		'.kssssk.',
		'kBBssBBk',
		'kBBBBBBk',
		'ksBBBBsk',
		'.kBBBBk.',
		'..kkkk..',
	]],
	owl: [[
		'k......k',
		'kNk..kNk',
		'kNNNNNNk',
		'kWkNNkWk',
		'kNNooNNk',
		'knNNNNnk',
		'.knwwnk.',
		'.kykkyk.',
	], [
		'k......k',
		'kNk..kNk',
		'kNNNNNNk',
		'kWkNNkWk',
		'nNNooNNn',
		'nnNNNNnn',
		'.knwwnk.',
		'..k..k..',
	]],
	candle: [[
		'..y..',
		'.yYy.',
		'.oYo.',
		'..o..',
		'.kwk.',
		'.kwk.',
		'.kwk.',
		'.kwk.',
		'kyyyk',
		'kkkkk',
	], [
		'.y...',
		'.yYy.',
		'..Yo.',
		'..o..',
		'.kwk.',
		'.kwk.',
		'.kwk.',
		'.kwk.',
		'kyyyk',
		'kkkkk',
	]],
	cauldron: [[
		'....G...G...',
		'..G.GG.GGG..',
		'kkkkkkkkkkkk',
		'kdGGGGGGGGdk',
		'.kddddddddk.',
		'kdDdddddddDk',
		'kdDddddddddk',
		'kddddddddddk',
		'.kddddddddk.',
		'..kk....kk..',
	], [
		'......G.....',
		'.G.GGG..GG..',
		'kkkkkkkkkkkk',
		'kdGGGGGGGGdk',
		'.kddddddddk.',
		'kdDdddddddDk',
		'kdDddddddddk',
		'kddddddddddk',
		'.kddddddddk.',
		'..kk....kk..',
	]],
	shelf: [[
		'kkkkkkkkkkkk',
		'knNNNNNNNNnk',
		'knrbygPrbgnk',
		'knrbygPrbgnk',
		'knrbygPrbgnk',
		'knnnnnnnnnnk',
		'knyPgrbyPrnk',
		'knyPgrbyPrnk',
		'knyPgrbyPrnk',
		'knnnnnnnnnnk',
		'kncgyPrbcynk',
		'kncgyPrbcynk',
		'knnnnnnnnnnk',
		'kkkkkkkkkkkk',
	]],
	golem: [[
		'...kkkkkk...',
		'..kDDDDDDk..',
		'..kDcDDcDk..',
		'..kDDDDDDk..',
		'kkkkDDDDkkkk',
		'kDDDDccDDDDk',
		'kDDDDcCDDDDk',
		'kDkDDDDDDkDk',
		'kDkDDDDDDkDk',
		'kekkDDDDkkek',
		'...kDDDDk...',
		'..kDDkkDDk..',
		'..kDDk.kDDk.',
		'..kkkk.kkkk.',
	], [
		'...kkkkkk...',
		'..kDDDDDDk..',
		'..kDcDDcDk..',
		'..kDDDDDDk..',
		'kkkkDDDDkkkk',
		'kDDDDccDDDDk',
		'kDDDDcCDDDDk',
		'kDkDDDDDDkDk',
		'kDkDDDDDDkDk',
		'kekkDDDDkkek',
		'...kDDDDk...',
		'..kDDkkDDk..',
		'.kDDk..kDDk.',
		'.kkkk..kkkk.',
	]],
	crystal: [[
		'...k...',
		'..kCk..',
		'..kCck.',
		'.kCcck.',
		'.kCccck',
		'kCCccck',
		'kCccbck',
		'kCccbck',
		'kCccbck',
		'.kCcbk.',
		'.kCcbk.',
		'..kcbk.',
		'..kbk..',
		'...k...',
	]],
	dragon: [[
		'......kk............',
		'.....krRk...........',
		'....krRRk...........',
		'...krRRrk.......kk..',
		'..krRrrrk......krRk.',
		'k.krrrrrrkkkkkkrryRk',
		'krkrrrrrrrrrrrrrrrrk',
		'.krrRRRRRRRRRrrrkkk.',
		'..kkrrRRRRRRrrrk....',
		'....kkrk..krkkk.....',
		'.....kk....kk.......',
	], [
		'....................',
		'....................',
		'....................',
		'.......kkkk.....kk..',
		'....kkkrRRrk...krRk.',
		'k.kkrrrrrrkkkkkrryRk',
		'krkrrrrrrrrrrrrrrrrk',
		'.krrRRRRRRRRRrrrkkk.',
		'..kkrrRRkrRRrrrk....',
		'....kkrkkrrk.kk.....',
		'.....kk.krk.........',
	]],
	observatory: [[
		'.....kkkkkk.....',
		'...kkeeeekkk.kk.',
		'..keeeeekcckkck.',
		'.keeeeeekcCkck..',
		'.keeeeeeekkck...',
		'kkkkkkkkkkkkkkkk',
		'kDDDDDDDDDDDDDDk',
		'kDdDDDDyyDDDDdDk',
		'kDdDDDDyyDDDDdDk',
		'kDdDDDDkkDDDDdDk',
		'kDdDDDDkkDDDDdDk',
		'kDDDDDDkkDDDDDDk',
		'kkkkkkkkkkkkkkkk',
	]],
	portal: [[
		'...kkkk...',
		'..kmmmmk..',
		'.kmPPPPmk.',
		'kmPpkkpPmk',
		'kmPkKKkPmk',
		'kmPkKKkPmk',
		'kmPkKKkPmk',
		'kmPpkkpPmk',
		'.kmPPPPmk.',
		'..kmmmmk..',
		'...kkkk...',
	]],
	loom: [[
		'kkkkkkkkkk',
		'knNNNNNNnk',
		'.kyyyyyyk.',
		'..kyyyyk..',
		'...kyyk...',
		'....kk....',
		'...kCyk...',
		'..kCCyyk..',
		'.kCyyyyyk.',
		'knNNNNNNnk',
		'kkkkkkkkkk',
	]],
	genesis: [[
		'...kkkkk...',
		'..kDDDDDk..',
		'.kDDyDDDDk.',
		'kDDDyDDDDDk',
		'kDyyyyyyDDk',
		'kDDDyDDyDDk',
		'kDDDyDyDDDk',
		'kDDDyyDDDDk',
		'.kDDyDDDDk.',
		'..kDDDDDk..',
		'...kkkkk...',
	]],
	wand: [[
		'........Y.',
		'.......YyY',
		'......kyY.',
		'.....knk..',
		'....knk...',
		'...knk....',
		'..knk.....',
		'.knk......',
		'knk.......',
		'kk........',
	]],
	star: [[
		'....y....',
		'....y....',
		'...yYy...',
		'yyyYWYyyy',
		'.yyYYYyy.',
		'..yYYYy..',
		'..yy.yy..',
		'.yy...yy.',
		'y.......y',
	]],
	surge: [[
		'....kkkk',
		'...kYYk.',
		'..kYYk..',
		'.kYYkkk.',
		'kYYYYYk.',
		'kkkYYk..',
		'..kYk...',
		'.kYk....',
		'.kk.....',
	]],
	frenzy: [[
		'c...c...c',
		'.c..c..c.',
		'..cCCCc..',
		'cccCWCccc',
		'..cCCCc..',
		'.c..c..c.',
		'c...c...c',
	]],
	wisp: [[
		'..YYY..',
		'.YWWWY.',
		'YWWWWWY',
		'YWWWWWY',
		'YWWWWWY',
		'.YWWWY.',
		'..YYY..',
	]],
	flame: [[
		'...r...',
		'..rR...',
		'..rRr..',
		'.rRoRr.',
		'.roYoRr',
		'rRoYYor',
		'roYYYor',
		'.roYor.',
		'..rrr..',
	]],
	sigil: [[
		'....C....',
		'...CcC...',
		'..CcWcC..',
		'CCcWWWcCC',
		'.CcWWWcC.',
		'..CcWcC..',
		'..Cc.cC..',
		'.Cc...cC.',
		'C.......C',
	]],
	trophy: [[
		'.kkkkkkk.',
		'kyYYYYYyk',
		'kykYYYkyk',
		'.kyYYYyk.',
		'..kyyyk..',
		'...kyk...',
		'...kyk...',
		'..kyyyk..',
		'.kkkkkkk.',
	]],
	moon: [[
		'..kkkk..',
		'.kwwwkk.',
		'kwwwk...',
		'kwwk....',
		'kwwk....',
		'kwwwk...',
		'.kwwwkk.',
		'..kkkk..',
	]],
	lock: [[
		'..kkk..',
		'.kD.Dk.',
		'.kD.Dk.',
		'kkkkkkk',
		'kDDyDDk',
		'kDDkDDk',
		'kDDDDDk',
		'kkkkkkk',
	]],
};

const cache = new Map();
const textCache = new Map();

const makeCanvas = (w, h) => {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	return c;
};

// Rasterise a sprite frame, optionally mirrored or recoloured as a silhouette.
export const spriteCanvas = (key, frame = 0, { flip = false, tint = null } = {}) => {
	const cacheKey = `${key}|${frame}|${flip}|${tint}`;
	if (cache.has(cacheKey)) return cache.get(cacheKey);
	const frames = SPRITES[key] || SPRITES.star;
	const rows = frames[frame % frames.length];
	const w = Math.max(...rows.map((r) => r.length));
	const h = rows.length;
	const c = makeCanvas(w, h);
	const ctx = c.getContext('2d');
	rows.forEach((row, y) => {
		[...row].forEach((ch, x) => {
			const col = PALETTE[ch];
			if (!col) return;
			ctx.fillStyle = tint || col;
			ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1);
		});
	});
	cache.set(cacheKey, c);
	return c;
};

export const TIER_COLORS = ['#9e84ff', '#f2c14e', '#b8f6ff', '#ff7a4d', '#74d06b', '#d45ad4', '#6fe3f2', '#ffffff', '#ff6b5a', '#fff08a'];

// Framed square icon as a data URL, cached; used by the DOM panels.
const iconCache = new Map();
export const iconURL = (key, { tier = null, locked = false } = {}) => {
	const cacheKey = `${key}|${tier}|${locked}`;
	if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);
	const src = spriteCanvas(key, 0, { tint: locked ? '#2c2450' : null });
	const size = Math.max(src.width, src.height) + 4;
	const c = makeCanvas(size, size);
	const ctx = c.getContext('2d');
	if (tier !== null) {
		ctx.fillStyle = TIER_COLORS[tier % TIER_COLORS.length];
		ctx.fillRect(0, size - 2, size, 1);
		ctx.fillRect(0, 1, 1, 1);
		ctx.fillRect(size - 1, 1, 1, 1);
	}
	ctx.drawImage(src, Math.floor((size - src.width) / 2), Math.floor((size - src.height) / 2));
	const url = c.toDataURL();
	iconCache.set(cacheKey, url);
	return url;
};

// 3x5 pixel font for in-scene text (floating numbers, callouts).
const GLYPHS = {
	0: '111101101101111',
	1: '010110010010111',
	2: '111001111100111',
	3: '111001111001111',
	4: '101101111001001',
	5: '111100111001111',
	6: '111100111101111',
	7: '111001010010010',
	8: '111101111101111',
	9: '111101111001111',
	A: '010101111101101',
	B: '110101110101110',
	C: '011100100100011',
	D: '110101101101110',
	E: '111100110100111',
	F: '111100110100100',
	G: '011100101101011',
	H: '101101111101101',
	I: '111010010010111',
	J: '001001001101010',
	K: '101101110101101',
	L: '100100100100111',
	M: '101111111101101',
	N: '110101101101101',
	O: '010101101101010',
	P: '110101110100100',
	Q: '010101101110011',
	R: '110101110101101',
	S: '011100010001110',
	T: '111010010010010',
	U: '101101101101111',
	V: '101101101101010',
	W: '101101111111101',
	X: '101101010101101',
	Y: '101101010010010',
	Z: '111001010100111',
	'+': '000010111010000',
	'-': '000000111000000',
	'.': '000000000000010',
	'!': '010010010000010',
	'×': '000101010101000',
	' ': '000000000000000',
	'/': '001001010100100',
	'%': '101001010100101',
};

export const textWidth = (text) => text.length * 4 - 1;

// Pre-render a text label (with a dark drop outline) to a canvas.
export const textCanvas = (text, color) => {
	const str = text.toUpperCase();
	const cacheKey = `${str}|${color}`;
	if (textCache.has(cacheKey)) return textCache.get(cacheKey);
	const c = makeCanvas(textWidth(str) + 2, 7);
	const ctx = c.getContext('2d');
	const paint = (ox, oy, fill) => {
		ctx.fillStyle = fill;
		[...str].forEach((ch, i) => {
			const g = GLYPHS[ch] || GLYPHS[' '];
			for (let b = 0; b < 15; b += 1) {
				if (g[b] === '1') ctx.fillRect(ox + i * 4 + (b % 3), oy + Math.floor(b / 3), 1, 1);
			}
		});
	};
	paint(1, 1, PALETTE.k);
	paint(2, 1, PALETTE.k);
	paint(1, 2, PALETTE.k);
	paint(2, 2, PALETTE.k);
	paint(1, 1, color);
	if (textCache.size > 400) textCache.clear();
	textCache.set(cacheKey, c);
	return c;
};
