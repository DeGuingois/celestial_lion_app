/* Extracteur des données communautaires BSData (wh40k-11e).
   Utilisé dans l'app (bouton « Vérifier les mises à jour ») et par tools/build-units.js. */
(function (root) {
  'use strict';
  var REPO = 'BSData/wh40k-11e';
  var SKIP = /crusade|enhancement|battle honour|weapon modification/i;
  var WEAPON = { 'Ranged Weapons': 'ranged', 'Melee Weapons': 'melee' };

  function catalogueOf(json) { return json.catalogue || json.gameSystem || json; }

  /* Index id -> objet, sur tous les fichiers chargés */
  function buildIndex(files) {
    var idx = {};
    function walk(o) {
      if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i]); return; }
      if (!o || typeof o !== 'object') return;
      if (o.id && o.name && !o.targetId && !idx[o.id]) idx[o.id] = o;
      for (var k in o) if (o[k] && typeof o[k] === 'object') walk(o[k]);
    }
    files.forEach(function (f) { walk(catalogueOf(f)); });
    return idx;
  }

  function chars(p) {
    var o = {};
    (p.characteristics || []).forEach(function (c) { o[c.name] = (c.$text == null ? '' : String(c.$text)).replace(/ /g, ' ').trim(); });
    return o;
  }

  function parseProfileName(n) {
    var s = n.replace(/^➤\s*/, '').trim(), m;
    if ((m = s.match(/^(.+?)\s+-\s+(.+)$/))) return { group: m[1], label: m[2] };
    if ((m = s.match(/^(.+?)\s*\((.+)\)$/))) return { group: m[1], label: m[2] };
    return { group: s, label: null };
  }

  function findUnit(idx, name) {
    var best = null;
    for (var id in idx) {
      var o = idx[id];
      if (o.name === name && (o.type === 'unit' || o.type === 'model') && (o.profiles || o.selectionEntries || o.entryLinks)) {
        if (!best || (o.profiles && !best.profiles)) best = o;
      }
    }
    return best;
  }

  function extractUnit(idx, name) {
    var u = findUnit(idx, name);
    if (!u) return null;
    var pts = null;
    (u.costs || []).forEach(function (c) { if (c.name === 'pts') pts = c.value; });
    var out = { name: name, pts: pts, models: [], abilities: [], rules: [], weapons: [] };
    var seenModel = {}, seenAb = {}, seenRule = {}, wmap = {}, visited = {};

    function addProfile(p, ctx) {
      var t = p.typeName, c = chars(p);
      if (t === 'Unit') {
        if (!seenModel[p.name]) { seenModel[p.name] = 1; out.models.push({ name: p.name, M: c.M, T: c.T, Sv: c.Sv, W: c.W, Ld: c.LD, OC: c.OC, Inv: c.InSv || '' }); }
      } else if (t === 'Abilities') {
        if (ctx.weapon) return;
        if (!seenAb[p.name]) { seenAb[p.name] = 1; out.abilities.push({ name: p.name, text: c.Description || '' }); }
      } else if (WEAPON[t]) {
        var pn = parseProfileName(p.name);
        var g = ctx.weaponEntry || pn.group;
        if (!wmap[g]) { wmap[g] = { name: g, type: WEAPON[t], profiles: [] }; out.weapons.push(wmap[g]); }
        var label = pn.label;
        if (wmap[g].profiles.some(function (x) { return x.label === label; })) return;
        wmap[g].profiles.push({ label: label, range: c.Range, A: c.A, skill: c.BS || c.WS, S: c.S, AP: c.AP, D: c.D,
          keywords: (c.Keywords || '').split(',').map(function (k) { return k.trim(); }).filter(Boolean) });
      }
    }

    function hasWeaponProfiles(o) {
      return (o.profiles || []).some(function (p) { return WEAPON[p.typeName]; });
    }

    function visit(o, ctx, depth) {
      if (!o || depth > 10 || (o.name && SKIP.test(o.name))) return;
      var isWeapon = !ctx.weapon && o !== u && hasWeaponProfiles(o);
      var c2 = isWeapon ? { weapon: true, weaponEntry: o.name } : ctx;
      (o.profiles || []).forEach(function (p) { addProfile(p, c2); });
      (o.infoLinks || []).forEach(function (l) {
        var t = idx[l.targetId];
        if (!t) return;
        if (l.type === 'profile') addProfile(t, c2);
        else if (l.type === 'rule' && !c2.weapon && !seenRule[t.name]) { seenRule[t.name] = 1; out.rules.push(t.name); }
      });
      (o.selectionEntries || []).forEach(function (ch) { visit(ch, c2, depth + 1); });
      (o.selectionEntryGroups || []).forEach(function (ch) { visit(ch, c2, depth + 1); });
      (o.entryLinks || []).forEach(function (l) {
        if (l.name && SKIP.test(l.name)) return;
        var t = idx[l.targetId];
        if (!t) return;
        var key = l.targetId + (c2.weapon ? 'w' : '');
        if (visited[key]) return;
        visited[key] = 1;
        visit(t, c2, depth + 1);
      });
    }
    visit(u, {}, 0);
    return out;
  }

  /* Règles de base (mots-clés) : texte officiel en anglais */
  function extractRules(gameSystem) {
    var gs = catalogueOf(gameSystem), r = {};
    (gs.sharedRules || []).forEach(function (x) { if (x.description) r[x.name] = x.description.replace(/ /g, ' ').trim(); });
    return r;
  }


  /* Détachements d'une faction : coût en DP, disposition, tags uniques, règle, améliorations */
  var DISPOS = ['Priority Assets', 'Take and Hold', 'Purge the Foe', 'Disruption', 'Reconnaissance'];
  function cleanEnh(n) { return n.replace(/\s*\((Upgrade|Aura)\)/g, function (m, x) { return x === 'Aura' ? ' (Aura)' : ''; }).trim(); }
  function textOf(o, idx) {
    var t = [];
    (o.profiles || []).forEach(function (p) { var c = chars(p); if (c.Description) t.push(c.Description); });
    (o.rules || []).forEach(function (r) { if (r.description) t.push(r.description); });
    (o.infoLinks || []).forEach(function (l) { var x = idx[l.targetId]; if (l.type === 'profile' && x) { var c = chars(x); if (c.Description) t.push(c.Description); } });
    return t.join('\n').replace(/\u00a0/g, ' ').trim();
  }
  function extractDetachments(idx) {
    var grp = null, enh = null;
    for (var id in idx) {
      var o = idx[id];
      if (o.name === 'Detachment' && o.selectionEntries && o.selectionEntries.length > 3) grp = o;
      if (o.name === 'Enhancements' && o.selectionEntryGroups && o.selectionEntryGroups.length > 3) enh = o;
    }
    if (!grp) return [];
    return grp.selectionEntries.map(function (d) {
      var dp = null; (d.costs || []).forEach(function (c) { if (c.name === 'Detachment Points') dp = c.value; });
      var cats = (d.categoryLinks || []).map(function (c) { return c.name; });
      var hidden = (d.modifiers || []).some(function (m) { return m.field === 'hidden'; });
      var eg = enh ? (enh.selectionEntryGroups || []).filter(function (g) { return g.name === d.name + ' Enhancements'; })[0] : null;
      return {
        name: d.name, dp: dp, available: !hidden,
        disposition: cats.filter(function (c) { return DISPOS.indexOf(c) >= 0; }),
        tags: cats.filter(function (c) { return DISPOS.indexOf(c) < 0 && !/DP Detachment/.test(c); }),
        rules: (d.rules || []).map(function (r) { return { name: r.name, text: (r.description || '').replace(/\u00a0/g, ' ').trim() }; }),
        enhancements: eg ? (eg.selectionEntries || []).map(function (e) {
          var pts = null; (e.costs || []).forEach(function (c) { if (c.name === 'pts') pts = c.value; });
          return { name: cleanEnh(e.name), pts: pts, text: textOf(e, idx) };
        }) : []
      };
    });
  }

  function rawUrl(sha, file) {
    return 'https://raw.githubusercontent.com/' + REPO + '/' + sha + '/' + encodeURIComponent(file);
  }

  var api = { REPO: REPO, buildIndex: buildIndex, extractUnit: extractUnit, extractRules: extractRules, extractDetachments: extractDetachments, rawUrl: rawUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BSX = api;
})(this);
