// Génère data/units.json et data/official-rules.json depuis un clone local de BSData/wh40k-11e.
// Usage : node tools/build-units.js /chemin/vers/wh40k-11e
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const BSX = require('../js/bsdata.js');
const src = process.argv[2];
const root = path.join(__dirname, '..');
const lists = JSON.parse(fs.readFileSync(path.join(root, 'data/lists/index.json'))).lists
  .map(l => JSON.parse(fs.readFileSync(path.join(root, 'data/lists', l.file))));
const want = {};
lists.forEach(l => l.units.forEach(u => (u.datasheets || []).forEach(d => { want[d.name] = d.source; })));
const files = [...new Set(Object.values(want))];
const gsFile = 'Warhammer 40,000.json';
const load = f => JSON.parse(fs.readFileSync(path.join(src, f)));
const gs = load(gsFile);
const units = {};
files.forEach(f => {
  const idx = BSX.buildIndex([load(f), gs]);
  Object.keys(want).filter(n => want[n] === f).forEach(n => {
    const u = BSX.extractUnit(idx, n);
    if (!u) { console.error('INTROUVABLE', n, 'dans', f); return; }
    u.source = f; units[n] = u;
  });
});
let sha = '', date = '';
try { sha = execSync('git -C "' + src + '" rev-parse HEAD').toString().trim(); date = execSync('git -C "' + src + '" log -1 --format=%cI').toString().trim(); } catch (e) {}
const meta = { repo: BSX.REPO, sha, date, gameSystem: gsFile };
fs.writeFileSync(path.join(root, 'data/units.json'), JSON.stringify({ meta, units }, null, 1));
fs.writeFileSync(path.join(root, 'data/official-rules.json'), JSON.stringify({ meta, rules: BSX.extractRules(gs) }, null, 1));
console.log('OK', Object.keys(units).length, 'fiches', sha.slice(0, 7), date);
