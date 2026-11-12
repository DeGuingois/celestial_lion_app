/* Celestial Lions – Fiche de jeu.
   L'app affiche la liste choisie à partir des données de data/ :
   - rules.json (commun), detachments.json, lists/*.json (tes choix),
   - units.json + official-rules.json (générés depuis BSData, mis à jour par le bouton). */
(function () {
  'use strict';
  var K_LIST = 'cl-list', K_OVR = 'cl-bsdata', K_CHECK = 'cl-lastcheck';
  var D = {};               // données chargées
  var PAGES = [
    ['tour', 'Tour de jeu'], ['plan', 'Plan de jeu'], ['scenarios', 'Scénarios'], ['doctrines', 'Doctrines'],
    ['detachements', 'Détachements'], ['ameliorations', 'Améliorations'], ['strats', 'Stratagèmes'],
    ['unites', 'Unités'], ['mots-cles', 'Mots-clés']
  ];
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- utilitaires ---------- */
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function slug(t) { return String(t).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function md(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\^\^(.+?)\^\^/g, '$1').replace(/\n/g, '<br>'); }
  function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + ' : ' + r.status); return r.json(); }); }
  function frDate(iso) { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return iso; } }

  /* ---------- chargement ---------- */
  function load() {
    return Promise.all(['data/rules.json', 'data/detachments.json', 'data/units.json', 'data/official-rules.json', 'data/lists/index.json'].map(getJSON))
      .then(function (r) {
        D.rules = r[0]; D.det = r[1]; D.base = r[2]; D.official = r[3]; D.index = r[4];
        D.units = D.base.units; D.offRules = D.official.rules; D.meta = D.base.meta;
        var o = store(K_OVR);
        if (o && o.meta && (!D.meta.date || o.meta.date > D.meta.date)) {
          D.units = Object.assign({}, D.base.units, o.units); D.offRules = Object.assign({}, D.offRules, o.rules || {}); D.meta = o.meta; D.override = true;
        } else if (o) { store(K_OVR, null); }   // l'app contient déjà des données plus récentes
        var id = store(K_LIST) || D.index.default;
        var entry = D.index.lists.filter(function (l) { return l.id === id; })[0] || D.index.lists[0];
        return getJSON('data/lists/' + entry.file);
      })
      .then(function (list) { D.list = list; });
  }

  /* ---------- index des stratagèmes et mots-clés ---------- */
  function allStrats() {
    var out = [];
    D.list.detachments.forEach(function (n) {
      var d = D.det[n]; if (!d) return;
      d.strats.forEach(function (s) { out.push(Object.assign({ src: d.key, srcLabel: d.label }, s)); });
    });
    D.rules.coreStrats.forEach(function (s) { out.push(Object.assign({ src: 'core', srcLabel: 'Base' }, s)); });
    return out;
  }
  function stratByName(n) {
    var hit = allStrats().filter(function (s) { return s.name === n; })[0];
    if (hit) return hit;
    for (var k in D.det) { var s = D.det[k].strats.filter(function (x) { return x.name === n; })[0]; if (s) return s; }
    return null;
  }
  function kwRule(k) {
    var l = k.toLowerCase().replace(/^\[|\]$/g, ''), best = null;
    Object.keys(D.rules.keywords).concat(Object.keys(D.offRules)).forEach(function (n) {
      if (l.indexOf(n.toLowerCase()) === 0 && (!best || n.length > best.length)) best = n;
    });
    return best;
  }

  /* ---------- rendu des pages ---------- */
  function section(id, inner) { return '<section class="page" id="' + id + '">' + inner + '\n</section>'; }

  function renderHeader() {
    var L = D.list;
    $('hEyebrow').textContent = L.subtitle || 'Warhammer 40 000 · V11';
    $('hTitle').textContent = L.name;
    var chips = [['gold', L.points], ['', L.size], ['', L.disposition], ['', 'Warlord : ' + L.warlord]];
    if (L.toBuy) chips.push(['', 'À acheter : ' + L.toBuy]);
    $('hMeta').innerHTML = chips.filter(function (c) { return c[1]; }).map(function (c) { return '<span class="chip ' + c[0] + '">' + esc(c[1]) + '</span>'; }).join('');
    document.title = L.name + ' – Fiche de jeu';
    $('foot').innerHTML = 'Profils : base communautaire BSData du ' + esc(frDate(D.meta.date)) + (D.override ? ' (mise à jour depuis l\'app)' : '') + '. Stratagèmes et détachements relevés sur BattleBase. En cas de doute, BattleBase ou l\'app officielle font foi.';
  }

  function pageDoctrines() {
    var d = D.rules.doctrines;
    return '<h2>Les Doctrines</h2><p class="lede">' + esc(d.intro) + '</p><div class="grid g3 doc">' +
      d.list.map(function (x) { return '<div class="card"><span class="tag">' + esc(x.tag) + '</span><h3>' + esc(x.title) + '</h3><p>' + esc(x.text) + '</p><p class="small">Quand : ' + esc(x.when) + '</p></div>'; }).join('') + '</div>';
  }
  function pageDetachements() {
    return '<h2>Règles des détachements</h2><p class="lede">Ces bonus sont actifs en permanence, sans dépenser de PC.</p><div class="grid g3">' +
      D.list.detachments.map(function (n) {
        var d = D.det[n]; if (!d) return '';
        return '<div class="card"><span class="src ' + d.key + '">' + esc(n) + ' · ' + d.cost + ' DP</span><h3 style="margin-top:6px">' + esc(d.rule.name) + '</h3><p>' + esc(d.rule.text) + '</p></div>';
      }).join('') + '</div>';
  }
  function pageAmeliorations() {
    var L = D.list;
    return '<h2>Améliorations</h2><p class="lede">' + L.enhancements.length + ' amélioration(s) dans cette liste.</p><div class="grid g3">' +
      L.enhancements.map(function (e) {
        var found = null, dn = '';
        L.detachments.forEach(function (n) { (D.det[n] ? D.det[n].enhancements : []).forEach(function (x) { if (x.name === e.name) { found = x; dn = n; } }); });
        if (!found) return '';
        return '<div class="card"><span class="src ' + D.det[dn].key + '">' + esc(dn) + ' · ' + found.pts + ' pts</span><h3 style="margin-top:6px">' + esc(e.name) + '</h3><p>Sur <b>' + esc(e.on) + '</b>. ' + esc(found.text) + '</p></div>';
      }).join('') + '</div>';
  }
  function stratCard(s) {
    var tip = (D.list.stratTips || {})[s.name] || s.tip;
    return '<div class="card strat" id="s-' + slug(s.name) + '"><div class="strat-head"><div><span class="src ' + s.src + '">' + esc(s.srcLabel) + '</span><h3 style="margin-top:6px">' + esc(s.name) + '</h3></div><span class="cp' + (s.cp > 1 ? ' two' : '') + '">' + s.cp + ' PC</span></div>' +
      '<dl class="kv"><dt>Quand</dt><dd>' + esc(s.when) + '</dd><dt>Cible</dt><dd>' + esc(s.target) + '</dd><dt>Effet</dt><dd>' + esc(s.effect) + '</dd></dl>' +
      (tip ? '<div class="tip">' + esc(tip) + '</div>' : '') + '</div>';
  }
  function pageStrats() {
    var all = allStrats(), groups = [['mine', 'Pendant ton tour'], ['theirs', 'Pendant le tour adverse'], ['any', 'Dans n\'importe quel tour']];
    var legend = D.list.detachments.map(function (n) { var d = D.det[n]; return d ? '<span class="src ' + d.key + '">' + esc(d.label) + '</span>' : ''; }).join('') + '<span class="src core">Base</span>';
    return '<h2>Stratagèmes (PC)</h2><p class="lede">' + esc(D.rules.stratRule) + ' Les stratagèmes de détachement ne marchent que sur tes unités Adeptus Astartes.</p><div class="legend">' + legend + '</div>' +
      groups.map(function (g) {
        var l = all.filter(function (s) { return s.moment === g[0]; });
        return l.length ? '<div class="when-title">' + g[1] + '</div><div class="grid g2">' + l.map(stratCard).join('') + '</div>' : '';
      }).join('');
  }

  function statRow(m) {
    var cells = [['M', m.M], ['E', m.T], ['Svg', m.Sv], ['PV', m.W], ['Cd', m.Ld], ['CO', m.OC], ['Inv', m.Inv || '–']];
    return '<div class="stats">' + cells.map(function (c) { return '<div><b>' + c[0] + '</b><span>' + esc(c[1]) + '</span></div>'; }).join('') + '</div>';
  }
  function kwPills(kws, bonus) {
    var h = kws.map(function (k) {
      var r = kwRule(k);
      return r ? '<button type="button" class="k" data-k="' + esc(r) + '">' + esc(k) + '</button>' : '<span class="k">' + esc(k) + '</span>';
    }).join('');
    (bonus || []).forEach(function (b) { h += '<button type="button" class="k b" data-b="' + esc(b[0]) + '">' + esc(b[1]) + '</button>'; });
    return h;
  }
  function weaponRows(w, note, bonus) {
    var cell = function (p, lab) {
      return '<td data-label="Arme">' + lab + '</td><td data-label="Portée">' + esc(p.range === 'Melee' ? 'Mêlée' : p.range) + '</td><td data-label="A">' + esc(p.A) + '</td><td data-label="CT/CC">' + esc(p.skill) + '</td><td data-label="F">' + esc(p.S) + '</td><td data-label="PA">' + esc(p.AP) + '</td><td data-label="D">' + esc(p.D) + '</td><td class="kw" data-label="Règles">' + kwPills(p.keywords, bonus) + '</td>';
    };
    var name = esc(w.name) + (note ? ' (' + esc(note) + ')' : '');
    if (w.profiles.length === 1) return '<tr>' + cell(w.profiles[0], name) + '</tr>';
    return '<tr class="grp"><td colspan="8">' + name + ' <span>· choisis 1 profil à chaque ' + (w.type === 'melee' ? 'combat' : 'tir') + '</span></td></tr>' +
      w.profiles.map(function (p) { return '<tr class="prof">' + cell(p, '↳ ' + esc(p.label)) + '</tr>'; }).join('');
  }
  function unitCard(U) {
    var h = '<article class="card unit" id="u-' + U.id + '"><div class="unit-head"><div><span class="role">' + esc(U.role) + '</span><h3>' + esc(U.label) + '</h3></div><span class="pts">' + esc(U.points) + '</span></div><div class="unit-body">';
    var bon = {}; Object.keys(U.bonuses || {}).forEach(function (k) { bon[k.toLowerCase()] = U.bonuses[k]; });
    var rows = '', missing = [], off = [];
    U.datasheets.forEach(function (ds) {
      var u = D.units[ds.name];
      if (!u) { missing.push(ds.name); return; }
      var models = u.models.filter(function (m) { return !ds.models || ds.models.indexOf(m.name) >= 0; });
      var seen = {};
      models = models.filter(function (m) { var k = [m.M, m.T, m.Sv, m.W, m.Ld, m.OC, m.Inv].join('|'); if (seen[k]) return false; seen[k] = 1; return true; });
      models.forEach(function (m) {
        if (U.datasheets.length > 1 || models.length > 1) h += '<div class="model-name">' + esc(m.name) + '</div>';
        h += statRow(m);
      });
      var specs = ds.weapons || u.weapons.map(function (w) { return { name: w.name }; });
      specs.forEach(function (sp) {
        var w = u.weapons.filter(function (x) { return x.name.toLowerCase() === sp.name.toLowerCase(); })[0];
        if (w) rows += weaponRows(w, sp.note, bon[w.name.toLowerCase()]); else missing.push(sp.name);
      });
      u.abilities.forEach(function (a) { if (a.text) off.push([a.name, a.text]); });
    });
    if (rows) h += '<div class="tbl"><table><thead><tr><th>Arme</th><th>Portée</th><th>A</th><th>CT/CC</th><th>F</th><th>PA</th><th>D</th><th>Règles</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    if (missing.length) h += '<div class="note">Introuvable dans les données : ' + esc(missing.join(', ')) + '. Envoie-moi une capture BattleBase.</div>';
    if (U.notes && U.notes.length) h += '<ul class="ab">' + U.notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>';
    if (U.strats && U.strats.length) {
      h += '<div class="sl"><div class="sl-t">Stratagèmes utiles</div><ul>' + U.strats.map(function (x) {
        var s = stratByName(x[0]); if (!s) return '';
        return '<li><span class="cpi' + (s.cp > 1 ? ' two' : '') + '">' + s.cp + ' PC</span><span><b>' + esc(s.name) + '</b> · ' + esc(x[1] || s.short || '') + '</span></li>';
      }).join('') + '</ul></div>';
    }
    if (off.length) h += '<details class="off"><summary>Capacités officielles (anglais)</summary><dl>' + off.map(function (a) { return '<dt>' + esc(a[0]) + '</dt><dd>' + md(a[1]) + '</dd>'; }).join('') + '</dl></details>';
    return h + '</div></article>';
  }
  function pageUnites() {
    return '<h2>Tes unités</h2><p class="lede">M Mouvement · E Endurance · Svg Sauvegarde · PV Points de vie · CO Contrôle d\'objectif · Inv Invulnérable.</p><div class="grid">' + D.list.units.map(unitCard).join('') + '</div>';
  }
  function pageMotsCles() {
    var kw = D.rules.keywords, b = D.rules.bonuses;
    var cards = Object.keys(kw).map(function (n) {
      var o = D.offRules[n];
      return '<div class="card"><h3>' + esc(n) + '</h3><p>' + esc(kw[n]) + '</p>' + (o ? '<details class="off"><summary>Texte officiel</summary><p class="small">' + md(o) + '</p></details>' : '') + '</div>';
    }).concat(Object.keys(b).map(function (k) { return '<div class="card"><h3>' + esc(b[k][0]) + '</h3><p>' + esc(b[k][1]) + '</p></div>'; }));
    return '<h2>Mots-clés d\'armes</h2><p class="lede">Touche un mot-clé dans les fiches pour voir sa règle. Les mots-clés en pointillés sont des bonus qui viennent d\'une règle de l\'unité, du détachement ou d\'une amélioration.</p><div class="grid g2">' + cards.join('') + '</div>';
  }

  function render() {
    var L = D.list;
    renderHeader();
    var html = {
      tour: L.pages.tour, plan: L.pages.plan, scenarios: L.pages.scenarios,
      doctrines: pageDoctrines(), detachements: pageDetachements(), ameliorations: pageAmeliorations(),
      strats: pageStrats(), unites: pageUnites(), 'mots-cles': pageMotsCles()
    };
    $('app').innerHTML = PAGES.map(function (p) { return section(p[0], html[p[0]] || ''); }).join('');
    buildMenu();
    route();
  }

  /* ---------- pages : une à la fois, selon le #lien ---------- */
  function route() {
    var id = (location.hash || '').slice(1) || 'tour';
    var el = $(id);
    var page = el && (el.classList.contains('page') ? el : el.closest('.page'));
    if (!page) { page = $('tour'); el = page; }
    document.querySelectorAll('.page').forEach(function (p) { p.classList.toggle('active', p === page); });
    if (el === page) window.scrollTo({ top: 0, behavior: 'instant' });
    else {
      var d = el.closest('details'); if (d) d.open = true;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 16, behavior: 'instant' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    }
  }
  window.addEventListener('hashchange', route);

  /* ---------- menu noir ---------- */
  var panels = [];
  function buildMenu() {
    var L = D.list;
    var links = function (items) { return '<ul>' + items.map(function (i) { return '<li><a href="#' + i[0] + '">' + i[1] + '</a></li>'; }).join('') + '</ul>'; };
    panels = [
      ['Unités', links(L.units.map(function (u) { return ['u-' + u.id, esc(u.menu || u.label)]; }))],
      ['Stratagèmes', links(allStrats().map(function (s) { return ['s-' + slug(s.name), esc(s.name) + ' <span class="m-cp">' + s.cp + ' PC</span>']; }))],
      ['Sections', links(PAGES.map(function (p) { return [p[0], p[1]]; }))],
      ['Listes', '<div class="m-list" style="margin:auto;display:grid;gap:10px;justify-items:center">' + D.index.lists.map(function (l) {
        return '<button type="button" data-list="' + esc(l.id) + '" class="' + (l.id === L.id ? 'on' : '') + '">' + esc(l.name) + '<small>' + esc(l.points) + (l.id === L.id ? ' · liste active' : '') + '</small></button>';
      }).join('') + '<p style="color:#666;font-size:13px;max-width:280px;text-align:center;margin:8px 0 0">Pour ajouter une liste, envoie l\'export ou les captures BattleBase à Claude.</p></div>'],
      ['Mises à jour', updPanel()]
    ];
    $('mTrack').innerHTML = panels.map(function (p) { return '<nav class="m-panel" aria-label="' + p[0] + '">' + p[1] + '</nav>'; }).join('');
    $('mDots').innerHTML = panels.map(function (p, i) { return '<span' + (i ? '' : ' class="on"') + '></span>'; }).join('');
    bindUpd();
  }
  var ov = $('mOv'), tr = $('mTrack');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function idx() { return Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); }
  function mark() {
    var i = idx();
    $('mTitle').textContent = panels[i] ? panels[i][0] : '';
    $('mPrev').disabled = i === 0; $('mNext').disabled = i === panels.length - 1;
    $('mDots').querySelectorAll('span').forEach(function (d, k) { d.classList.toggle('on', k === i); });
  }
  function go(i) { tr.scrollTo({ left: i * tr.clientWidth, behavior: reduce ? 'auto' : 'smooth' }); }
  function show() { ov.hidden = false; document.body.style.overflow = 'hidden'; tr.scrollLeft = 0; mark(); requestAnimationFrame(function () { requestAnimationFrame(function () { ov.classList.add('show'); }); }); $('mX').focus(); }
  function hide(after) { ov.classList.remove('show'); document.body.style.overflow = ''; var done = function () { ov.hidden = true; if (after) after(); }; if (reduce) done(); else setTimeout(done, 260); }
  $('mBtn').addEventListener('click', show);
  $('mX').addEventListener('click', function () { hide(function () { $('mBtn').focus(); }); });
  $('mPrev').addEventListener('click', function () { go(Math.max(0, idx() - 1)); });
  $('mNext').addEventListener('click', function () { go(Math.min(panels.length - 1, idx() + 1)); });
  tr.addEventListener('scroll', function () { requestAnimationFrame(mark); });
  ov.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (a) {
      e.preventDefault();
      var id = a.getAttribute('href').slice(1);
      if (location.hash === '#' + id) route(); else location.hash = id;
      hide(function () { var el = $(id); if (el) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } });
      return;
    }
    var lb = e.target.closest('[data-list]');
    if (lb) { store(K_LIST, lb.getAttribute('data-list')); location.hash = ''; location.reload(); }
  });
  document.addEventListener('keydown', function (e) {
    if (!ov.hidden) {
      if (e.key === 'Escape') hide(function () { $('mBtn').focus(); });
      if (e.key === 'ArrowRight') go(Math.min(panels.length - 1, idx() + 1));
      if (e.key === 'ArrowLeft') go(Math.max(0, idx() - 1));
    } else if (!sh.hidden && e.key === 'Escape') closeSheet();
  });

  /* ---------- panneau de mots-clés ---------- */
  var sh = $('sheet'), bg = $('sheetBg'), lastBtn = null;
  function openSheet(title, html, btn) { lastBtn = btn; $('sheetT').textContent = title; $('sheetP').innerHTML = html; bg.hidden = false; sh.hidden = false; $('sheetX').focus(); }
  function closeSheet() { bg.hidden = true; sh.hidden = true; if (lastBtn) lastBtn.focus(); }
  bg.addEventListener('click', closeSheet); $('sheetX').addEventListener('click', closeSheet);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.k[data-k], .k[data-b]');
    if (!b) return;
    if (b.dataset.b) { var x = D.rules.bonuses[b.dataset.b]; if (x) openSheet(b.textContent + ' — ' + x[0], '<p>' + esc(x[1]) + '</p>', b); return; }
    var n = b.dataset.k, fr = D.rules.keywords[n], off = D.offRules[n];
    openSheet(b.textContent, (fr ? '<p>' + esc(fr) + '</p>' : '') + (off ? '<details class="off-t"' + (fr ? '' : ' open') + '><summary>Texte officiel (anglais)</summary><p>' + md(off) + '</p></details>' : ''), b);
  });

  /* ---------- mises à jour ---------- */
  function updPanel() {
    var last = store(K_CHECK);
    return '<div class="m-upd">' +
      '<p>Profils, armes et points de tes unités : base communautaire <b>BSData</b>.</p>' +
      '<p>Données actuelles : <b>' + esc(frDate(D.meta.date)) + '</b>' + (D.meta.sha ? ' (' + esc(D.meta.sha.slice(0, 7)) + ')' : '') + (D.override ? '<br>mises à jour depuis l\'app' : '') + '</p>' +
      (last ? '<p>Dernière vérification : ' + esc(new Date(last).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })) + '</p>' : '') +
      '<button type="button" class="m-btn2" id="uCheck">Vérifier les mises à jour</button>' +
      '<div id="uRes" hidden></div>' +
      '<button type="button" class="m-btn2 ghost" id="uReload">Relancer l\'app</button>' +
      (D.override ? '<button type="button" class="m-btn2 ghost" id="uReset">Revenir aux données d\'origine</button>' : '') +
      '<p style="font-size:12px;color:#666">Les stratagèmes, détachements et tes plans ne viennent pas de BSData : ils sont mis à jour avec l\'app.</p>' +
      '</div>';
  }
  var pending = null;
  function bindUpd() {
    $('uCheck').addEventListener('click', check);
    $('uReload').addEventListener('click', relaunch);
    if ($('uReset')) $('uReset').addEventListener('click', function () { store(K_OVR, null); relaunch(); });
  }
  function relaunch() {
    var go = function () { location.reload(); };
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then(function (r) { return r ? r.update() : null; }).then(go, go);
    } else go();
  }
  function res(html) { var r = $('uRes'); r.hidden = false; r.className = 'm-res'; r.innerHTML = html; }
  function check() {
    var btn = $('uCheck'); btn.disabled = true; pending = null;
    if (!navigator.onLine) { res('<p class="err">Pas de réseau. Réessaie quand tu es connecté.</p>'); btn.disabled = false; return; }
    res('<p>Recherche de la dernière version…</p>');
    var sha, date, lists;
    getJSON('https://api.github.com/repos/' + BSX.REPO + '/commits?per_page=1')
      .then(function (c) {
        sha = c[0].sha; date = c[0].commit.committer.date;
        store(K_CHECK, new Date().toISOString());
        if (sha === D.meta.sha) { res('<p class="ok">Tes données sont déjà à jour (' + esc(frDate(date)) + ').</p>'); btn.disabled = false; return null; }
        return Promise.all(D.index.lists.map(function (l) { return getJSON('data/lists/' + l.file); }));
      })
      .then(function (ls) {
        if (!ls) return null;
        lists = ls;
        var want = {};
        lists.forEach(function (l) { l.units.forEach(function (u) { u.datasheets.forEach(function (d) { want[d.name] = d.source; }); }); });
        var files = Array.from(new Set(Object.keys(want).map(function (k) { return want[k]; })));
        var gsName = D.base.meta.gameSystem || 'Warhammer 40,000.json', n = 0, total = files.length + 1;
        var dl = function (f) { return getJSON(BSX.rawUrl(sha, f)).then(function (j) { n++; res('<p>Téléchargement ' + n + '/' + total + '…</p>'); return j; }); };
        return dl(gsName).then(function (gs) {
          return Promise.all(files.map(dl)).then(function (cats) {
            var units = {}, notFound = [];
            files.forEach(function (f, i) {
              var ix = BSX.buildIndex([cats[i], gs]);
              Object.keys(want).filter(function (k) { return want[k] === f; }).forEach(function (k) {
                var u = BSX.extractUnit(ix, k);
                if (u) { u.source = f; units[k] = u; } else notFound.push(k);
              });
            });
            return { units: units, rules: BSX.extractRules(gs), notFound: notFound };
          });
        });
      })
      .then(function (r) {
        if (!r) return;
        var ch = diff(D.units, r.units), rc = 0;
        Object.keys(r.rules).forEach(function (k) { if (D.offRules[k] && D.offRules[k] !== r.rules[k]) rc++; });
        pending = { meta: { repo: BSX.REPO, sha: sha, date: date, gameSystem: D.base.meta.gameSystem }, units: r.units, rules: r.rules };
        var h = '<p>Nouvelle version des données : <b>' + esc(frDate(date)) + '</b>.</p>';
        var names = Object.keys(ch);
        if (!names.length && !rc) h += '<p class="ok">Aucun changement pour tes unités.</p>';
        names.forEach(function (n) { h += '<h4>' + esc(n) + '</h4><ul>' + ch[n].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; });
        if (rc) h += '<h4>Mots-clés</h4><ul><li>' + rc + ' texte(s) officiel(s) modifié(s)</li></ul>';
        if (r.notFound.length) h += '<p class="err">Introuvable dans la nouvelle version : ' + esc(r.notFound.join(', ')) + ' (gardé tel quel).</p>';
        h += '<p style="margin-top:10px">Vérifie les points de ta liste dans BattleBase si des coûts ont changé.</p>' +
          '<div style="display:grid;gap:8px;margin-top:10px"><button type="button" class="m-btn2" id="uApply">Appliquer et relancer</button><button type="button" class="m-btn2 ghost" id="uSkip">Ignorer</button></div>';
        res(h);
        $('uApply').addEventListener('click', function () { var keep = {}; Object.keys(D.units).forEach(function (k) { if (!pending.units[k]) keep[k] = D.units[k]; }); store(K_OVR, { meta: pending.meta, units: Object.assign(keep, pending.units), rules: pending.rules }); relaunch(); });
        $('uSkip').addEventListener('click', function () { $('uRes').hidden = true; pending = null; });
        btn.disabled = false;
      })
      .catch(function (e) { res('<p class="err">La vérification a échoué : ' + esc(e.message) + '. Réessaie plus tard.</p>'); btn.disabled = false; });
  }
  function diff(oldU, newU) {
    var out = {}, add = function (n, t) { (out[n] = out[n] || []).push(t); };
    var labels = { M: 'M', T: 'E', Sv: 'Svg', W: 'PV', Ld: 'Cd', OC: 'CO', Inv: 'Inv' }, wl = { range: 'Portée', A: 'A', skill: 'CT/CC', S: 'F', AP: 'PA', D: 'D' };
    Object.keys(newU).forEach(function (n) {
      var a = oldU[n], b = newU[n];
      if (!a) { add(n, 'Nouvelle fiche'); return; }
      if (a.pts !== b.pts) add(n, 'Points : ' + esc(a.pts) + ' → <b>' + esc(b.pts) + '</b>');
      b.models.forEach(function (m) {
        var o = a.models.filter(function (x) { return x.name === m.name; })[0]; if (!o) return;
        Object.keys(labels).forEach(function (k) { if ((o[k] || '') !== (m[k] || '')) add(n, esc(m.name) + ' — ' + labels[k] + ' : ' + esc(o[k] || '–') + ' → <b>' + esc(m[k] || '–') + '</b>'); });
      });
      var wmap = {}; a.weapons.forEach(function (w) { w.profiles.forEach(function (p) { wmap[w.name + '|' + p.label] = p; }); });
      var seen = {};
      b.weapons.forEach(function (w) {
        w.profiles.forEach(function (p) {
          var key = w.name + '|' + p.label, o = wmap[key], lab = esc(w.name) + (p.label ? ' (' + esc(p.label) + ')' : '');
          seen[key] = 1;
          if (!o) { add(n, 'Nouvelle arme : ' + lab); return; }
          Object.keys(wl).forEach(function (k) { if (String(o[k]) !== String(p[k])) add(n, lab + ' — ' + wl[k] + ' : ' + esc(o[k]) + ' → <b>' + esc(p[k]) + '</b>'); });
          if (o.keywords.join(',') !== p.keywords.join(',')) add(n, lab + ' — mots-clés : ' + esc(o.keywords.join(', ') || 'aucun') + ' → <b>' + esc(p.keywords.join(', ') || 'aucun') + '</b>');
        });
      });
      Object.keys(wmap).forEach(function (k) { if (!seen[k]) add(n, 'Arme retirée : ' + esc(k.replace('|null', '').replace('|', ' (') + (k.indexOf('|null') < 0 ? ')' : ''))); });
      b.abilities.forEach(function (x) { var o = a.abilities.filter(function (y) { return y.name === x.name; })[0]; if (!o) add(n, 'Nouvelle capacité : ' + esc(x.name)); else if (o.text !== x.text) add(n, 'Capacité modifiée : ' + esc(x.name)); });
    });
    return out;
  }

  /* ---------- démarrage ---------- */
  load().then(render).catch(function (e) {
    $('app').innerHTML = '<div class="note">Impossible de charger les données (' + esc(e.message) + '). Ouvre l\'app une fois avec du réseau.</div>';
  });
})();
