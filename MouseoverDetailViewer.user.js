// ==UserScript==
// @name         Mouseover Detail Viewer
// @namespace    https://github.com/hanzoh-games/MouseoverDetailViewer
// @version      1.0.3
// @description  Path of Exile trade: hover a line that only names a passive, keystone or granted skill to see its effects. / Path of Exile のトレードの画面で、パッシブ・キーストーン・アイテムが付与するスキルの名前の行にマウスを重ねると、効果を表示します。
// @author       hanzoh-games
// @license      MIT
// @match        https://www.pathofexile.com/trade*
// @match        https://jp.pathofexile.com/trade*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// @run-at       document-idle
// @homepageURL  https://github.com/hanzoh-games/MouseoverDetailViewer
// @supportURL   https://github.com/hanzoh-games/MouseoverDetailViewer/issues
// @updateURL    https://raw.githubusercontent.com/hanzoh-games/MouseoverDetailViewer/main/MouseoverDetailViewer.user.js
// @downloadURL  https://raw.githubusercontent.com/hanzoh-games/MouseoverDetailViewer/main/MouseoverDetailViewer.user.js
// ==/UserScript==

// This script reads the text shown on the trade page and shows the effects of the named passive, keystone or skill.
// It never searches, buys or sells. The game data is not included: the user's browser downloads it
// from RePoE (https://github.com/repoe-fork) and the official skill tree export
// (https://github.com/grindinggear/skilltree-export) when the user presses "Update data".

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Settings (values and texts are kept here so they can be changed in one place)
  // ---------------------------------------------------------------------------
  const CONFIG = {
    checkIntervalHours: 24,        // how often to check for new data (GitHub allows 60 API calls per hour without login)
    popupMaxWidth: 460,            // px
    popupGap: 4,                   // px between the hovered line and the popup
    screenMargin: 8,               // px kept free at the screen edges
    hoverDelayMs: 80,              // wait before showing, so moving the mouse across lines does not flicker
    doneMessageMs: 4000,           // how long "Updated" stays on the button
    colors: {
      background: '#0d0d0d',
      border: '#6b5530',
      name: '#c8b47a',
      effect: '#8888ff',
      reminder: '#8f8f8f',
      note: '#d6a35c',
      buttonBackground: '#1d1d1d',
      buttonText: '#e6d3a3',
    },
    fontSize: 14,                  // px
    maxLinesPerStat: 8,            // longest stat text (in lines) when turning English text into Japanese
    looseTemplateMaxUses: 20,      // a line form used by fewer cluster passives than this (e.g. "Adds {0}") is also used
                                   // by other mods, so it only shows a popup when the name is found
  };

  const REPOE1 = 'https://raw.githubusercontent.com/repoe-fork/repoe-fork.github.io/master/data';
  const REPOE2 = 'https://raw.githubusercontent.com/repoe-fork/poe2/master/data';
  const SOURCES = {
    poe1: {
      files: {
        jaTree: REPOE1 + '/Japanese/passive_skill_trees/Default.json',
        jaStat: REPOE1 + '/Japanese/stat_translations.json',
        jaStatPassive: REPOE1 + '/Japanese/stat_translations/passive_skill.json',
        jaStatAura: REPOE1 + '/Japanese/stat_translations/passive_skill_aura.json',
        jaHandlers: REPOE1 + '/Japanese/stat_value_handlers.json',
        jaCluster: REPOE1 + '/Japanese/cluster_jewel_notables.json',
        enCluster: REPOE1 + '/cluster_jewel_notables.json',
        enStat: REPOE1 + '/stat_translations.json',
        enStatPassive: REPOE1 + '/stat_translations/passive_skill.json',
        enStatAura: REPOE1 + '/stat_translations/passive_skill_aura.json',
        // ggg: filled in from the newest tag of grindinggear/skilltree-export
      },
      repoeCommitApi: 'https://api.github.com/repos/repoe-fork/repoe-fork.github.io/commits?path=data&per_page=1',
      gggTagsApi: 'https://api.github.com/repos/grindinggear/skilltree-export/tags?per_page=100',
      // skills granted by items; about 40 MB each, so only the page's language is downloaded
      gems: { ja: REPOE1 + '/Japanese/gems.json', en: REPOE1 + '/gems.json' },
      gggDataUrl: (tag) =>'https://raw.githubusercontent.com/grindinggear/skilltree-export/' + encodeURIComponent(tag) + '/data.json',
    },
    poe2: {
      files: {
        tree: REPOE2 + '/passive_skill_trees/Default.json',
        stat: REPOE2 + '/stat_translations/stat_descriptions.json',
        statPassive: REPOE2 + '/stat_translations/passive_skill_stat_descriptions.json',
        handlers: REPOE2 + '/stat_value_handlers.json',
      },
      versionUrl: 'https://raw.githubusercontent.com/repoe-fork/poe2/master/version.txt',
    },
  };

  const TEXT = {
    ja: {
      button: '効果データ ★',
      buttonNew: '効果データ ★ 新しいデータがあります',
      buttonFirst: '効果データ ★ 押すとデータを取得します',
      menuUpdate: 'データを更新',
      downloading: (i, n) => `データを取得中… (${i}/${n})`,
      converting: 'データを変換中…',
      done: (n) => `更新しました(パッシブ ${n} 個)`,
      failed: (m) => `更新できませんでした: ${m}`,
      rateLimited: 'GitHub の回数の上限に達しました。1時間ほど後に、もう一度押してください。',
      noData: '効果データがありません。画面の右下の「効果データ ★」か、Tampermonkey のメニューの「データを更新」を押してください。',
      noJapanese: '日本語の文がありません(英語の文を表示しています)。',
      noJapaneseData: 'POE2 の日本語のデータは公開されていないため、日本語の画面では表示できません。トレードの画面を英語に切り替えると表示できます。',
      notFound: 'このパッシブの効果は、データの中に見つかりませんでした。',
      skillTitle: (n, l) => `${n}(レベル ${l})`,
      skillNotFound: 'このスキルの効果は、データの中に見つかりませんでした。',
      // the line of a support gem on an item: (level) (support's name)
      // ("ソケットされたジェムは…", "装備中の鎧によるスキルは…", "パッシブツリーによって付与されたスキルは…")
      supportLine: /^.+?は\s*レベル\s*(\d+)\s*(.+?)\s*(?:によって|により|に)\s*サポートされる$/,
    },
    en: {
      button: 'Detail data ★',
      buttonNew: 'Detail data ★ New data available',
      buttonFirst: 'Detail data ★ Click to download',
      menuUpdate: 'Update data',
      downloading: (i, n) => `Downloading data… (${i}/${n})`,
      converting: 'Converting data…',
      done: (n) => `Updated (${n} passives)`,
      failed: (m) => `Could not update: ${m}`,
      rateLimited: 'GitHub request limit reached. Please try again in about an hour.',
      noData: 'No detail data yet. Click "Detail data ★" at the bottom right, or "Update data" in the Tampermonkey menu.',
      noJapanese: '',
      noJapaneseData: '',
      notFound: 'The effects of this passive were not found in the data.',
      skillTitle: (n, l) => `${n} (Level ${l})`,
      skillNotFound: 'The effects of this skill were not found in the data.',
      // ("Socketed Gems are…", "Skills from Equipped Body Armour are…", "Skills granted by your Passive Skill Tree are…")
      supportLine: /^.+? (?:are|is) Supported by Level (\d+) (.+?)$/i,
    },
  };

  // ---------------------------------------------------------------------------
  // Page detection
  // ---------------------------------------------------------------------------
  const TEST = window.__MPV_TEST__ || null;   // only set by the local test page
  const GAME = (TEST && TEST.game) || (location.pathname.startsWith('/trade2') ? 'poe2' : 'poe1');
  const LANG = (TEST && TEST.lang) || (location.hostname.startsWith('jp.') ? 'ja' : 'en');
  const T = TEXT[LANG];
  const KEY_DATA = 'data_' + GAME;          // converted table
  const KEY_CHECK = 'check_' + GAME;        // { at: time of last check, latest: versions found }
  // the script's own Version; stored with the data, so data made by an older script can be rebuilt
  const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '';

  // ---------------------------------------------------------------------------
  // Download helpers
  // ---------------------------------------------------------------------------
  function httpGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: url.includes('api.github.com') ? { Accept: 'application/vnd.github+json' } : {},
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) resolve(r.responseText);
          else {
            const e = new Error('HTTP ' + r.status + ' ' + url);
            e.status = r.status;
            e.rateLimited = (r.status === 403 || r.status === 429) && url.includes('api.github.com');
            reject(e);
          }
        },
        onerror: () => reject(new Error('Network error ' + url)),
        ontimeout: () => reject(new Error('Timeout ' + url)),
      });
    });
  }
  const getJson = async (url) => JSON.parse(await httpGet(url));

  function compareVersion(a, b) {
    const pa = a.split(/[^0-9]+/).filter(Boolean).map(Number);
    const pb = b.split(/[^0-9]+/).filter(Boolean).map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  async function fetchLatestVersions(game) {
    if (game === 'poe2') {
      return { repoe: (await httpGet(SOURCES.poe2.versionUrl)).trim() };
    }
    const commits = await getJson(SOURCES.poe1.repoeCommitApi);
    const tags = await getJson(SOURCES.poe1.gggTagsApi);
    const names = tags.map((t) => t.name).filter((n) => /^\d+(\.\d+)*$/.test(n));
    names.sort(compareVersion);
    return { repoe: commits[0] && commits[0].sha, ggg: names[names.length - 1] };
  }

  const sameVersions = (a, b) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

  // ---------------------------------------------------------------------------
  // Stat text builder (stat ids and values -> text), following RePoE's stat_translations format
  // ---------------------------------------------------------------------------
  function stripMarkup(s) {
    // "[Attack]" -> "Attack", "[Glory|Glory consumed]" -> "Glory consumed"
    return s.replace(/\[([^\]|]*)\|([^\]]*)\]/g, '$2').replace(/\[([^\]]*)\]/g, '$1');
  }

  function buildIndex(lists) {
    // earlier lists win (passive_skill translations override the general ones)
    // The game shows the lines in the order of the translation file, so keep each entry's position.
    const byId = new Map();
    byId.order = new Map();
    let n = 0;
    for (const list of lists) {
      for (const e of list) {
        if (!byId.order.has(e)) byId.order.set(e, n++);
        for (const id of e.ids) if (!byId.has(id)) byId.set(id, e);
      }
    }
    return byId;
  }

  function inRange(v, c) {
    const ok = (c.min == null || v >= c.min) && (c.max == null || v <= c.max);
    return c.negated ? !ok : ok;
  }

  function formatNumber(n, precision, fixed) {
    if (typeof n !== 'number') return String(n);
    if (precision == null) {
      if (Number.isInteger(n)) return String(n);
      return String(Math.round(n * 100) / 100);
    }
    const s = n.toFixed(precision);
    return fixed ? s : String(Number(s));
  }

  function applyHandlers(value, names, handlers) {
    let v = value;
    let precision = null;
    let fixed = null;
    for (const name of names || []) {
      const h = handlers[name];
      if (!h) continue;
      if (h.type === 'int') {
        if (h.multiplier != null) v *= h.multiplier;
        if (h.divisor != null) v /= h.divisor;
        if (h.addend != null) v += h.addend;
        if (h.precision != null) { precision = h.precision; fixed = h.fixed; }
      } else if (h.type === 'relational' && h.values) {
        const s = h.values[String(v)];
        if (s != null) return s;
      }
    }
    return formatNumber(v, precision, fixed);
  }

  function translateStats(stats, index, lang, handlers) {
    // stats: { statId: value } in the order of the passive. Returns { lines, reminders, missing }.
    const used = new Set();
    const blocks = [];   // [order, lines]
    const reminders = [];
    let missing = 0;
    for (const id of Object.keys(stats)) {
      if (used.has(id)) continue;
      const e = index.get(id);
      if (!e) { missing++; continue; }
      e.ids.forEach((x) => used.add(x));
      if (e.hidden) continue;
      const variants = e[lang] || [];
      const vals = e.ids.map((x) => (x in stats ? stats[x] : 0));
      const v = variants.find((vr) => vr.condition.every((c, i) => inRange(vals[i], c)));
      if (!v) continue;
      let s = v.string;
      v.format.forEach((f, i) => {
        if (f === 'ignore') return;
        let t = applyHandlers(vals[i], v.index_handlers[i], handlers);
        if (f === '+#' && /^\d/.test(t) && Number(t) > 0) t = '+' + t;
        s = s.split('{' + i + '}').join(t);
      });
      blocks.push([index.order ? index.order.get(e) : blocks.length, stripMarkup(s).split('\n').filter((l) => l.trim())]);
      if (v.reminder_text) reminders.push(stripMarkup(v.reminder_text));
    }
    blocks.sort((a, b) => a[0] - b[0]);
    const lines = [].concat(...blocks.map((b) => b[1]));
    return { lines, reminders, missing };
  }

  // ---------------------------------------------------------------------------
  // English text -> Japanese text (for cluster jewel notables, whose stat ids are not in RePoE)
  // ---------------------------------------------------------------------------
  const NUM = /[+-]?\d+(?:\.\d+)?/g;
  const skeleton = (s) => s.replace(NUM, '#');
  const skeletonOfTemplate = (s) => s.replace(/[+-]?(\{\d+\}|\d+(?:\.\d+)?)/g, '#');
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function buildReverse(enLists, jaIndex) {
    const bySkeleton = new Map();
    for (const list of enLists) {
      for (const e of list) {
        if (e.hidden || !e.English) continue;
        e.English.forEach((v, vi) => {
          const s = stripMarkup(v.string);   // the official text has the markup removed too
          const sk = skeletonOfTemplate(s);
          if (!bySkeleton.has(sk)) bySkeleton.set(sk, []);
          bySkeleton.get(sk).push({ e, v, vi, s });
        });
      }
    }
    function compile(c) {
      if (c.re !== undefined) return c.re;
      const order = [];
      let src = '';
      let last = 0;
      const s = c.s;
      const re = /[+-]?\{(\d+)\}/g;
      let m;
      while ((m = re.exec(s))) {
        src += escapeRe(s.slice(last, m.index)) + '([+-]?\\d+(?:\\.\\d+)?)';
        order.push(Number(m[1]));
        last = m.index + m[0].length;
      }
      src += escapeRe(s.slice(last));
      try { c.re = { rx: new RegExp('^' + src + '$'), order }; } catch (_) { c.re = null; }
      return c.re;
    }
    return function toJapanese(text) {
      const list = bySkeleton.get(skeleton(text));
      if (!list) return null;
      for (const c of list) {
        const r = compile(c);
        if (!r) continue;
        const m = r.rx.exec(text);
        if (!m) continue;
        const je = jaIndex.get(c.e.ids[0]);
        if (!je || !je.Japanese || je.ids.join('|') !== c.e.ids.join('|')) continue;
        const jv = je.Japanese[c.vi] || je.Japanese[0];
        const got = {};
        r.order.forEach((idx, k) => { got[idx] = m[k + 1]; });
        let s = jv.string;
        let ok = true;
        jv.format.forEach((f, i) => {
          if (f === 'ignore') return;
          const raw = got[i];
          if (raw == null) { ok = false; return; }
          const neg = raw.startsWith('-');
          const abs = raw.replace(/^[+-]/, '');
          const t = neg ? '-' + abs : (f === '+#' ? '+' + abs : abs);
          s = s.split('{' + i + '}').join(t);
        });
        if (!ok) continue;
        return { text: stripMarkup(s), reminder: jv.reminder_text ? stripMarkup(jv.reminder_text) : null };
      }
      return null;
    };
  }

  function englishLinesToJapanese(enStats, toJapanese) {
    const src = [];
    for (const s of enStats) for (const l of stripMarkup(s).split('\n')) if (l.trim()) src.push(l.trim());
    const lines = [];
    const reminders = [];
    let failed = 0;
    let i = 0;
    while (i < src.length) {
      let done = false;
      // one stat text can be several lines (a keystone can have 6), so try the longest block first
      for (let span = Math.min(CONFIG.maxLinesPerStat, src.length - i); span >= 1; span--) {
        const r = toJapanese(src.slice(i, i + span).join('\n'));
        if (r) {
          for (const l of r.text.split('\n')) if (l.trim()) lines.push(l);
          if (r.reminder) reminders.push(r.reminder);
          i += span;
          done = true;
          break;
        }
      }
      if (!done) { lines.push(src[i]); failed++; i++; }
    }
    return { lines, reminders, failed };
  }

  // ---------------------------------------------------------------------------
  // Line templates ("Allocates {0}", "1 Added Passive Skill is {0}", ...), taken from the data
  // ---------------------------------------------------------------------------
  // Returns [{ t: "Allocates {0}", loose: false }]. A loose form is shared with other mods,
  // so a line in that form shows a popup only when the name is a known passive.
  function passiveTemplates(lists, lang, clusterPairs) {
    const strict = new Set();
    for (const list of lists) {
      for (const e of list) {
        for (const v of e[lang] || []) {
          if (!v.index_handlers.some((h) => h.includes('passive_hash')) || !/\{0\}/.test(v.string)) continue;
          // A text of several lines ("Passive Skills in Radius of {0} can be Allocated\nwithout being connected to
          // your tree\nPassage") may be shown in part, so use each run of lines from the first one that has the name.
          const parts = stripMarkup(v.string).split('\n');
          const at = parts.findIndex((p) => p.includes('{0}'));
          for (let k = at; k < parts.length; k++) strict.add(parts.slice(0, k + 1).join(' '));
        }
      }
    }
    // cluster jewel notable lines name the passive in the text itself ("1 Added Passive Skill is Doom Cast")
    const uses = new Map();
    for (const { text, name } of clusterPairs) {
      if (!text || !name || !text.includes(name)) continue;
      const t = text.split(name).join('{0}');
      uses.set(t, (uses.get(t) || 0) + 1);
    }
    const out = [...strict].map((t) => ({ t, loose: false }));
    for (const [t, n] of uses) {
      if (!strict.has(t)) out.push({ t, loose: n < CONFIG.looseTemplateMaxUses });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Conversion: downloaded files -> small table { lang: { name: entry } }
  // entry: { n: name, l: effect lines, r: reminder lines, f: 1 if Japanese text is missing }
  // ---------------------------------------------------------------------------
  function addEntry(table, rank, name, entry, r) {
    if (!name || !entry.l.length) return;
    const old = rank.get(name);
    if (old != null && old >= r) return;
    rank.set(name, r);
    table[name] = entry;
  }
  // RePoE's reminder_text is a list of [id, text, ...] (or plain texts); add the ones not shown yet
  function mergeReminders(list, extra) {
    const out = list.slice();
    for (const x of extra || []) {
      const s = stripMarkup(String(Array.isArray(x) ? x[1] || '' : x || ''));
      if (s && !out.includes(s)) out.push(s);
    }
    return out;
  }
  const nodeRank =(isKeystone, isNotable, isAscendancy) => (isKeystone ? 3 : isNotable ? 2 : 1) + (isAscendancy ? 0 : 0.5);
  // The Japanese reminder texts start with the English word ("(Stun Threshold: スタン閾値は…)"); keep only the Japanese
  const unique = (list) => [...new Set(list)];
  const cleanJaReminder = (s) => s.replace(/^\(\s*[A-Za-z][A-Za-z0-9 '\-]*:\s*/, '(');

  // Item lines that name a keystone ("Iron Reflexes", "You have Shepherd of Souls if at least 4 Corrupted Items are
  // Equipped"), taken from the item translations (stat_translations.json; the passive tree file has the effect text
  // for the same ids instead). Returns { ja: { line: entry }, en: { line: entry } }. A keystone that is not on the
  // tree (only on items) has no effect text in the data, so it gets a "not found" entry.
  function keystoneLines(enStat, jaStat, gggByName, jaByHash, en, toJapanese) {
    const out = { ja: {}, en: {} };
    const jaById = new Map();
    for (const e of jaStat) for (const id of e.ids) if (!jaById.has(id)) jaById.set(id, e);
    const keystoneNames = [...gggByName.values()].filter((n) => n.isKeystone).map((n) => n.name).sort((a, b) => b.length - a.length);
    for (const e of enStat) {
      if (!e.English || !e.ids.some((id) => id.startsWith('keystone_'))) continue;
      const je = jaById.get(e.ids[0]);
      e.English.forEach((v, vi) => {
        const line = normalize(stripMarkup(v.string));
        if (!line || /\{\d+\}/.test(line)) return;
        const name = keystoneNames.find((k) => line === k || line.includes(k));
        const node = name && gggByName.get(name);
        out.en[line] = (name && en[name]) || fromReminder(line, v.reminder_text);
        const jv = je && je.Japanese && je.ids.join('|') === e.ids.join('|') && (je.Japanese[vi] || je.Japanese[0]);
        if (!jv) return;
        const jline = normalize(stripMarkup(jv.string));
        if (!jline || /\{\d+\}/.test(jline)) return;
        let entry = node && jaByHash.get(node.skill);
        if (!entry && node) {
          // a newer keystone missing from RePoE's Japanese tree: turn the official English text into Japanese
          const r = englishLinesToJapanese(node.stats, toJapanese);
          entry = { n: jline, l: r.lines, r: unique(r.reminders.map(cleanJaReminder)), f: r.failed ? 1 : 0 };
        }
        out.ja[jline] = entry || fromReminder(jline, jv.reminder_text, true);
      });
    }
    return out;
  }
  // A keystone only found on items (Corrupted Soul, Battlemage, ...) is not on the tree, but the item text carries
  // its effect as the reminder text: "(Corrupted Soul: 受けたダメージの…)" -> effect lines
  function fromReminder(name, reminder, japanese) {
    const s = reminder ? stripMarkup(String(reminder)).trim() : '';
    if (!s) return { n: name, l: [], r: [], missing: true };
    const body = (japanese ? cleanJaReminder(s) : s).replace(/^\(/, '').replace(/\)$/, '');
    return { n: name, l: body.split('\n').map((x) => x.trim()).filter(Boolean), r: [] };
  }

  // ---------------------------------------------------------------------------
  // Skills granted by items ("装備するとレベル20冷気のイージスをトリガーする", "Grants Level 20 Bone Armour Skill")
  // ---------------------------------------------------------------------------
  // Line forms come from the item translations: most name the skill with markup "[ColdAegis::{0}|冷気のイージス]",
  // which gives the skill's id; the others are matched by the skill's shown name. {0} is the skill level.
  // Returns { templates: [{ t, id }], skills: { id: { n, d, s: [lines], lv: { level: [lines] } } } }.
  function buildSkills(statList, lang, gems) {
    const byName = new Map();
    for (const [id, g] of Object.entries(gems)) {
      const n = g && g.active_skill && g.active_skill.display_name;
      if (n && !byName.has(n)) byName.set(n, id);
    }
    const names = [...byName.keys()].sort((a, b) => b.length - a.length);
    const templates = [];
    const used = new Set();
    for (const e of statList) {
      if (!e.ids.some((id) => /grant|trigger|skill/.test(id))) continue;
      for (const v of e[lang] || []) {
        if (!/\{0\}/.test(v.string)) continue;
        const m = /\[([A-Za-z0-9_]+)(?:::|<)[^|\]]*\|[^\]]*\]/.exec(v.string);
        let id = m && gems[m[1]] ? m[1] : null;
        const text = stripMarkup(v.string);
        if (!id) {
          // only lines that grant or trigger a skill ("+1 to Level of Socketed Gems" is not one)
          if (!e.ids.some((x) => /grants?_.*skill|skill.*level|trigger|on_gain_skill/.test(x))) continue;
          if (e.ids.some((x) => /gem_level|skill_level_\+|active_skill_level|per_x_player/.test(x))) continue;
          // {0} must be the skill's level ("Trigger Level {0} Ward Shatter", "レベル{0}ワードシャッター"), not a
          // chance or a gem requirement ("requiring Level {0} or lower"); "DNT" texts are unused
          if (!/(Level|レベル)\s*\{0\}/.test(text) || /requiring Level|以下|^DNT/.test(text)) continue;
          const name = names.find((n) => text.includes(n));
          id = name ? byName.get(name) : '';   // '' = the skill is not in the data; the popup says so
        }
        const parts = text.split('\n');
        const at = parts.findIndex((p) => p.includes('{0}'));
        for (let k = at; k < parts.length; k++) templates.push({ t: parts.slice(0, k + 1).join(' '), id });
        if (id) used.add(id);
      }
    }
    // Support gems on items ("ソケットされたジェムはレベル20 投射物回帰サポートによってサポートされる",
    // "Socketed Gems are Supported by Level 20 Returning Projectiles"). Most of these lines are not in the
    // translations, so they are matched by TEXT.supportLine and the support's name. The English line leaves
    // out the word "Support", so the name is stored with and without it.
    const supports = {};   // name -> support gem id
    const supportName = (g) => stripMarkup(String(g.display_name || (g.base_item && g.base_item.display_name) || '')).trim();
    for (const [id, g] of Object.entries(gems)) {
      if (!g || !g.is_support || !g.support_gem || !g.per_level) continue;
      const n = supportName(g);
      if (!n) continue;
      for (const k of unique([n, n.replace(/\s*(Support|サポート)$/i, '')])) {
        if (!k) continue;
        // the same name can belong to several ids; prefer the one that is a real gem item
        const old = supports[k] && gems[supports[k]];
        if (!old || (!old.base_item && g.base_item)) supports[k] = id;
      }
    }
    for (const id of Object.values(supports)) used.add(id);

    const clean = (s) => stripMarkup(String(s)).split('\n').map((x) => x.trim()).filter(Boolean);
    const texts = (o) => [].concat(...Object.values((o && o.stat_text) || {}).map(clean));
    const skills = {};
    for (const id of used) {
      const g = gems[id];
      const lv = {};
      for (const [level, p] of Object.entries(g.per_level || {})) {
        const t = texts(p);
        if (t.length) lv[level] = t;
      }
      const a = g.active_skill;
      const desc = a ? a.description : g.support_gem && g.support_gem.support_text;
      skills[id] = {
        n: a ? stripMarkup(a.display_name) : supportName(g),
        d: desc ? clean(desc) : [],
        s: texts(g.static),
        lv,
      };
    }
    return { templates, skills, supports };
  }

  function convertPoe1(f, versions) {
    const en = {};
    const enRank = new Map();
    const gggNodes = Object.values(f.ggg.nodes).filter((n) => n && typeof n === 'object' && n.name && Array.isArray(n.stats) && n.stats.length);
    const gggByName = new Map();
    const gggBySkill = new Map();
    for (const n of gggNodes) {
      gggBySkill.set(n.skill, n);
      const r = nodeRank(n.isKeystone, n.isNotable, !!n.ascendancyName);
      const lines = [];
      for (const s of n.stats) for (const l of stripMarkup(s).split('\n')) if (l.trim()) lines.push(l);
      addEntry(en, enRank, n.name, { n: n.name, l: lines, r: (n.reminderText || []).map(stripMarkup) }, r);
      const old = gggByName.get(n.name);
      if (!old || nodeRank(old.isKeystone, old.isNotable, !!old.ascendancyName) < r) gggByName.set(n.name, n);
    }

    const ja = {};
    const jaRank = new Map();
    const jaIndex = buildIndex([f.jaStatPassive, f.jaStatAura, f.jaStat]);
    const enLists = [f.enStatPassive, f.enStatAura, f.enStat];
    const toJapanese = buildReverse(enLists, jaIndex);
    const jaByHash = new Map();
    for (const p of Object.values(f.jaTree.passives)) {
      if (!p.name || !p.stats) continue;
      // RePoE's tree lacks some lines (granted skills, auras), so first turn the official English text
      // into Japanese; use RePoE's stats when that is not fully possible but RePoE has all the lines.
      const g = gggBySkill.get(p.hash);
      const fromStats = translateStats(p.stats, jaIndex, 'Japanese', f.jaHandlers);
      let entry = { n: p.name, l: fromStats.lines, r: fromStats.reminders };
      if (g) {
        const fromText = englishLinesToJapanese(g.stats, toJapanese);
        if (!fromText.failed || fromStats.lines.length < fromText.lines.length) {
          entry = { n: p.name, l: fromText.lines, r: fromText.reminders, f: fromText.failed ? 1 : 0 };
        }
      }
      entry.r = mergeReminders(entry.r, p.reminder_text);
      addEntry(ja, jaRank, p.name, entry, nodeRank(p.is_keystone, p.is_notable, !!p.ascendancy));
      if (entry.l.length) jaByHash.set(p.hash, entry);
    }

    const enNameById = new Map(f.enCluster.map((x) => [x.id, x.name]));
    const enStatById = new Map();
    for (const list of enLists) for (const e of list) for (const id of e.ids) if (!enStatById.has(id)) enStatById.set(id, e);
    const jaClusterPairs = [];
    const enClusterPairs = [];
    let clusterTotal = 0;
    let clusterJapaneseMissing = 0;
    for (const x of f.jaCluster) {
      clusterTotal++;
      const enName = enNameById.get(x.id);
      const je = jaIndex.get(x.jewel_stat);
      const ee = enStatById.get(x.jewel_stat);
      if (je && je.Japanese && je.Japanese[0]) jaClusterPairs.push({ text: stripMarkup(je.Japanese[0].string), name: x.name });
      if (ee && ee.English && ee.English[0]) enClusterPairs.push({ text: stripMarkup(ee.English[0].string), name: enName });
      const node = gggByName.get(enName);
      if (!node) continue;
      const r = englishLinesToJapanese(node.stats, toJapanese);
      if (r.failed) clusterJapaneseMissing++;
      addEntry(ja, jaRank, x.name, { n: x.name, l: r.lines, r: r.reminders, f: r.failed ? 1 : 0 }, 2);
    }
    // the game shows each reminder once, even when several lines name the same word ("Arcane Surge")
    for (const entry of Object.values(ja)) entry.r = unique(entry.r.map(cleanJaReminder));
    const lines = keystoneLines(f.enStat, f.jaStat, gggByName, jaByHash, en, toJapanese);

    return {
      versions,
      builtAt: Date.now(),
      templates: {
        ja: passiveTemplates([f.jaStatPassive, f.jaStatAura, f.jaStat], 'Japanese', jaClusterPairs),
        en: passiveTemplates(enLists, 'English', enClusterPairs),
      },
      names: { ja, en },
      lines,
      counts: { ja: Object.keys(ja).length, en: Object.keys(en).length, clusterTotal, clusterJapaneseMissing },
    };
  }

  function convertPoe2(f, versions) {
    const en = {};
    const rank = new Map();
    const index = buildIndex([f.statPassive, f.stat]);
    for (const p of Object.values(f.tree.passives)) {
      if (!p.name || !p.stats) continue;
      const r = translateStats(p.stats, index, 'English', f.handlers);
      addEntry(en, rank, p.name, { n: p.name, l: r.lines, r: mergeReminders(r.reminders, p.reminder_text) },
        nodeRank(p.is_keystone, p.is_notable, !!p.ascendancy));
    }
    return {
      versions,
      builtAt: Date.now(),
      templates: { en: passiveTemplates([f.statPassive, f.stat], 'English', []), ja: [] },
      names: { en, ja: {} },
      counts: { en: Object.keys(en).length, ja: 0 },
    };
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  let updating = false;
  async function updateData() {
    if (updating) return;
    updating = true;
    try {
      showButton(T.downloading(0, 1), true);
      const versions = await fetchLatestVersions(GAME);
      const files = Object.assign({}, SOURCES[GAME].files);
      if (GAME === 'poe1') files.ggg = SOURCES.poe1.gggDataUrl(versions.ggg);
      const keys = Object.keys(files);
      const total = keys.length + (GAME === 'poe1' ? 1 : 0);
      const got = {};
      for (let i = 0; i < keys.length; i++) {
        showButton(T.downloading(i + 1, total), true);
        got[keys[i]] = await getJson(files[keys[i]]);
      }
      let gems = null;
      if (GAME === 'poe1') {
        showButton(T.downloading(total, total), true);
        gems = await getJson(SOURCES.poe1.gems[LANG]);
      }
      showButton(T.converting, true);
      await new Promise((r) => setTimeout(r, 30));
      const data = GAME === 'poe1' ? convertPoe1(got, versions) : convertPoe2(got, versions);
      if (gems) {
        // keep the other language's skills from before; they are rebuilt when that page updates
        const old = GM_getValue(KEY_DATA, null);
        data.skills = Object.assign({}, old && old.skills, {
          [LANG]: buildSkills(LANG === 'ja' ? got.jaStat : got.enStat, LANG === 'ja' ? 'Japanese' : 'English', gems),
        });
        gems = null;
      }
      data.scriptVersion = SCRIPT_VERSION;
      GM_setValue(KEY_DATA, data);
      GM_setValue(KEY_CHECK, { at: Date.now(), latest: versions });
      loadTable();
      showButton(T.done(data.counts[LANG] || data.counts.en), true);
      setTimeout(hideButton, CONFIG.doneMessageMs);
    } catch (e) {
      console.error('[Mouseover Detail Viewer]', e);
      showButton(e.rateLimited ? T.rateLimited : T.failed(e.message), false);
    } finally {
      updating = false;
    }
  }

  async function dailyCheck() {
    const data = GM_getValue(KEY_DATA, null);
    if (!data) { showButton(T.buttonFirst, false); return; }
    // the skills are downloaded for one language at a time
    if (GAME === 'poe1' && !(data.skills && data.skills[LANG])) { showButton(T.buttonFirst, false); return; }
    // the data was made by another Version of this script: the way of making it may have changed
    if (SCRIPT_VERSION && data.scriptVersion !== SCRIPT_VERSION) { showButton(T.buttonNew, false); return; }
    const check = GM_getValue(KEY_CHECK, null);
    const due = !check || Date.now() - check.at > CONFIG.checkIntervalHours * 3600 * 1000;
    let latest = check && check.latest;
    if (due) {
      try {
        latest = await fetchLatestVersions(GAME);
        GM_setValue(KEY_CHECK, { at: Date.now(), latest });
      } catch (e) {
        // try again next time; record the time so a rate limit does not cause repeated calls
        GM_setValue(KEY_CHECK, { at: Date.now(), latest: check && check.latest });
        return;
      }
    }
    if (latest && !sameVersions(latest, data.versions)) showButton(T.buttonNew, false);
  }

  // ---------------------------------------------------------------------------
  // Lookup
  // ---------------------------------------------------------------------------
  let table = null;        // { name: entry } for this page's language
  let matchers = [];       // [{ rx }]
  let lineTable = {};      // whole line text -> entry (keystone lines)
  let skillTable = {};     // skill id -> skill (skills granted by items)
  let supportTable = {};   // support gem name -> skill id (support gems on items)
  const cache = new Map(); // line text -> entry | null

  function loadTable() {
    cache.clear();
    if (typeof hidePopup === 'function' && popup) hidePopup();   // the shown text may be from before the update
    const data = GM_getValue(KEY_DATA, null);
    if (!data) { table = null; lineTable = {}; skillTable = {}; supportTable = {}; matchers = []; return; }
    table = data.names[LANG] || {};
    lineTable = (data.lines && data.lines[LANG]) || {};
    const sk = (data.skills && data.skills[LANG]) || { templates: [], skills: {} };
    skillTable = sk.skills;
    supportTable = sk.supports || {};
    // strict forms first, and longer forms first ("Allocates {0} if you have ... Forbidden Flesh" before "Allocates {0}")
    const list = (data.templates[LANG] || []).map((x) => ({ t: x.t, loose: x.loose, skill: null }))
      .concat(sk.templates.map((x) => ({ t: x.t, loose: false, skill: x.id })))
      .sort((a, b) => Number(a.loose) - Number(b.loose) || b.t.length - a.t.length);
    matchers = list.map(({ t, loose, skill }) => {
      const parts = t.split('{0}');
      const hole = skill != null ? '(\\d+)' : '(.+?)';   // a skill line has the skill level in {0}
      return { rx: new RegExp('^' + parts.map((p) => escapeRe(p).replace(/\s+/g, '\\s*')).join(hole) + '$', 'i'), loose, skill };
    });
  }

  function skillEntry(id, level) {
    const s = skillTable[id];
    if (!s) return null;
    const levels = Object.keys(s.lv).map(Number).sort((a, b) => a - b);
    // the exact level, or the nearest level the data has
    let use = levels.filter((x) => x <= level).pop();
    if (use == null) use = levels[0];
    return { n: T.skillTitle(s.n, level), d: s.d, l: s.s.concat(use != null ? s.lv[use] : []), r: [] };
  }

  const normalize = (s) => s.replace(/\s+/g, ' ').trim();

  function findInTable(name) {
    if (table[name]) return table[name];
    if (lineTable[name] && !lineTable[name].missing) return lineTable[name];   // keystones missing from the tree data
    const lower = name.toLowerCase();
    const key = Object.keys(table).find((k) => k.toLowerCase() === lower);
    return key ? table[key] : null;
  }

  function lookup(text) {
    if (cache.has(text)) return cache.get(text);
    let result = lineTable[text] || null;
    if (result) { cache.set(text, result); return result; }
    const sm = T.supportLine.exec(normalize(text));
    if (sm) {
      const id = supportTable[normalize(sm[2])];
      result = (id && skillEntry(id, Number(sm[1]))) || { n: text, l: [], r: [], missing: true, skillMissing: true };
      cache.set(text, result);
      return result;
    }
    for (const { rx, loose, skill } of matchers) {
      const m = rx.exec(text);
      if (!m) continue;
      if (skill != null) {
        result = (skill && skillEntry(skill, Number(m[1]))) || { n: text, l: [], r: [], missing: true, skillMissing: true };
        break;
      }
      const name = normalize(m[1]);
      const found = findInTable(name);
      if (found) { result = found; break; }
      if (!loose) { result = { n: name, l: [], r: [], missing: true }; break; }
    }
    cache.set(text, result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Popup and button
  // ---------------------------------------------------------------------------
  const C = CONFIG.colors;
  const style = document.createElement('style');
  style.textContent = `
    .mpv-popup { position: fixed; z-index: 2147483000; display: none; box-sizing: border-box;
      max-width: ${CONFIG.popupMaxWidth}px; padding: 8px 12px; pointer-events: none;
      background: ${C.background}; border: 1px solid ${C.border}; border-radius: 4px;
      font-size: ${CONFIG.fontSize}px; line-height: 1.45; text-align: left; white-space: normal; }
    .mpv-name { color: ${C.name}; font-weight: bold; margin-bottom: 4px; }
    .mpv-line { color: ${C.effect}; }
    .mpv-desc { color: ${C.reminder}; margin-bottom: 4px; }
    .mpv-rem { color: ${C.reminder}; font-size: ${CONFIG.fontSize - 1}px; margin-top: 4px; }
    .mpv-note { color: ${C.note}; font-size: ${CONFIG.fontSize - 1}px; margin-top: 6px; }
    .mpv-button { position: fixed; right: 12px; bottom: 12px; z-index: 2147483001; max-width: 360px;
      padding: 6px 12px; cursor: pointer; font-size: ${CONFIG.fontSize}px; text-align: left;
      color: ${C.buttonText}; background: ${C.buttonBackground}; border: 1px solid ${C.border}; border-radius: 4px; }
    .mpv-button[disabled] { cursor: default; }
  `;
  document.head.appendChild(style);

  const popup = document.createElement('div');
  popup.className = 'mpv-popup';
  document.body.appendChild(popup);

  let button = null;
  function showButton(label, busy) {
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'mpv-button';
      button.addEventListener('click', () => { if (!updating) updateData(); });
      document.body.appendChild(button);
    }
    button.textContent = label;
    button.disabled = !!busy;
    button.style.display = '';
  }
  function hideButton() { if (button && !updating) button.style.display = 'none'; }

  function el(cls, text) {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    return d;
  }

  function fillPopup(entry) {
    popup.textContent = '';
    if (!entry) {
      popup.appendChild(el('mpv-note', T.noData));
      return;
    }
    popup.appendChild(el('mpv-name', entry.n));
    if (entry.missing) popup.appendChild(el('mpv-note', entry.skillMissing ? T.skillNotFound : T.notFound));
    for (const d of entry.d || []) popup.appendChild(el('mpv-desc', d));
    for (const l of entry.l) popup.appendChild(el('mpv-line', l));
    for (const r of unique(entry.r || [])) popup.appendChild(el('mpv-rem', r));   // also for data made before 1.0.1
    if (entry.f && T.noJapanese) popup.appendChild(el('mpv-note', T.noJapanese));
  }

  function placePopup(row) {
    const rr = row.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const m = CONFIG.screenMargin;
    popup.style.maxWidth = Math.min(CONFIG.popupMaxWidth, vw - m * 2) + 'px';
    popup.style.left = '0px';
    popup.style.top = '0px';
    popup.style.display = 'block';
    const pr = popup.getBoundingClientRect();
    let left = Math.min(Math.max(rr.left, m), vw - m - pr.width);
    let top = rr.bottom + CONFIG.popupGap;                     // normally just below the line
    if (top + pr.height > vh - m) {
      const above = rr.top - CONFIG.popupGap - pr.height;      // does not fit below: just above the line
      top = above >= m ? above : Math.max(m, vh - m - pr.height);
    }
    popup.style.left = Math.round(left) + 'px';
    popup.style.top = Math.round(top) + 'px';
  }

  function hidePopup() { popup.style.display = 'none'; currentRow = null; }

  // ---------------------------------------------------------------------------
  // Hover handling (event delegation, so lines added later by the page also work)
  // ---------------------------------------------------------------------------
  const ROW_SELECTOR = '.item-mod';
  let currentRow = null;
  let timer = 0;

  function rowText(row) {
    const s = row.querySelector('[data-field]') || row.querySelector('.s') || row;
    // the text may still have the game's markup ("レベル20[ColdAegis::20|冷気のイージス]をトリガーする")
    return normalize(stripMarkup(s.textContent || ''));
  }

  // POE2 on the Japanese site: Japanese data is not published, so the lines cannot be matched to
  // passives. Recognise them roughly by their words and explain how to see the effects.
  function isPassiveLineWithoutTemplates(row) {
    return /パッシブ|割り当て/.test(rowText(row));
  }

  document.addEventListener('mouseover', (ev) => {
    const row = ev.target instanceof Element ? ev.target.closest(ROW_SELECTOR) : null;
    if (row === currentRow) return;
    clearTimeout(timer);
    if (!row) { hidePopup(); return; }
    timer = setTimeout(() => {
      let entry;
      if (GAME === 'poe2' && LANG === 'ja') {
        if (!isPassiveLineWithoutTemplates(row)) { hidePopup(); return; }
        popup.textContent = '';
        popup.appendChild(el('mpv-note', T.noJapaneseData));
        currentRow = row;
        placePopup(row);
        return;
      }
      if (!table) {
        if (!/Passive Skill|Allocates|Grants Level|Trigger|Supported by Level|パッシブスキルを1個追加|を割り当てる|スキルを付与|をトリガー|サポートされる/i.test(rowText(row))) { hidePopup(); return; }
        entry = null;
      } else {
        entry = lookup(rowText(row));
        if (entry === null) { hidePopup(); return; }
      }
      fillPopup(entry);
      currentRow = row;
      placePopup(row);
    }, CONFIG.hoverDelayMs);
  }, true);

  window.addEventListener('scroll', () => { if (currentRow) placePopup(currentRow); }, true);
  window.addEventListener('resize', () => { if (currentRow) placePopup(currentRow); });

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  GM_registerMenuCommand(T.menuUpdate, updateData);
  loadTable();
  if (!(GAME === 'poe2' && LANG === 'ja')) dailyCheck();

  // for testing from the console of a test page
  if (TEST) TEST.api = { updateData, dailyCheck, loadTable, lookup, convertPoe1, convertPoe2, translateStats, buildIndex, GAME, LANG };
})();
