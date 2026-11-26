// ==UserScript==
// @name         Mouseover Detail Viewer
// @namespace    https://github.com/hanzoh-games/MouseoverDetailViewer
// @version      1.2.0
// @description  Path of Exile trade: hover a line that only names a passive, keystone or granted skill to see its effects, and open POEDB with one click. / Path of Exile のトレードの画面で、パッシブ・キーストーン・アイテムが付与するスキルの名前の行にマウスを重ねると、効果を表示します。POEDB もボタン1つで開けます。
// @author       hanzoh-games
// @license      MIT
// @match        https://*.pathofexile.com/trade*
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
    keystoneNameMaxWords: 5,       // an English keystone line of this many words or fewer is only the name ("Avatar of Fire")
    // Names found anywhere in a hovered line (keystones, skills). The lists come from checking every item line of
    // the game data in both languages: these names are also other game words, so they would show the wrong effect.
    nameScan: {
      minLength: { ja: 3, en: 3 },            // shorter names ("亀裂") are parts of other words
      exclude: {
        ja: ['ブライト', '感電領域', 'ポータル', 'アンブッシュ'],
        en: ['Blight', 'Ignite', 'Portal', 'Ambush', 'Reflection', 'Shocked Ground'],
      },
      // a name followed by one of these words is part of another game word ("Frenzy Charge", "Fireball Towers")
      notBefore: { ja: [], en: ['Charge', 'Charges', 'Tower', 'Towers', 'Encounter', 'Encounters', 'Scroll', 'Scrolls'] },
      // a name is not looked at in a line like this ("Power, Frenzy and Endurance Charges" are charges, not the skill)
      skipIf: { ja: {}, en: { Frenzy: '(Power|Endurance)(,| or| and)|(,| or| and) (Power|Endurance)' } },
      reminderMinFixed: 4,                    // a reminder line form needs at least this many fixed letters
      // letters that may not touch a found name (so "フレンジー" is not found in "フレンジーチャージ")
      boundary: { ja: 'ァ-ヶー・A-Za-z', en: "A-Za-z'\\-" },
    },
    // The POEDB button (always shown on the trade page; opens POEDB / POE2DB in a new tab)
    dbButton: {
      width: 88,                   // px, the part that opens POEDB
      height: 75,
      dragMargin: 12,              // px, the frame around it for moving it with the mouse
      left: 24,                    // px, first place (below the account links at the top left)
      top: 66,                     // below "メインサイトに戻る" (bottom at 61 px on the trade page)
      zIndex: 2147482999,          // below the effect popup
      frame: 'rgba(40, 30, 20, 0.85)',
      frameBorder: '#6b5530',
      background: '#1e160e',
      border: '#c8a050',
      icon: '#e0b860',
      iconFill: '#3a2a16',
      iconTop: '#5a4220',
      text: '#ffe08a',
    },
    // POEDB site and language part of the address. Pages other than Japanese open in English.
    poedb: {
      poe1: 'https://poedb.tw/',
      poe2: 'https://poe2db.tw/',
      lang: { ja: 'jp', en: 'us' },
    },
    // trade "Item Category" id -> POEDB page. Categories without a page (e.g. "Any Weapon") open the top page.
    poedbPages: {
      poe1: {
        'weapon.bow': 'Bows', 'weapon.claw': 'Claws', 'weapon.dagger': 'Daggers', 'weapon.basedagger': 'Daggers',
        'weapon.runedagger': 'Rune_Daggers', 'weapon.oneaxe': 'One_Hand_Axes', 'weapon.onesword': 'One_Hand_Swords',
        'weapon.basesword': 'One_Hand_Swords', 'weapon.rapier': 'Thrusting_One_Hand_Swords', 'weapon.onemace': 'One_Hand_Maces',
        'weapon.basemace': 'One_Hand_Maces', 'weapon.sceptre': 'Sceptres', 'weapon.staff': 'Staves', 'weapon.basestaff': 'Staves',
        'weapon.warstaff': 'Warstaves', 'weapon.twoaxe': 'Two_Hand_Axes', 'weapon.twomace': 'Two_Hand_Maces',
        'weapon.twosword': 'Two_Hand_Swords', 'weapon.wand': 'Wands', 'weapon.rod': 'Fishing_Rods',
        'armour.chest': 'Body_Armours', 'armour.boots': 'Boots', 'armour.gloves': 'Gloves', 'armour.helmet': 'Helmets',
        'armour.shield': 'Shields', 'armour.quiver': 'Quivers',
        'accessory.amulet': 'Amulets', 'accessory.belt': 'Belts', 'accessory.ring': 'Rings', 'accessory.trinket': 'Trinkets',
        'gem': 'Gem', 'gem.activegem': 'Skill_Gems', 'gem.supportgem': 'Support_Gems', 'gem.supportgemplus': 'Support_Gems',
        'jewel': 'Jewels', 'jewel.base': 'Jewels', 'jewel.abyss': 'Abyss_Jewels', 'jewel.cluster': 'Cluster_Jewel',
        'flask': 'Flasks', 'map': 'Maps', 'map.fragment': 'Map_Fragments', 'map.breachstone': 'Breachstones',
        'map.invitation': 'Misc_Map_Items', 'map.scarab': 'Map_Fragments', 'card': 'Divination_Cards',
        'monster.beast': 'Bestiary', 'monster.yellowbeast': 'Bestiary', 'monster.redbeast': 'Bestiary',
        'heistequipment': 'Heist', 'heistequipment.heistweapon': 'Heist_Gear', 'heistequipment.heisttool': 'Heist_Tools',
        'heistequipment.heistutility': 'Heist_Cloaks', 'heistequipment.heistreward': 'Heist_Brooches',
        'heistmission': 'Heist', 'heistmission.contract': 'Contracts', 'heistmission.blueprint': 'Blueprints',
        'logbook': 'Expedition_Logbooks', 'sanctum.research': 'Sanctum_Research', 'sanctum.relic': 'Relics',
        'tincture': 'Tinctures', 'corpse': 'Corpses', 'graft': 'Graft', 'chart': 'Chart', 'viscera': 'Viscera',
        'currency': 'Currency', 'currency.piece': 'Pieces', 'currency.resonator': 'Resonator', 'currency.fossil': 'Fossil',
        'currency.incubator': 'Incubators', 'currency.heistobjective': 'Heist_Targets', 'currency.omen': 'Omen',
        'currency.tattoo': 'Tattoo',
      },
      poe2: {
        'weapon.claw': 'Claws', 'weapon.dagger': 'Daggers', 'weapon.onesword': 'One_Hand_Swords', 'weapon.oneaxe': 'One_Hand_Axes',
        'weapon.onemace': 'One_Hand_Maces', 'weapon.spear': 'Spears', 'weapon.flail': 'Flails', 'weapon.twosword': 'Two_Hand_Swords',
        'weapon.twoaxe': 'Two_Hand_Axes', 'weapon.twomace': 'Two_Hand_Maces', 'weapon.warstaff': 'Quarterstaves',
        'weapon.talisman': 'Talismans', 'weapon.bow': 'Bows', 'weapon.crossbow': 'Crossbows', 'weapon.wand': 'Wands',
        'weapon.sceptre': 'Sceptres', 'weapon.staff': 'Staves', 'weapon.rod': 'Fishing_Rods',
        'armour.helmet': 'Helmets', 'armour.chest': 'Body_Armours', 'armour.gloves': 'Gloves', 'armour.boots': 'Boots',
        'armour.quiver': 'Quivers', 'armour.shield': 'Shields', 'armour.focus': 'Foci', 'armour.buckler': 'Bucklers',
        'accessory.amulet': 'Amulets', 'accessory.belt': 'Belts', 'accessory.ring': 'Rings',
        'gem': 'Gem', 'gem.activegem': 'Skill_Gems', 'gem.supportgem': 'Support_Gems', 'gem.metagem': 'Meta_Skill_Gem',
        'jewel': 'Jewels', 'flask': 'Flasks', 'flask.life': 'Life_Flasks', 'flask.mana': 'Mana_Flasks', 'flask.charm': 'Charms',
        'map.waystone': 'Waystones', 'map.fragment': 'Map_Fragments', 'map.breachstone': 'Breachstone', 'map.barya': 'Trial_Coins',
        'map.bosskey': 'Pinnacle_Keys', 'map.ultimatum': 'Inscribed_Ultimatum', 'map.tablet': 'Tablet', 'card': 'Divination_Cards',
        'sanctum.relic': 'Relics', 'currency': 'Stackable_Currency', 'currency.omen': 'Omen', 'currency.socketable': 'Augment',
        'currency.rune': 'Runes', 'currency.soulcore': 'Augment', 'currency.idol': 'Augment',
      },
    },
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
      dbOpen: 'POEDB を新しいタブで開きます(検索中のアイテムの種類のページ)',
      dbMove: 'ドラッグすると移動します',
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
      dbOpen: 'Open POEDB in a new tab (the page of the item category being searched)',
      dbMove: 'Drag to move',
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
  // the trade site in other languages (de., fr., ...): only the POEDB button works there, because the
  // detail data is made for Japanese and English
  const OTHER_LANG = !TEST && !/^(www|jp)\./.test(location.hostname);
  const T = TEXT[LANG];
  const KEY_DATA = 'data_' + GAME;          // converted table
  const KEY_CHECK = 'check_' + GAME;        // { at: time of last check, latest: versions found }
  // The Version of the way the data is made; stored with the data, so data made by an older script is rebuilt.
  // Change it only when the conversion changes (a new Version that only changes the page does not ask for a rebuild).
  const DATA_VERSION = '1.2.0';

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
    const out = { ja: {}, en: {}, names: { ja: [], en: [] } };   // names: lines that are only a keystone's name
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
        // "Avatar of Fire" is a name; "You have Shepherd of Souls if at least 4 ..." is a sentence
        const isName = line.split(' ').length <= CONFIG.keystoneNameMaxWords;
        if (isName) out.names.en.push(line);
        const jv = je && je.Japanese && je.ids.join('|') === e.ids.join('|') && (je.Japanese[vi] || je.Japanese[0]);
        if (!jv) return;
        const jline = normalize(stripMarkup(jv.string));
        if (!jline || /\{\d+\}/.test(jline)) return;
        if (isName) out.names.ja.push(jline);
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

    // Skill names found anywhere in a line ("Herald of Thunder has 20% increased Mana Reservation Efficiency"):
    // name -> gem id. Names that are also other game words (Blight: the league, Ignite: the ailment) are left out.
    const L = lang === 'Japanese' ? 'ja' : 'en';
    const exclude = new Set(CONFIG.nameScan.exclude[L]);
    const scanNames = {};
    for (const [id, g] of Object.entries(gems)) {
      if (!g) continue;
      const n = stripMarkup(String((g.active_skill && g.active_skill.display_name) || (g.is_support && supportName(g)) || '')).trim();
      if (n.length < CONFIG.nameScan.minLength[L] || exclude.has(n)) continue;
      const old = scanNames[n] && gems[scanNames[n]];
      if (!old || (!old.base_item && g.base_item)) scanNames[n] = id;
    }
    const nameOnly = new Set(Object.values(scanNames).filter((id) => !used.has(id)));

    const clean = (s) => stripMarkup(String(s)).split('\n').map((x) => x.trim()).filter(Boolean);
    const texts = (o) => [].concat(...Object.values((o && o.stat_text) || {}).map(clean));
    const skills = {};
    for (const id of [...used, ...nameOnly]) {
      const g = gems[id];
      const lv = {};
      // a skill only named in a line has no level there, so its level texts are not kept (they are large)
      if (!nameOnly.has(id)) {
        for (const [level, p] of Object.entries(g.per_level || {})) {
          const t = texts(p);
          if (t.length) lv[level] = t;
        }
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
    return { templates, skills, supports, names: scanNames };
  }

  // Item lines whose game text has a reminder ("ヒット時に敵を灰まみれにする" -> "(灰まみれの敵は…)"):
  // [{ t: line with {0} holes, r: [reminder lines] }]. A form with too little fixed text ("{0}") is left out.
  function reminderTemplates(statList, lang) {
    const byText = new Map();
    for (const e of statList) {
      for (const v of e[lang] || []) {
        if (!v.reminder_text || !v.string) continue;
        let r = stripMarkup(String(v.reminder_text)).trim();
        if (lang === 'Japanese') r = cleanJaReminder(r);
        const rl = r.split('\n').map((x) => x.trim()).filter(Boolean);
        for (const line of stripMarkup(v.string).split('\n')) {
          const t = normalize(line);
          if (t.replace(/\{\d+\}|[\s+\-%#]/g, '').length < CONFIG.nameScan.reminderMinFixed) continue;
          byText.set(t, unique((byText.get(t) || []).concat(rl)));
        }
      }
    }
    return [...byText].map(([t, r]) => ({ t, r }));
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
    const kl = keystoneLines(f.enStat, f.jaStat, gggByName, jaByHash, en, toJapanese);
    const lines = { ja: kl.ja, en: kl.en };
    const keystoneNames = { ja: unique(kl.names.ja), en: unique(kl.names.en) };
    const reminders = { ja: reminderTemplates(f.jaStat, 'Japanese'), en: reminderTemplates(f.enStat, 'English') };

    return {
      versions,
      builtAt: Date.now(),
      templates: {
        ja: passiveTemplates([f.jaStatPassive, f.jaStatAura, f.jaStat], 'Japanese', jaClusterPairs),
        en: passiveTemplates(enLists, 'English', enClusterPairs),
      },
      names: { ja, en },
      lines,
      keystoneNames,
      reminders,
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
      data.scriptVersion = DATA_VERSION;
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
    // the data was made by an older way of making it
    if (data.scriptVersion !== DATA_VERSION) { showButton(T.buttonNew, false); return; }
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
  let nameRx = null;       // finds keystone and skill names anywhere in a line
  let nameKinds = {};      // name -> { k: keystone entry } | { s: skill id }
  let reminderMatchers = []; // [{ rx, r }] lines whose game text has a reminder
  const cache = new Map(); // line text -> entry | null

  function loadTable() {
    cache.clear();
    if (typeof hidePopup === 'function' && popup) hidePopup();   // the shown text may be from before the update
    const data = GM_getValue(KEY_DATA, null);
    nameRx = null; nameKinds = {}; reminderMatchers = [];
    if (!data) { table = null; lineTable = {}; skillTable = {}; supportTable = {}; matchers = []; return; }
    table = data.names[LANG] || {};
    lineTable = (data.lines && data.lines[LANG]) || {};
    const sk = (data.skills && data.skills[LANG]) || { templates: [], skills: {} };
    skillTable = sk.skills;
    supportTable = sk.supports || {};

    // names found anywhere in a line: keystones first (a skill can have the same name), longer names first
    for (const [n, id] of Object.entries(sk.names || {})) nameKinds[n] = { s: id };
    for (const n of (data.keystoneNames && data.keystoneNames[LANG]) || []) {
      const e = lineTable[n] || table[n];
      if (e && !e.missing) nameKinds[n] = { k: e };
    }
    const S = CONFIG.nameScan;
    const scanList = Object.keys(nameKinds).sort((a, b) => b.length - a.length).map(escapeRe);
    if (scanList.length) {
      const b = S.boundary[LANG] || S.boundary.en;
      const after = (S.notBefore[LANG] || []).length ? `(?!\\s+(?:${S.notBefore[LANG].map(escapeRe).join('|')})(?![A-Za-z]))` : '';
      nameRx = new RegExp(`(?<![${b}])(${scanList.join('|')})(?![${b}])${after}`, 'g');
    }
    reminderMatchers = ((data.reminders && data.reminders[LANG]) || []).map(({ t, r }) => ({
      rx: new RegExp('^' + t.split(/\{\d+\}/).map((p) => escapeRe(p).replace(/\s+/g, '\\s*')).join('(.+?)') + '$', 'i'),
      r,
    }));
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
    if (!result) result = findNamesAndReminders(normalize(text));
    cache.set(text, result);
    return result;
  }

  // Any other line: the keystones and skills named in it, and the game's reminder for the line's form.
  // ("召喚したスケルトンはアバターオブファイヤーを持つ", "ヘラルドオブサンダーのマナリザーブ効率が20%増加する")
  function findNamesAndReminders(text) {
    const parts = [];
    if (nameRx) {
      nameRx.lastIndex = 0;
      const seen = new Set();
      for (const m of text.matchAll(nameRx)) {
        const n = m[1];
        if (seen.has(n)) continue;
        seen.add(n);
        const skip = (CONFIG.nameScan.skipIf[LANG] || {})[n];
        if (skip && new RegExp(skip).test(text)) continue;
        const kind = nameKinds[n];
        const e = kind.k || nameEntry(kind.s);
        if (e) parts.push(e);
      }
    }
    for (const { rx, r } of reminderMatchers) {
      if (!rx.test(text)) continue;
      // the reminder can repeat the effects already shown ("(Avatar of Fire: 50% of Physical, ...)")
      const flat = (s) => String(s).replace(/^\(\s*[A-Za-z][A-Za-z0-9 '\-]*:\s*/, '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
      const known = [].concat(...parts.map((p) => (p.l || []).concat(p.r || []))).map(flat).join('|');
      const rest = r.filter((x) => { const f = flat(x); return f && !known.includes(f); });
      if (rest.length) parts.push({ n: '', l: [], r: rest });
      break;
    }
    if (!parts.length) return null;
    return parts.length === 1 ? parts[0] : { multi: parts };
  }

  function nameEntry(id) {
    const s = skillTable[id];
    return s ? { n: s.n, d: s.d, l: s.s, r: [] } : null;
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
    .mpv-sep { border-top: 1px solid ${C.border}; margin: 6px 0; }
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
    if (entry.multi) {
      // several names in one line: each one's effects, one under another
      entry.multi.forEach((part, i) => {
        if (i) popup.appendChild(el('mpv-sep', ''));
        fillPart(part);
      });
      return;
    }
    fillPart(entry);
  }

  function fillPart(entry) {
    if (entry.n) popup.appendChild(el('mpv-name', entry.n));
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
    if (OTHER_LANG) return;
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
  // POEDB button (top left; the frame around it moves it, the inside opens POEDB)
  // ---------------------------------------------------------------------------
  const KEY_DB_POS = 'dbButtonPos';         // { left, top } in px, the same for POE1 and POE2
  let categories = null;                     // [{ id, text }] of the trade site's "Item Category", in the page's language
  let categoryTitle = '';                    // the filter's title ("アイテムカテゴリー", "Item Category")

  async function loadCategories() {
    try {
      const r = await fetch(GAME === 'poe2' ? '/api/trade2/data/filters' : '/api/trade/data/filters', { credentials: 'same-origin' });
      const j = await r.json();
      const type = j.result.find((x) => x.id === 'type_filters');
      const cat = type && type.filters.find((x) => x.id === 'category');
      if (!cat) return;
      categoryTitle = String(cat.text || '').trim();
      categories = cat.option.options.filter((o) => o.id).map((o) => ({ id: o.id, text: String(o.text).trim() }));
    } catch (e) {
      console.warn('[Mouseover Detail Viewer] item categories could not be read', e);   // the button opens the top page
    }
  }

  // "One-Handed Sword" and "One Handed Sword" are the same; the result's item class has no "Any"/"いずれかの"
  const squash = (s) => String(s).toLowerCase().replace(/[\s\-‐_・]/g, '');
  function categoryIdOf(text) {
    if (!categories || !text) return null;
    const t = squash(text);
    if (!t) return null;
    const exact = categories.find((c) => squash(c.text) === t);
    if (exact) return exact.id;
    const ends = categories.filter((c) => squash(c.text).endsWith(t)).sort((a, b) => a.text.length - b.text.length);
    return ends.length ? ends[0].id : null;
  }

  function searchedCategory() {
    // 1. the "Item Category" filter of the search
    const title = categoryTitle && [...document.querySelectorAll('.filter-title')].find((e) => e.textContent.trim() === categoryTitle);
    const filter = title && title.closest('.filter');
    if (filter) {
      const picked = filter.querySelector('.multiselect__single');
      const input = filter.querySelector('.multiselect__input');
      const id = categoryIdOf((picked && picked.textContent) || (input && input.value));
      if (id) return id;
    }
    // 2. the item class shown on the first result ("弓", "Bow"); it is the first line of the item that has no value
    const first = document.querySelector('.resultset .item-popup__content > .item-popup__property');
    if (first && first.querySelectorAll('span').length <= 2) {   // "Physical Damage: 32-96" has more spans
      const id = categoryIdOf(first.textContent);
      if (id) return id;
    }
    return null;
  }

  function poedbUrl() {
    const base = CONFIG.poedb[GAME] + (CONFIG.poedb.lang[LANG] || CONFIG.poedb.lang.en) + '/';
    const id = searchedCategory();
    const page = id && CONFIG.poedbPages[GAME][id];
    return page ? base + page : base;
  }

  function makeDbButton() {
    const B = CONFIG.dbButton;
    const css = document.createElement('style');
    css.textContent = `
      .mpv-db { position: fixed; z-index: ${B.zIndex}; box-sizing: border-box; padding: ${B.dragMargin}px;
        background: ${B.frame}; border: 1px dashed ${B.frameBorder}; border-radius: 8px; cursor: move;
        touch-action: none; user-select: none; }
      .mpv-db a { display: block; box-sizing: border-box; width: ${B.width}px; height: ${B.height}px; cursor: pointer;
        background: ${B.background}; border: 2px solid ${B.border}; border-radius: 6px; }
      .mpv-db a:hover { filter: brightness(1.25); }
      .mpv-db svg { display: block; width: 100%; height: 100%; }
    `;
    document.head.appendChild(css);

    const box = document.createElement('div');
    box.className = 'mpv-db';
    box.title = T.dbMove;
    const link = document.createElement('a');
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = T.dbOpen;
    link.href = poedbUrl();
    // a cylinder (the shape of a database) with "DB" on it
    link.innerHTML = `<svg viewBox="0 0 88 75" aria-hidden="true">
      <path d="M21,16 L21,56 A23,7 0 0 0 67,56 L67,16" fill="${B.iconFill}" stroke="${B.icon}" stroke-width="2"/>
      <path d="M21,30 A23,7 0 0 0 67,30" fill="none" stroke="${B.icon}" stroke-width="1.5"/>
      <path d="M21,44 A23,7 0 0 0 67,44" fill="none" stroke="${B.icon}" stroke-width="1.5"/>
      <ellipse cx="44" cy="16" rx="23" ry="7" fill="${B.iconTop}" stroke="${B.icon}" stroke-width="2"/>
      <text x="44" y="47" fill="${B.text}" font-size="17" font-weight="bold" font-family="sans-serif" text-anchor="middle">DB</text>
    </svg>`;
    link.setAttribute('aria-label', T.dbOpen);
    // the address is decided when the link is about to be used, so it follows the current search
    const refresh = () => { link.href = poedbUrl(); };
    link.addEventListener('pointerenter', refresh);
    link.addEventListener('pointerdown', refresh);
    link.addEventListener('focus', refresh);
    box.appendChild(link);
    document.body.appendChild(box);

    const place = (left, top) => {
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const r = box.getBoundingClientRect();
      // keep it inside the window (for example after the window was made smaller)
      left = Math.min(Math.max(0, left), Math.max(0, vw - r.width));
      top = Math.min(Math.max(0, top), Math.max(0, vh - r.height));
      box.style.left = Math.round(left) + 'px';
      box.style.top = Math.round(top) + 'px';
      return { left: Math.round(left), top: Math.round(top) };
    };
    const saved = GM_getValue(KEY_DB_POS, null);
    let pos = place(saved ? saved.left : B.left, saved ? saved.top : B.top);

    // drag by the frame only; the inside is the link
    let drag = null;
    box.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || link.contains(ev.target)) return;
      drag = { x: ev.clientX - pos.left, y: ev.clientY - pos.top };
      box.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    box.addEventListener('pointermove', (ev) => {
      if (drag) pos = place(ev.clientX - drag.x, ev.clientY - drag.y);
    });
    const end = () => { if (drag) { drag = null; GM_setValue(KEY_DB_POS, pos); } };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    window.addEventListener('resize', () => { pos = place(pos.left, pos.top); });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  makeDbButton();
  loadCategories();
  if (OTHER_LANG) return;
  GM_registerMenuCommand(T.menuUpdate, updateData);
  loadTable();
  if (!(GAME === 'poe2' && LANG === 'ja')) dailyCheck();

  // for testing from the console of a test page
  if (TEST) TEST.api = { updateData, dailyCheck, loadTable, lookup, convertPoe1, convertPoe2, translateStats, buildIndex, GAME, LANG };
})();
