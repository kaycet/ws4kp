// Bundles the game into dist/ for deployment:
//   dist/index.html        the multi-file site, copied as-is
//   dist/starfall-spire.html  a single self-contained file (CSS + all modules
//                          inlined) for itch.io, embeds, or offline play.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ORDER = ['format', 'data', 'sprites', 'engine', 'rift', 'scene', 'audio', 'ui', 'main'];

// Turn each ES module into a scoped IIFE registered on __m, rewriting local
// imports/exports. Only handles the import/export forms this codebase uses.
const bundleModules = () => {
	const found = fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.mjs')).map((f) => f.replace('.mjs', ''));
	const missing = found.filter((m) => !ORDER.includes(m));
	if (missing.length) throw new Error(`Add ${missing.join(', ')} to ORDER in scripts/build.mjs`);
	const out = ['const __m = {};'];
	ORDER.forEach((name) => {
		let src = fs.readFileSync(path.join(root, 'js', `${name}.mjs`), 'utf8');
		src = src.replace(/import\s+([\s\S]*?)\s+from\s+'\.\/(\w+)\.mjs';/g, (_, spec, mod) => {
			const s = spec.trim();
			if (s.startsWith('* as ')) return `const ${s.slice(5).trim()} = __m.${mod};`;
			const m = s.match(/^(\w+)?\s*,?\s*(\{[\s\S]*\})?$/);
			const parts = [];
			if (m[1]) parts.push(`default: ${m[1]}`);
			if (m[2]) parts.push(m[2].slice(1, -1).replace(/\s+/g, ' ').trim().replace(/,$/, ''));
			return `const { ${parts.join(', ')} } = __m.${mod};`;
		});
		const exported = [];
		src = src.replace(/export\s+(default\s+)?(const|class|function|async function)\s+(\w+)/g, (_, def, kind, id) => {
			exported.push(def ? `default: ${id}` : id);
			return `${kind} ${id}`;
		});
		if (/^\s*(import|export)\s/m.test(src)) throw new Error(`Unsupported import/export form in ${name}.mjs`);
		out.push(`__m.${name} = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();`);
	});
	return out.join('\n');
};

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
['index.html', 'css', 'js'].forEach((p) => fs.cpSync(path.join(root, p), path.join(dist, p), { recursive: true }));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const single = html
	.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`)
	.replace('<script type="module" src="js/main.mjs"></script>', () => `<script type="module">\n${bundleModules()}\n</script>`);
fs.writeFileSync(path.join(dist, 'starfall-spire.html'), single);
console.log(`dist/starfall-spire.html ${(single.length / 1024).toFixed(1)} KB`);
