// ==UserScript==
// @name         Mouseover Detail Viewer
// @namespace    https://github.com/hanzoh-games/MouseoverDetailViewer
// @version      1.3.0
// @description  Path of Exile trade: hover a line that names a passive, keystone, skill or buff to see its effects, and open POEDB with one click. / Path of Exile のトレード画面で、パッシブ名・キーストーン名・スキル名・バフ名が入った行にマウスカーソルを重ねると、その効果を表示します。POEDB もボタン1つで開けます。
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
    // The popup is shown left of the item's lines (over the item's picture), so that it covers no line, with its top
    // just below the hovered line (or its bottom just above it). Where that is too narrow, a tall popup may cover other
    // items' lines, then the left end of a longer line of the hovered item; never the hovered line. Where it does not
    // fit left of the hovered line (less than popupSideMinWidth px, or taller than the screen even in two columns), it
    // is shown just below or above the hovered line instead.
    popupSideGap: 8,               // px between the popup and the lines on its right
    popupSideMinWidth: 260,        // px
    itemLineGap: 40,               // px: lines further apart than this are of different items (see itemRows)
    // a popup of several parts (the six Blood Shrine buffs) that is taller than the screen left of the lines, or
    // (below or above the line) that fits neither below nor above the line, is shown in two columns
    popupColumnsMaxWidth: 940,     // px (below or above the line)
    popupColumnGap: 12,            // px between the two columns
    popupGap: 4,                   // px between the hovered line and the popup
    screenMargin: 8,               // px kept free at the screen edges
    hoverDelayMs: 80,              // wait before showing, so moving the mouse across lines does not flicker
    doneMessageMs: 4000,           // how long "Updated" stays on the button
    historyMax: 200,               // updates kept in the update history (the oldest are dropped)
    // the list of the names that an update no longer shows, and the update history (bottom right of the screen)
    historyPanel: { width: 420, bottom: 52, listMaxHeight: 60 },   // px, px from the screen bottom, % of the screen height
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
    // Names found anywhere in a hovered line (keystones, skills). A skill name that the English item text also writes
    // in lower case ("ignite", "ambush") is an ordinary word there, so it is not looked for (on the Japanese page: the
    // same skill's Japanese name). exclude and keep are the hand check of every item line of the data of 2026-11 in
    // both languages; names that later data adds are decided by the rule alone, so these lists are not added to.
    nameScan: {
      minLength: { ja: 3, en: 3 },            // shorter names ("亀裂") are parts of other words
      // also other game words, though not written in lower case (Blight: the league), so they would show the wrong effect
      exclude: {
        ja: ['ブライト', '感電領域', 'ポータル', 'アンブッシュ'],
        en: ['Blight', 'Ignite', 'Portal', 'Ambush', 'Reflection', 'Shocked Ground'],
      },
      keep: { ja: [], en: [] },               // written in lower case too, but the item lines mean the skill
      // a name followed by one of these words is part of another game word ("Frenzy Charge", "Fireball Towers")
      notBefore: { ja: [], en: ['Charge', 'Charges', 'Tower', 'Towers', 'Encounter', 'Encounters', 'Scroll', 'Scrolls'] },
      // a name is not looked at in a line like this ("Power, Frenzy and Endurance Charges" are charges, not the skill)
      skipIf: { ja: {}, en: { Frenzy: '(Power|Endurance)(,| or| and)|(,| or| and) (Power|Endurance)' } },
      formMinFixed: 4,                        // a line form found by its names needs at least this many fixed letters
      // letters that may not touch a found name (so "フレンジー" is not found in "フレンジーチャージ")
      boundary: { ja: 'ァ-ヶー・A-Za-z', en: "A-Za-z'\\-" },
    },
    // Buffs, states, charges and grounds named in a line ("猛攻", "Onslaught"): the effects from the game's buff data.
    // The Japanese name in the buff data can differ from the item text ("アーケーンサージ" / "アーケインサージ"), so the
    // buff is found in the English text of the same line, on both pages.
    buffScan: {
      // A buff found by its English name is shown when the data marks it as shown in the game (not invisible), its
      // English text says more than its name (at least minTextWords other words: "Frozen solid" does not), and the
      // English item text never writes its name in lower case (an ordinary word: "on death"). A line naming
      // "<family> buff" shows every buff named "<family> of ..." ("Gain a random Blood Shrine buff every 10 seconds";
      // the ordinary "random Shrine buff" is not a family: the data does not say which shrines it gives).
      // exclude and keep are the hand check of every item line of the data of 2026-11; names that later data adds are
      // decided by these rules alone, so the lists are not added to.
      minTextWords: 2,
      textStopWords: ['you', 'are', 'been', 'being', 'have', 'has', 'had', 'the', 'and', 'your', 'from', 'with', 'while',
        'when', 'its', 'that', 'this', 'for', 'not'],
      // shown by the rules, but general words that are also a buff's name ("Fire Damage"), a text that only repeats the
      // name ("Frozen": "凍結している"), or a text about something else ("Burning" is the burning from Herald of Ash)
      exclude: [
        'Critical Strike Chance', 'Critical Strike Multiplier', 'Fire Damage', 'Cold Damage', 'Lightning Damage', 'Fire',
        'Attack and Cast Speed', 'Mana Cost', 'Converted', 'Death', 'Immunity', 'Imprisoned', 'Item Rarity', 'Light',
        'Darkness', 'Stone', 'Blight', 'Tincture', 'Focused', 'Reflection', 'Ambush', 'Chained', 'Restore', 'Bark',
        'Delirious', 'Insanity', 'Instability', 'Rats', 'Burning', 'Life Leech', 'Mana Leech', 'Energy Shield Leech',
        'Life Regeneration', 'Mana Regeneration', 'Energy Shield Regeneration', 'Diamond Flask', 'Bismuth Flask',
        'Amethyst Flask', 'Frozen', 'Ignited', 'Chilled', 'Poisoned', 'Petrified', 'Petrification', 'Stone Gaze',
        'Ghost Shroud', 'Gale Force',
      ],
      // hidden by the rules, but the item lines mean the buff
      keep: ['Rage', 'Taunted', 'Divine Charge', 'Desecrated Ground', 'Decay', 'Impale Effect', 'Union of Souls',
        'Shrouded Shrine', 'Skeletal Shrine'],
      minLength: 3,
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
      // skills granted by items; about 40 MB each. The Japanese page also downloads the English file, but keeps only
      // the English names (they find the skills that the Japanese text names differently from the data).
      gems: { ja: REPOE1 + '/Japanese/gems.json', en: REPOE1 + '/gems.json' },
      // buffs (猛攻, シュライン, ...); both pages use both: the English names, the Japanese texts (the Japanese page),
      // and the Japanese names that the game's explanations of terms begin with ("凍結は、…", see pairLines)
      buffs: { ja: REPOE1 + '/Japanese/buffs.json', en: REPOE1 + '/buffs.json' },
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
      menuHistory: '更新履歴を表示',
      removedTitle: (n) => `今回の更新で表示されなくなった項目(${n} 件)`,
      historyTitle: '更新履歴(表示されなくなった項目)',
      historyEmpty: '表示されなくなった項目は、まだありません。',
      historySave: 'ファイルに保存',
      historyClose: '閉じる',
      historyFile: 'MouseoverDetailViewer_更新履歴.txt',
      historyFileTitle: 'Mouseover Detail Viewer 更新履歴(データの更新で表示されなくなった項目)',
      kinds: { passive: 'パッシブ', skill: 'スキル', buff: 'バフ' },
      pages: { ja: '日本語画面', en: '英語画面' },
      rateLimited: 'GitHub の回数上限に達しました。1時間ほど後に、もう一度押してください。',
      noData: '効果データがありません。画面右下の「効果データ ★」か、Tampermonkey のメニューの「データを更新」を押してください。',
      noJapanese: '日本語の文がありません(英語の文を表示しています)。',
      noJapaneseData: 'POE2 の日本語データは公開されていないため、日本語画面では表示できません。トレード画面を英語に切り替えると表示できます。',
      notFound: 'このパッシブの効果は、データの中に見つかりませんでした。',
      skillTitle: (n, l) => `${n}(レベル ${l})`,
      // a name that the line does not write itself, with its English name ("残忍なシュライン(Brutal Shrine)")
      withEnglish: (n, e) => `${n}(${e})`,
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
      menuHistory: 'Show update history',
      removedTitle: (n) => `No longer shown after this update (${n})`,
      historyTitle: 'Update history (no longer shown)',
      historyEmpty: 'Nothing has stopped being shown yet.',
      historySave: 'Save to file',
      historyClose: 'Close',
      historyFile: 'MouseoverDetailViewer_update_history.txt',
      historyFileTitle: 'Mouseover Detail Viewer update history (what a data update stopped showing)',
      kinds: { passive: 'Passive', skill: 'Skill', buff: 'Buff' },
      pages: { ja: 'Japanese page', en: 'English page' },
      rateLimited: 'GitHub request limit reached. Please try again in about an hour.',
      noData: 'No detail data yet. Click "Detail data ★" at the bottom right, or "Update data" in the Tampermonkey menu.',
      noJapanese: '',
      noJapaneseData: '',
      notFound: 'The effects of this passive were not found in the data.',
      skillTitle: (n, l) => `${n} (Level ${l})`,
      withEnglish: (n) => n,
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
  const KEY_HISTORY = 'history';            // update history: [{ at, game, lang, items: [[kind, name]] }], newest first
  // The Version of the way the data is made; stored with the data, so data made by an older script is rebuilt.
  // Change it only when the conversion changes (a new Version that only changes the page does not ask for a rebuild).
  const DATA_VERSION = '1.3.0.2';

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
  // a line form with {0} holes -> a RegExp for the whole line (the spaces on the trade page can differ)
  const formRx = (t) => new RegExp('^' + t.split(/\{\d+\}/).map((p) => escapeRe(p).replace(/\s+/g, '\\s*')).join('(.+?)') + '$', 'i');

  // Finds names anywhere in a text, with the rules of CONFIG.nameScan for the language: letters that may not touch
  // a name, words that may not follow it, and lines where a name is not looked at. Returns (text) => [names].
  function nameFinder(names, L, rules) {
    const S = rules || CONFIG.nameScan;
    const list = [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length).map(escapeRe);
    if (!list.length) return () => [];
    const b = S.boundary[L] || S.boundary.en;
    const nb = (S.notBefore && S.notBefore[L]) || [];
    const after = nb.length ? `(?!\\s+(?:${nb.map(escapeRe).join('|')})(?![A-Za-z]))` : '';
    const rx = new RegExp(`(?<![${b}])(${list.join('|')})(?![${b}])${after}`, 'g');
    const skipIf = (S.skipIf && S.skipIf[L]) || {};
    return (text) => {
      const out = [];
      for (const m of text.matchAll(rx)) {
        const n = m[1];
        if (out.includes(n) || (skipIf[n] && new RegExp(skipIf[n]).test(text))) continue;
        out.push(n);
      }
      return out;
    };
  }

  // The names that the English item text also writes in lower case ("on death", "restore"): ordinary words there,
  // so they are not looked for as names (CONFIG.nameScan, CONFIG.buffScan). Returns a Set of the names.
  function ordinaryNames(enStat, names) {
    const low = new Map();   // lower case -> the names
    for (const n of names) {
      const l = String(n || '').toLowerCase();
      if (l.length < 3 || l === n) continue;
      if (!low.has(l)) low.set(l, new Set());
      low.get(l).add(n);
    }
    const out = new Set();
    if (!low.size) return out;
    const b = CONFIG.nameScan.boundary.en;
    const rx = new RegExp(`(?<![${b}])(${[...low.keys()].sort((x, y) => y.length - x.length).map(escapeRe).join('|')})(?![${b}])`, 'g');
    for (const e of enStat) {
      for (const v of e.English || []) {
        for (const m of stripMarkup(String(v.string || '')).matchAll(rx)) for (const n of low.get(m[1])) out.add(n);
      }
    }
    return out;
  }

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
    // names: lines that are only a keystone's name; nameMap: English name -> Japanese name of the same line
    const out = { ja: {}, en: {}, names: { ja: [], en: [] }, nameMap: {} };
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
        if (isName) {
          out.names.ja.push(jline);
          out.nameMap[line] = jline;
        }
        let entry = node && jaByHash.get(node.skill);
        if (!entry && node) {
          // a newer keystone missing from RePoE's Japanese tree: turn the official English text into Japanese
          const r = englishLinesToJapanese(node.stats, toJapanese);
          entry = { n: jline, l: r.lines, r: unique(r.reminders.map(cleanJaReminder)), f: r.failed ? 1 : 0 };
        }
        const ent = entry || fromReminder(jline, jv.reminder_text, true);
        if (name && !ent.e && name !== ent.n) ent.e = name;   // the English name (see partTitle)
        out.ja[jline] = ent;
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
  // The support gem's shown name ("投射物回帰サポート", "Returning Projectiles Support")
  const supportName = (g) => stripMarkup(String(g.display_name || (g.base_item && g.base_item.display_name) || '')).trim();
  // the name of a skill or support gem as it is looked for in a line
  const scanName = (g) => stripMarkup(String((g.active_skill && g.active_skill.display_name) || (g.is_support && supportName(g)) || '')).trim();
  // the name of a skill or support gem as its popup shows it (buildSkills)
  const gemTitle = (g) => (g.active_skill ? stripMarkup(String(g.active_skill.display_name || '')) : supportName(g));

  // Skill and support gem names of one language: { byName: active skill name -> id (granted skill lines),
  // supports: support name -> id, scan: name -> id (names found anywhere in a line) }
  // ordinary: the names that the English item text also writes in lower case (ordinaryNames); enOrdinary (the
  // Japanese gems): the gem ids whose English name is one
  function gemNames(gems, lang, ordinary, enOrdinary) {
    const byName = new Map();
    for (const [id, g] of Object.entries(gems)) {
      const n = g && g.active_skill && g.active_skill.display_name;
      if (n && !byName.has(n)) byName.set(n, id);
    }
    // Support gems on items ("ソケットされたジェムはレベル20 投射物回帰サポートによってサポートされる",
    // "Socketed Gems are Supported by Level 20 Returning Projectiles"). Most of these lines are not in the
    // translations, so they are matched by TEXT.supportLine and the support's name. The English line leaves
    // out the word "Support", so the name is stored with and without it.
    const supports = {};   // name -> support gem id
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
    // Skill names found anywhere in a line ("Herald of Thunder has 20% increased Mana Reservation Efficiency"):
    // name -> gem id. Names that are also other game words (Blight: the league, Ignite: the ailment) are left out
    // (see CONFIG.nameScan).
    const L = lang === 'Japanese' ? 'ja' : 'en';
    const exclude = new Set(CONFIG.nameScan.exclude[L]);
    const keep = new Set(CONFIG.nameScan.keep[L] || []);
    const scan = {};
    const ordinaryIds = new Set();
    for (const [id, g] of Object.entries(gems)) {
      if (!g) continue;
      const n = scanName(g);
      if (n.length < CONFIG.nameScan.minLength[L] || exclude.has(n)) continue;
      if (!keep.has(n) && (L === 'en' ? ordinary && ordinary.has(n) : enOrdinary && enOrdinary.has(id))) {
        ordinaryIds.add(id);
        continue;
      }
      const old = scan[n] && gems[scan[n]];
      if (!old || (!old.base_item && g.base_item)) scan[n] = id;
    }
    return { byName, supports, scan, ordinaryIds };
  }

  // Returns { templates: [{ t, id }], skills: { id: { n, d, s: [lines], lv: { level: [lines] } } } }.
  // names: gemNames() of the same gems. extra (the Japanese page, from pairLines): the skills and supports that the
  // English text of the same line names, for the lines whose Japanese name differs from the data. enTitles (the
  // Japanese page): gem id -> English name.
  function buildSkills(statList, lang, gems, gn, extra, enTitles) {
    const byName = gn.byName;
    const names = [...byName.keys()].sort((a, b) => b.length - a.length);
    const statSkill = (extra && extra.statSkill) || new Map();
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
          // a Japanese line can name the skill differently from the data: the skill named in the English line
          const paired = statSkill.get(e.ids.join('|'));
          id = name ? byName.get(name) : (paired && gems[paired] ? paired : '');   // '' = not in the data; the popup says so
        }
        const parts = text.split('\n');
        const at = parts.findIndex((p) => p.includes('{0}'));
        for (let k = at; k < parts.length; k++) templates.push({ t: parts.slice(0, k + 1).join(' '), id });
        if (id) used.add(id);
      }
    }
    // support gems (see gemNames), and the support names that the Japanese lines write differently ("クルエルティ")
    const supports = Object.assign({}, gn.supports);
    for (const [n, id] of Object.entries((extra && extra.supportNames) || {})) if (!supports[n] && gems[id]) supports[n] = id;
    for (const id of Object.values(supports)) used.add(id);

    const scanNames = gn.scan;
    const nameOnly = new Set(Object.values(scanNames).filter((id) => !used.has(id)));
    // skills that only the English text of a Japanese line names
    for (const id of (extra && extra.skillIds) || []) if (gems[id] && !used.has(id)) nameOnly.add(id);

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
      // the English name, for a line that writes the skill differently (see partTitle)
      const en = enTitles && enTitles.get(id);
      if (en && en !== skills[id].n) skills[id].e = en;
    }
    return { templates, skills, supports, names: scanNames };
  }

  // The game's explanations of its terms (the reminder texts of the item lines: "(Fortify: 堅牢化1につき…)"), by the
  // term's English name, in each language: { ja: { term: [lines] }, en: { term: [lines] } }, the text that most lines
  // use, in its parentheses; and lines: { ja: [{ t: line form, k: [terms] }], en: [...] }, the lines whose reminder
  // names the terms. Only the Japanese texts name their terms; the English ones get the names of the Japanese ones of
  // the same stat. A term that is a buff's name shows that buff, with the explanation under the buff's own text (see
  // pairLines). A term without a name of its own ("回収", "直近") is not shown: the popup explains names.
  function termTexts(jaStat, enStat) {
    // the parts of a reminder text, one per term: "(Recently: …)\n(Life Leech: …)", a part can have several lines
    const partsOf = (s) => {
      const out = [];
      for (const line of stripMarkup(String(s || '')).split('\n')) {
        const x = line.trim();
        if (!x) continue;
        if (x.startsWith('(') || !out.length) out.push([x]);
        else out[out.length - 1].push(x);
      }
      return out;
    };
    const nameOf = (part) => { const m = /^\(\s*([A-Za-z][A-Za-z0-9 '\-]*):/.exec(part[0]); return m ? m[1].trim() : ''; };
    const body = (part, japanese) => part.map((x, i) => (i === 0 && japanese ? cleanJaReminder(x) : x).trim()).filter(Boolean);
    const count = { ja: new Map(), en: new Map() };
    const add = (lang, name, lines) => {
      if (!name || !lines.length) return;
      if (!count[lang].has(name)) count[lang].set(name, new Map());
      const c = count[lang].get(name);
      const key = JSON.stringify(lines);
      c.set(key, (c.get(key) || 0) + 1);
    };
    // The lines that a reminder's terms belong to: the whole text, and a line of a longer text where no other stat has
    // the same line ("移動スピードが{0}%減少する" is a line of the Hinder text and also a whole text of its own)
    const linesOf = (s) => stripMarkup(String(s || '')).split('\n').map((x) => normalize(x)).filter(Boolean);
    const owners = { ja: new Map(), en: new Map() };   // line form -> the stats that have it
    for (const [lang, list, key] of [['ja', jaStat, 'Japanese'], ['en', enStat, 'English']]) {
      for (const e of list) {
        const k = e.ids.join('|');
        for (const v of e[key] || []) for (const l of linesOf(v.string)) {
          if (!owners[lang].has(l)) owners[lang].set(l, new Set());
          owners[lang].get(l).add(k);
        }
      }
    }
    const termLines = { ja: new Map(), en: new Map() };
    const addLines = (lang, v, names) => {
      names = names.filter(Boolean);
      if (!names.length) return;
      const ls = linesOf(v.string);
      const forms = ls.length > 1 ? [ls.join(' '), ...ls.filter((l) => owners[lang].get(l).size === 1)] : ls;
      for (const t of forms) {
        if (!termLines[lang].has(t)) termLines[lang].set(t, new Set());
        for (const n of names) termLines[lang].get(t).add(n);
      }
    };
    const jaById = new Map();
    for (const e of jaStat) {
      jaById.set(e.ids.join('|'), e);
      for (const v of e.Japanese || []) {
        const parts = partsOf(v.reminder_text);
        for (const p of parts) add('ja', nameOf(p), body(p, true));
        addLines('ja', v, parts.map(nameOf));
      }
    }
    for (const e of enStat) {
      const je = jaById.get(e.ids.join('|'));
      (e.English || []).forEach((v, vi) => {
        const jv = je && je.Japanese && je.Japanese[vi];
        const names = partsOf(jv && jv.reminder_text).map(nameOf);
        const parts = partsOf(v.reminder_text);
        if (parts.length !== names.length) return;
        parts.forEach((p, i) => add('en', names[i], body(p, false)));
        addLines('en', v, names);
      });
    }
    const most = (m) => Object.fromEntries([...m].map(([name, c]) => [name, JSON.parse([...c].sort((a, b) => b[1] - a[1])[0][0])]));
    const list = (m) => [...m].map(([t, k]) => ({ t, k: [...k] }));
    return { ja: most(count.ja), en: most(count.en), lines: { ja: list(termLines.ja), en: list(termLines.en) } };
  }

  // ---------------------------------------------------------------------------
  // Buffs (猛攻, 堅牢化, シュライン, ...), and the names that the Japanese text writes differently from the data,
  // found through the English text of the same line (the stat ids pair the two languages)
  // ---------------------------------------------------------------------------
  // A buff's popup entry: its name, the data's description, and its effect lines when every version of the buff
  // has the same numbers (a shrine has player, monster and weaker versions). Several buffs can share a name
  // ("出血" is also the stacking bleeding, "神聖領域" also the enemy's ground): the first one with a text is used.
  // null when the data has no text.
  function buffEntry(ids, src, english) {
    const read = (data, id) => {
      const b = data && data[id];
      if (!b) return null;
      const n = String(b.name || '').trim();
      const d = [];
      for (const x of String(b.description || '').split(/\r?\n/)) {
        const t = stripMarkup(x).trim();
        if (/\p{L}/u.test(t) && t !== n && !d.includes(t)) d.push(t);   // "@#%*)@#%*@^)" is not a text
      }
      const versions = Object.values(b.templates || {})
        .map((tv) => JSON.stringify((tv.stat_text || []).map((s) => stripMarkup(String(s)).trim()).filter(Boolean)));
      const l = versions.length && versions.every((v) => v === versions[0]) ? JSON.parse(versions[0]) : [];
      return d.length || l.length ? { n, d, l, r: [] } : null;
    };
    for (const id of ids) {
      let e = read(src, id);
      if (!e && src !== english) {
        e = read(english, id);   // the Japanese data has no text: the English text, with a note
        if (e) e.f = 1;
      }
      if (!e) continue;
      const en = String((english && english[id] && english[id].name) || '').trim();
      if (!e.n) e.n = en;
      // the Japanese page: the English name, for a line that writes the buff differently (see partTitle)
      if (src !== english && en && en !== e.n) e.e = en;
      return e;
    }
    return null;
  }

  // f: the downloaded files; data: convertPoe1's result; enNames / pageNames: gemNames() of the English gems and
  // of the page's gems. Returns { lines: [{ t, b, s, k }] (line forms of the page's language; b: buff keys,
  // s: skill ids, k: keystone names), buffs: { key: entry }, and for buildSkills (the Japanese page):
  // statSkill: stat ids -> skill id, supportNames: name -> support gem id, skillIds: [ids] }.
  function pairLines(f, data, enNames, pageNames, ordinary) {
    const B = CONFIG.buffScan;
    const ja = LANG === 'ja';
    const enBuffs = f.enBuffs || {};
    // the rules of CONFIG.buffScan: shown in the game, and an English text that says more than the name
    const stop = new Set(B.textStopWords);
    const stem = (w) => w.slice(0, 5);
    const shown = (id) => {
      const b = enBuffs[id];
      if (!b || b.invisible) return false;
      const own = new Set((String(b.name || '').toLowerCase().match(/[a-z]+/g) || []).map(stem));
      const words = (stripMarkup(String(b.description || '')).toLowerCase().match(/[a-z]+/g) || [])
        .filter((w) => w.length > 2 && !stop.has(w) && !own.has(stem(w)));
      return words.length >= B.minTextWords;
    };
    // buffs by English name (several can share one: "Brutal Shrine"); a skill or keystone name is shown as that
    const notBuff = new Set([...B.exclude, ...Object.keys(enNames.scan), ...((data.keystoneNames && data.keystoneNames.en) || [])]);
    const keep = new Set(B.keep);
    const byName = new Map();
    for (const [id, b] of Object.entries(enBuffs)) {
      const n = String((b && b.name) || '').trim();
      if (n.length < B.minLength || notBuff.has(n)) continue;
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n).push(id);
    }
    for (const [n, ids] of [...byName]) if (!keep.has(n) && (ordinary.has(n) || !ids.some(shown))) byName.delete(n);
    // The game's explanation of the term that a buff is named after ("Fortify": "(堅牢化1につき…)"), which often has the
    // numbers that the buff's own text ("ヒットにより受けるダメージが低下") does not: shown under the buff's own text, as
    // the game shows it in item texts (the buff's own text can say other things: "バナーを設置することで勇猛を消費する").
    // A term and a buff name are the same words, but for an ending of up to 3 letters ("Shock" / "Shocked", "Unnerved" /
    // "Unnerve", "FireExposure" / "Fire Exposure"; not "Chill" / "Chilled Ground", not "FireExposure" / "Fire"); for a
    // term without such a buff (the English words differ: "Freeze" / "Frozen"), its Japanese explanation begins with
    // the buff's Japanese name ("凍結は、…") and the English names begin with the same letter.
    const terms = (data.termTexts && data.termTexts[LANG]) || {};
    const jaTerms = (data.termTexts && data.termTexts.ja) || {};
    const words = (s) => String(s).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1);
    const letters = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');
    const sameWord = (term, name) => {
      if (letters(term) === letters(name)) return true;
      const tw = words(term), nw = words(name);
      const alike = (a, b) => {
        const [s, l] = a.length <= b.length ? [a, b] : [b, a];
        return s === l || (s.length >= 3 && l.startsWith(s) && l.length - s.length <= 3);
      };
      return tw.length > 0 && tw.length === nw.length && tw.every((w, i) => alike(w, nw[i]));
    };
    const jaBuffData = f.jaBuffs || {};
    const jaNameBegins = (term, id) => {
      const n = String((jaBuffData[id] && jaBuffData[id].name) || '').trim();
      const b = String((jaTerms[term] || [''])[0]).replace(/^\(/, '');
      return !!n && b.startsWith(n) && !/^[\p{Script=Han}\p{Script=Katakana}ー]/u.test(b.slice(n.length));
    };
    // every buff shown in the game, by English name (also those that the words of a line do not find)
    const allByName = new Map();
    for (const [id, b] of Object.entries(enBuffs)) {
      const n = String((b && b.name) || '').trim();
      if (!n || b.invisible) continue;
      if (!allByName.has(n)) allByName.set(n, []);
      allByName.get(n).push(id);
    }
    const notBuffLetters = new Set([...notBuff].map(letters));
    const termBuffs = new Map();   // term -> the names of its buffs
    const buffsOfTerm = (term) => {
      if (!termBuffs.has(term)) {
        const out = [];
        // a keystone or skill named in the reminder ("Avatar of Fire") is shown as that
        if (!notBuffLetters.has(letters(term))) {
          for (const n of allByName.keys()) if (sameWord(term, n)) out.push(n);
          const tw = words(term);
          if (!out.length && tw.length) {
            for (const [n, ids] of allByName) {
              const nw = words(n);
              if (tw.length === nw.length && tw[0][0] === nw[0][0] && ids.some((id) => jaNameBegins(term, id))) out.push(n);
            }
          }
        }
        termBuffs.set(term, out);
      }
      return termBuffs.get(term);
    };
    const buffs = {};
    // term: the term that names the buff in a line's reminder (see the reminder lines below)
    const hasBuff = (key, ids, term) => {
      if (!(key in buffs)) {
        const name = key.split('|')[0];
        const t = terms[term || ''] || terms[Object.keys(terms).find((x) => sameWord(x, name)) || ''];
        let e = buffEntry(ids, ja ? f.jaBuffs : enBuffs, enBuffs);
        // found only through a reminder: the buff's own text is shown only when the rules above show the buff
        if (e && term && !byName.has(name)) { e.d = []; if (!e.l.length) delete e.f; }
        if (!e && t) {
          const jn = ids.map((id) => String((jaBuffData[id] && jaBuffData[id].name) || '').trim()).find(Boolean);
          e = { n: (ja && jn) || name, d: [], l: [], r: [] };
          if (ja && jn && jn !== name) e.e = name;
        }
        if (e && t) e.r = t.slice();
        buffs[key] = e && (e.d.length || e.l.length || e.r.length) ? e : null;
      }
      return !!buffs[key];
    };
    // Several buffs can share a name ("Brutal Shrine": the shrine, and the weaker one of "You have Lesser Brutal
    // Shrine Buff"). The line's own words choose: the buff whose id words ("shrine_lesser_brutal") are all in the
    // English line, the one with the most of them (the first one, when it is as good as any).
    const idWords = (id) => String(id).toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const pick = (key, enLine) => {
      const ids = byName.get(key);
      if (!ids || ids.length < 2) return { key, ids };
      const words = new Set(String(enLine).toLowerCase().match(/[a-z]+/g) || []);
      const score = (id) => { const w = idWords(id); return w.every((x) => words.has(x)) ? w.length : -1; };
      let best = ids[0];
      for (const id of ids) if (score(id) > score(best)) best = id;
      return best === ids[0] ? { key, ids } : { key: key + '|' + best, ids: [best, ...ids.filter((x) => x !== best)] };
    };
    // "Power Charges" is also written "a Power Charge", "Gloom Shrine" also "Gloom Shrines"
    const alias = new Map();
    for (const n of byName.keys()) {
      alias.set(n, n);
      if (/ Charges$/.test(n)) alias.set(n.replace(/s$/, ''), n);
      else if (!/s$/.test(n) && !byName.has(n + 's')) alias.set(n + 's', n);
    }
    const plain = { boundary: CONFIG.nameScan.boundary };
    const findBuffs = nameFinder([...alias.keys()], 'en', plain);
    // families: the buffs named "<family> of <member>" ("Blood Shrine of Rats"), found by "<family> buff(s)" in a line
    const families = new Map();   // family -> member name -> ids
    for (const [id, b] of Object.entries(enBuffs)) {
      const m = /^(.+?) of (.+)$/.exec(String((b && b.name) || '').trim());
      if (!m) continue;
      if (!families.has(m[1])) families.set(m[1], new Map());
      const family = families.get(m[1]);
      if (!family.has(m[0])) family.set(m[0], []);
      family.get(m[0]).push(id);
    }
    const groups = [];
    for (const [word, family] of families) {
      const members = [...family].filter(([, ids]) => ids.some(shown));
      if (members.length > 1) groups.push({ find: nameFinder([word + ' buff', word + ' buffs'], 'en', plain), members });
    }
    // skills and keystones in the English text, found together as the English page finds them ("Lightning Conduit"
    // is the skill, not the keystone "Conduit"); a buff inside one of these names is not a buff
    const enKeystones = new Set((data.keystoneNames && data.keystoneNames.en) || []);
    const findEnNames = nameFinder([...Object.keys(enNames.scan), ...enKeystones], 'en');
    // the Japanese page: those that the Japanese text does not name itself are added through the English text
    const kmap = data.keystoneNameMap || {};
    const findOwn = ja ? nameFinder([...Object.keys(pageNames.scan), ...((data.keystoneNames && data.keystoneNames.ja) || [])], 'ja') : () => [];
    const jaById = new Map();
    if (ja) for (const e of f.jaStat) { const k = e.ids.join('|'); if (!jaById.has(k)) jaById.set(k, e); }

    const forms = new Map();   // line form -> { b, s, k }
    const statSkill = new Map();
    const supportNames = {};
    const skillIds = new Set();
    // what one English line names: the buffs, and (the Japanese page) the skills and keystones that the Japanese line
    // does not name itself
    const namesIn = (enLine, pageLine) => {
      const found = findEnNames(enLine);
      let masked = enLine;
      for (const n of found) masked = masked.split(n).join(' '.repeat(n.length));
      const b = [];
      for (const n of findBuffs(masked)) {
        const p = pick(alias.get(n), enLine);
        if (!b.includes(p.key) && hasBuff(p.key, p.ids)) b.push(p.key);
      }
      for (const g of groups) {
        if (b.length || !g.find(masked).length) continue;
        for (const [key, ids] of g.members) if (!b.includes(key) && hasBuff(key, ids)) b.push(key);
      }
      if (!ja) return { b, s: [], k: [] };
      const own = findOwn(pageLine);
      const ownIds = new Set(own.map((n) => pageNames.scan[n]).filter(Boolean));
      // a keystone wins over a skill of the same name (as on the page)
      const s = found.filter((n) => !enKeystones.has(n)).map((n) => enNames.scan[n]).filter((id) => id && !ownIds.has(id));
      const k = found.filter((n) => enKeystones.has(n)).map((n) => kmap[n]).filter((n) => n && !own.includes(n));
      return { b, s, k };
    };
    const add = (line, { b, s, k }) => {
      if (!b.length && !s.length && !k.length) return;
      const t = normalize(line);
      // a form made mostly of numbers ("+{0}%") would match other lines; a line without numbers is matched whole
      if (/\{\d+\}/.test(t) && t.replace(/\{\d+\}|[\s+\-%#]/g, '').length < CONFIG.nameScan.formMinFixed) return;
      const x = forms.get(t) || { b: [], s: [], k: [] };
      for (const v of b) if (!x.b.includes(v)) x.b.push(v);
      for (const v of s) if (!x.s.includes(v)) x.s.push(v);
      for (const v of k) if (!x.k.includes(v)) x.k.push(v);
      forms.set(t, x);
      for (const id of s) skillIds.add(id);
    };
    for (const e of f.enStat) {
      const key = e.ids.join('|');
      const je = ja ? jaById.get(key) : null;
      (e.English || []).forEach((v, vi) => {
        const en = stripMarkup(String(v.string || ''));
        if (!en) return;
        const enLines = en.split('\n');
        let pageText = en;
        if (ja) {
          const jv = je && je.Japanese && (je.Japanese[vi] || je.Japanese[0]);
          if (!jv) return;
          pageText = stripMarkup(String(jv.string || ''));
          // the skill of a granted skill line whose Japanese name differs from the data (see buildSkills)
          const whole = namesIn(enLines.join(' '), pageText.split('\n').join(' '));
          if (whole.s.length && !statSkill.has(key)) statSkill.set(key, whole.s[0]);
          for (const id of whole.s) skillIds.add(id);
          // support gems: the markup gives the gem ("[SupportBonespire<gemlevel={0}>|ボーンスパイア]"), or the English
          // line its English name ("クルエルティ" / "Cruelty")
          for (const m of String(jv.string || '').matchAll(/\[(Support[A-Za-z0-9_]+)(?:<[^\]|]*>)?\|([^\]]+)\]/g)) supportNames[m[2].trim()] = m[1];
          const mj = TEXT.ja.supportLine.exec(normalize(pageText.replace(/\{\d+\}/g, '1')));
          const me = TEXT.en.supportLine.exec(normalize(en.replace(/\{\d+\}/g, '1')));
          const sid = me && enNames.supports[normalize(me[2])];
          if (mj && sid && !supportNames[normalize(mj[2])]) supportNames[normalize(mj[2])] = sid;
        }
        // A text of several lines: the whole text as one line (the trade page can show it so), and line by line when
        // both languages have the same number of lines (the names of one line are not put on another line, which
        // other mods can share). A buff goes to the line that writes its name ("猛攻"), as the languages can order
        // the lines differently.
        const pageLines = pageText.split('\n');
        const joined = pageLines.join(' ');
        if (pageLines.length > 1 || enLines.length > 1) add(joined, namesIn(enLines.join(' '), joined));
        if (pageLines.length !== enLines.length) return;
        const per = pageLines.map((pl, i) => namesIn(enLines[i], pl));
        for (let i = 0; i < per.length && per.length > 1; i++) {
          per[i].b = per[i].b.filter((bk) => {
            const n = buffs[bk] && buffs[bk].n;
            if (!n || pageLines[i].includes(n)) return true;
            const at = pageLines.findIndex((pl) => pl.includes(n));
            if (at < 0) return true;
            if (!per[at].b.includes(bk)) per[at].b.push(bk);
            return false;
          });
        }
        pageLines.forEach((pl, i) => add(pl, per[i]));
      });
    }
    // the buffs that the game's reminder of a line names by its term, also where the line's English words name it
    // another way ("Cover Enemies in Ash on Hit": "(Covered in Ash: 灰まみれは…)")
    // (not a second buff of a name that the line already shows: "堅牢化" is both Fortify and Fortification)
    for (const { t, k } of (data.termTexts && data.termTexts.lines && data.termTexts.lines[LANG]) || []) {
      const have = new Set(((forms.get(normalize(t)) || {}).b || []).map((key) => buffs[key] && buffs[key].n));
      const b = [];
      for (const term of k) {
        for (const n of buffsOfTerm(term)) {
          if (b.includes(n) || !hasBuff(n, allByName.get(n), term) || have.has(buffs[n].n)) continue;
          have.add(buffs[n].n);
          b.push(n);
        }
      }
      add(t, { b, s: [], k: [] });
    }
    const lines = [];
    const used = {};
    for (const [t, x] of forms) {
      const o = { t };
      if (x.b.length) o.b = x.b;
      if (x.s.length) o.s = x.s;
      if (x.k.length) o.k = x.k;
      for (const key of x.b) used[key] = buffs[key];
      lines.push(o);
    }
    return { lines, buffs: used, statSkill, supportNames, skillIds: [...skillIds] };
  }

  // Fixed item lines that only look like a passive's line ("1 Added Passive Skill is a Jewel Socket"):
  // the popup does not say "not found" for them
  function notPassiveNames(statList, lang, templates, names) {
    const forms = templates.filter((x) => !x.loose).map((x) => formRx(x.t));
    const known = new Set(Object.keys(names).map((n) => n.toLowerCase()));
    const out = new Set();
    for (const e of statList) {
      for (const v of e[lang] || []) {
        const s = stripMarkup(String(v.string || ''));
        if (/\{\d+\}/.test(s)) continue;
        for (const line of unique([s, ...s.split('\n')])) {
          const t = normalize(line);
          for (const rx of forms) {
            const m = rx.exec(t);
            if (m && !known.has(normalize(m[1]).toLowerCase())) { out.add(t); break; }
          }
        }
      }
    }
    return [...out];
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
      const entry = { n: n.name, l: lines, r: (n.reminderText || []).map(stripMarkup) };
      if (r < 2) entry.small = 1;   // no item line names a small passive (see removedNames)
      addEntry(en, enRank, n.name, entry, r);
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
      const rank = nodeRank(p.is_keystone, p.is_notable, !!p.ascendancy);
      if (rank < 2) entry.small = 1;
      else if (g && g.name && g.name !== p.name) entry.e = g.name;   // the English name (see partTitle)
      addEntry(ja, jaRank, p.name, entry, rank);
      if (entry.l.length) jaByHash.set(p.hash, entry);
    }

    const enNameById = new Map(f.enCluster.map((x) => [x.id, x.name]));
    const enStatById = new Map();
    for (const list of enLists) for (const e of list) for (const id of e.ids) if (!enStatById.has(id)) enStatById.set(id, e);
    const jaClusterPairs = [];
    const enClusterPairs = [];
    let clusterTotal = 0;
    let clusterJapaneseMissing = 0;
    const jaOtherName = [];   // notables whose item line names them differently ("ボディーガード" / "ボディガード")
    for (const x of f.jaCluster) {
      clusterTotal++;
      const enName = enNameById.get(x.id);
      const je = jaIndex.get(x.jewel_stat);
      const ee = enStatById.get(x.jewel_stat);
      const jtext = je && je.Japanese && je.Japanese[0] ? stripMarkup(je.Japanese[0].string) : '';
      if (jtext) jaClusterPairs.push({ text: jtext, name: x.name });
      if (ee && ee.English && ee.English[0]) enClusterPairs.push({ text: stripMarkup(ee.English[0].string), name: enName });
      const node = gggByName.get(enName);
      if (!node) continue;
      const r = englishLinesToJapanese(node.stats, toJapanese);
      if (r.failed) clusterJapaneseMissing++;
      const entry = { n: x.name, l: r.lines, r: r.reminders, f: r.failed ? 1 : 0 };
      if (enName && enName !== x.name) entry.e = enName;
      addEntry(ja, jaRank, x.name, entry, 2);
      if (jtext && !jtext.includes(x.name)) jaOtherName.push({ text: jtext, entry });
    }
    // take the name from the item line, with the line form that the other notables use
    const clusterForms = unique(jaClusterPairs.filter((p) => p.text.includes(p.name)).map((p) => p.text.split(p.name).join('{0}')));
    for (const { text, entry } of jaOtherName) {
      for (const t of clusterForms) {
        const m = formRx(t).exec(text);
        if (!m) continue;
        const name = normalize(m[1]);
        addEntry(ja, jaRank, name, Object.assign({}, entry, { n: name }), 2);
        break;
      }
    }
    // the game shows each reminder once, even when several lines name the same word ("Arcane Surge")
    for (const entry of Object.values(ja)) entry.r = unique(entry.r.map(cleanJaReminder));
    const kl = keystoneLines(f.enStat, f.jaStat, gggByName, jaByHash, en, toJapanese);
    const lines = { ja: kl.ja, en: kl.en };
    const keystoneNames = { ja: unique(kl.names.ja), en: unique(kl.names.en) };
    const terms = termTexts(f.jaStat, f.enStat);
    const templates = {
      ja: passiveTemplates([f.jaStatPassive, f.jaStatAura, f.jaStat], 'Japanese', jaClusterPairs),
      en: passiveTemplates(enLists, 'English', enClusterPairs),
    };

    return {
      versions,
      builtAt: Date.now(),
      templates,
      names: { ja, en },
      lines,
      keystoneNames,
      notNames: { ja: notPassiveNames(f.jaStat, 'Japanese', templates.ja, ja), en: notPassiveNames(f.enStat, 'English', templates.en, en) },
      keystoneNameMap: kl.nameMap,   // used by pairLines, not kept
      termTexts: terms,              // used by pairLines, not kept
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
      const k = nodeRank(p.is_keystone, p.is_notable, !!p.ascendancy);
      const entry = { n: p.name, l: r.lines, r: mergeReminders(r.reminders, p.reminder_text) };
      if (k < 2) entry.small = 1;   // no item line names a small passive (see removedNames)
      addEntry(en, rank, p.name, entry, k);
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
  // The names that the data in use showed on the trade site and the new data cannot show (this page's game and
  // language), for the list after an update and the update history: [[kind, name]]. A part that the old data does
  // not have (made by an older Version) is not compared. Shown: a passive that is not a small one (no item line
  // names a small passive), and a skill or buff that a line really shows with the data in use (see shownBefore; a
  // skill kept in the data for a line that shows something else was never shown). lines(): the item lines.
  const KIND_ORDER = { passive: 0, skill: 1, buff: 2 };
  function removedNames(old, data, lines) {
    if (!old) return [];
    // all: the new data (every name it has, so a name that it still has is not listed)
    const parts = (d, all) => {
      const out = {};
      const add = (kind, part, names) => { if (part || all) out[kind] = new Set(part ? names() : []); };
      const pn = d.names && d.names[LANG];
      add('passive', pn, () => Object.keys(pn).filter((n) => all || !(pn[n] && pn[n].small)));
      const sk = d.skills && d.skills[LANG];
      add('skill', sk, () => Object.values(sk.skills || {}).map((s) => s && s.n).filter(Boolean));
      const bf = d.buffs && d.buffs[LANG];
      add('buff', bf, () => Object.values(bf).map((b) => b && b.n).filter(Boolean));
      return out;
    };
    const before = parts(old, false);
    const now = parts(data, true);
    let out = [];
    for (const [kind, names] of Object.entries(before)) for (const n of names) if (!now[kind].has(n)) out.push([kind, n]);
    const check = out.filter(([kind]) => kind !== 'passive');
    if (check.length) {
      const seen = shownBefore(check, old, lines);
      out = out.filter(([kind, n]) => kind === 'passive' || seen.has(kind + '\t' + n));
    }
    return out.sort((a, b) => KIND_ORDER[a[0]] - KIND_ORDER[b[0]] || a[1].localeCompare(b[1], LANG));
  }

  // Which of these skills and buffs ([[kind, name]]) the data in use (old, the one loadTable loaded) shows on a line:
  // a support gem is shown by its "Supported by" line; the others are looked up as the popup does, on the item lines
  // that write the names and on the line forms that name them through the English text or grant the skill.
  // Returns a Set of "kind\tname".
  function shownBefore(items, old, lines) {
    const want = new Set(items.map(([kind, n]) => kind + '\t' + n));
    const seen = new Set();
    const sk = (old.skills && old.skills[LANG]) || {};
    const skills = sk.skills || {};
    const ids = new Set(Object.keys(skills).filter((id) => skills[id] && want.has('skill\t' + skills[id].n)));
    for (const id of Object.values(sk.supports || {})) if (ids.has(id)) seen.add('skill\t' + skills[id].n);
    const bf = (old.buffs && old.buffs[LANG]) || {};
    const keys = new Set(Object.keys(bf).filter((k) => bf[k] && want.has('buff\t' + bf[k].n)));
    const test = new Set();
    for (const p of (old.pairs && old.pairs[LANG]) || []) {
      if ((p.s || []).some((id) => ids.has(id)) || (p.b || []).some((k) => keys.has(k))) test.add(p.t.replace(/\{\d+\}/g, '1'));
    }
    for (const x of sk.templates || []) if (ids.has(x.id)) test.add(x.t.replace(/\{\d+\}/g, '1'));
    const names = items.map(([, n]) => n);
    for (const l of lines()) if (names.some((n) => l.includes(n))) test.add(l);
    for (const l of test) {
      const r = lookup(l);
      for (const part of r ? (r.multi || [r]) : []) {
        const src = SOURCE.get(part);
        if (src && want.has(src[0] + '\t' + src[1])) seen.add(src[0] + '\t' + src[1]);
      }
    }
    return seen;
  }

  // The item lines of the game data as the trade site shows them (a number in each hole), whole and line by line
  function itemLines(statList, lang) {
    const out = new Set();
    for (const e of statList || []) {
      for (const v of e[lang] || []) {
        const s = stripMarkup(String(v.string || '')).replace(/\{\d+(?::[^}]*)?\}/g, '1');
        if (s.includes('\n')) out.add(normalize(s));
        for (const x of s.split('\n')) { const t = normalize(x); if (t) out.add(t); }
      }
    }
    return [...out];
  }

  function addHistory(items) {
    const list = GM_getValue(KEY_HISTORY, []);
    list.unshift({ at: Date.now(), game: GAME, lang: LANG, items });
    GM_setValue(KEY_HISTORY, list.slice(0, CONFIG.historyMax));
  }

  async function updateData() {
    if (updating) return;
    updating = true;
    try {
      showButton(T.downloading(0, 1), true);
      const versions = await fetchLatestVersions(GAME);
      const files = Object.assign({}, SOURCES[GAME].files);
      if (GAME === 'poe1') {
        files.ggg = SOURCES.poe1.gggDataUrl(versions.ggg);
        files.enBuffs = SOURCES.poe1.buffs.en;
        files.jaBuffs = SOURCES.poe1.buffs.ja;
      }
      const keys = Object.keys(files);
      // the skills: the English file (the Japanese page keeps only its names), then the page's file
      const gemFiles = GAME === 'poe1' ? (LANG === 'ja' ? ['en', 'ja'] : ['en']) : [];
      const total = keys.length + gemFiles.length;
      const got = {};
      for (let i = 0; i < keys.length; i++) {
        showButton(T.downloading(i + 1, total), true);
        got[keys[i]] = await getJson(files[keys[i]]);
      }
      let gems = null;
      let enNames = null;
      let enTitles = null;
      let ordinary = new Set();
      for (let i = 0; i < gemFiles.length; i++) {
        showButton(T.downloading(keys.length + i + 1, total), true);
        gems = null;   // about 40 MB each: let the English file go before the Japanese one comes
        gems = await getJson(SOURCES.poe1.gems[gemFiles[i]]);
        if (gemFiles[i] === 'en') {
          // the skill and buff names that the English item text also writes in lower case
          const names = [...Object.values(gems).filter(Boolean).map(scanName),
            ...Object.values(got.enBuffs || {}).map((b) => String((b && b.name) || '').trim())];
          ordinary = ordinaryNames(got.enStat, names);
          enNames = gemNames(gems, 'English', ordinary);
          // the English names of the skills, for the Japanese page's popups (see partTitle)
          if (LANG === 'ja') enTitles = new Map(Object.entries(gems).filter(([, g]) => g).map(([id, g]) => [id, gemTitle(g)]));
        }
      }
      showButton(T.converting, true);
      await new Promise((r) => setTimeout(r, 30));
      const data = GAME === 'poe1' ? convertPoe1(got, versions) : convertPoe2(got, versions);
      const old = GM_getValue(KEY_DATA, null);
      const lang = LANG === 'ja' ? 'Japanese' : 'English';
      const statList = LANG === 'ja' ? got.jaStat : got.enStat;
      if (gems) {
        const pageNames = LANG === 'ja' ? gemNames(gems, lang, ordinary, enNames.ordinaryIds) : enNames;
        const pairs = pairLines(got, data, enNames, pageNames, ordinary);
        // keep the other language's parts from before (made by this Version); they are rebuilt when that page updates
        const keep = old && old.scriptVersion === DATA_VERSION ? old : {};
        data.skills = Object.assign({}, keep.skills, {
          [LANG]: buildSkills(statList, lang, gems, pageNames, pairs, enTitles),
        });
        data.pairs = Object.assign({}, keep.pairs, { [LANG]: pairs.lines });
        data.buffs = Object.assign({}, keep.buffs, { [LANG]: pairs.buffs });
        gems = null;
      }
      delete data.keystoneNameMap;
      delete data.termTexts;
      data.scriptVersion = DATA_VERSION;
      const removed = removedNames(old, data, () => itemLines(statList, lang));
      GM_setValue(KEY_DATA, data);
      GM_setValue(KEY_CHECK, { at: Date.now(), latest: versions });
      loadTable();
      showButton(T.done(data.counts[LANG] || data.counts.en), true);
      setTimeout(hideButton, CONFIG.doneMessageMs);
      if (removed.length) {
        addHistory(removed);
        showList(T.removedTitle(removed.length), [{ items: removed }]);
      }
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
    // the data was made by an older way of making it
    if (data.scriptVersion !== DATA_VERSION) { showButton(T.buttonNew, false); return; }
    // the skills and buffs are made for one language at a time
    if (GAME === 'poe1' && !(data.skills && data.skills[LANG] && data.pairs && data.pairs[LANG])) { showButton(T.buttonFirst, false); return; }
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
  let findNames = () => []; // finds keystone and skill names anywhere in a line
  let nameKinds = {};      // name -> { k: keystone entry } | { s: skill id }
  // [{ rx, b, s, k }] lines whose English text names a buff, or (Japanese page) a skill or keystone that the
  // Japanese text names differently from the data
  let pairMatchers = [];
  let buffTable = {};      // buff key -> entry
  let notNames = new Set(); // fixed lines that only look like a passive's line
  const cache = new Map(); // line text -> entry | null
  const SOURCE = new WeakMap(); // popup entry -> [kind, name] of the skill or buff that it shows (see shownBefore)

  function loadTable() {
    cache.clear();
    if (typeof hidePopup === 'function' && popup) hidePopup();   // the shown text may be from before the update
    const data = GM_getValue(KEY_DATA, null);
    findNames = () => []; nameKinds = {}; pairMatchers = []; buffTable = {}; notNames = new Set();
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
    findNames = nameFinder(Object.keys(nameKinds), LANG);
    pairMatchers = ((data.pairs && data.pairs[LANG]) || []).map(({ t, b, s, k }) => ({ rx: formRx(t), b, s, k }));
    buffTable = (data.buffs && data.buffs[LANG]) || {};
    for (const b of Object.values(buffTable)) if (b && typeof b === 'object') SOURCE.set(b, ['buff', b.n]);
    notNames = new Set((data.notNames && data.notNames[LANG]) || []);
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
    // b: the name without the level, e: the English name (see partTitle)
    const out = { n: T.skillTitle(s.n, level), b: s.n, e: s.e, d: s.d, l: s.s.concat(use != null ? s.lv[use] : []), r: [] };
    SOURCE.set(out, ['skill', s.n]);
    return out;
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
    // a fixed line that only looks like a passive's line ("1 Added Passive Skill is a Jewel Socket") skips the forms
    for (const { rx, loose, skill } of notNames.has(normalize(text)) ? [] : matchers) {
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
    if (!result) result = findNamesInLine(normalize(text));
    cache.set(text, result);
    return result;
  }

  // Any other line: the keystones and skills named in it, and the buffs that its English text names
  // ("召喚したスケルトンはアバターオブファイヤーを持つ", "ヘラルドオブサンダーのマナリザーブ効率が20%増加する",
  // "ソケットされたゴーレムスキルをキャスト時に猛攻を10秒間獲得する"). Only names are explained: the game's reminder of a
  // line ("(ヒットによるダメージのみが…回収できる)") is not shown alone, as it would read as the line's explanation; a buff
  // named after a term has the term's reminder as its text (see pairLines).
  function findNamesInLine(text) {
    const parts = [];
    const shown = new Set();   // skill ids and entries already in the popup
    const put = (key, e) => {
      if (!e || shown.has(key)) return;
      shown.add(key);
      parts.push(e);
    };
    for (const n of findNames(text)) {
      const kind = nameKinds[n];
      if (kind.k) put(kind.k, kind.k);
      else put(kind.s, nameEntry(kind.s));
    }
    for (const { rx, b, s, k } of pairMatchers) {
      if (!rx.test(text)) continue;
      for (const id of s || []) put(id, nameEntry(id));
      for (const n of k || []) {
        const e = lineTable[n] || table[n];
        if (e && !e.missing) put(e, e);
      }
      for (const key of b || []) put('buff:' + key, buffTable[key]);
      break;
    }
    if (!parts.length) return null;
    return parts.length === 1 ? parts[0] : { multi: parts };
  }

  function nameEntry(id) {
    const s = skillTable[id];
    if (!s) return null;
    const out = { n: s.n, e: s.e, d: s.d, l: s.s, r: [] };
    SOURCE.set(out, ['skill', s.n]);
    return out;
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
    .mpv-part + .mpv-part { border-top: 1px solid ${C.border}; margin-top: 6px; padding-top: 6px; }
    .mpv-part + .mpv-part > :first-child { margin-top: 0; }
    .mpv-popup.mpv-cols { grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); column-gap: ${CONFIG.popupColumnGap}px; }
    .mpv-popup.mpv-cols .mpv-part.mpv-coltop { border-top: none; margin-top: 0; padding-top: 0; }
    .mpv-popup.mpv-cols .mpv-part.mpv-right { border-left: 1px solid ${C.border}; padding-left: ${CONFIG.popupColumnGap}px; }
    .mpv-button { position: fixed; right: 12px; bottom: 12px; z-index: 2147483001; max-width: 360px;
      padding: 6px 12px; cursor: pointer; font-size: ${CONFIG.fontSize}px; text-align: left;
      color: ${C.buttonText}; background: ${C.buttonBackground}; border: 1px solid ${C.border}; border-radius: 4px; }
    .mpv-button[disabled] { cursor: default; }
    .mpv-panel { position: fixed; right: 12px; bottom: ${CONFIG.historyPanel.bottom}px; z-index: 2147483001; display: none;
      box-sizing: border-box; width: ${CONFIG.historyPanel.width}px; max-width: calc(100vw - 24px); padding: 10px 12px;
      background: ${C.background}; border: 1px solid ${C.border}; border-radius: 4px; color: ${C.buttonText};
      font-size: ${CONFIG.fontSize}px; line-height: 1.6; text-align: left; white-space: normal; }
    .mpv-panel-title { color: ${C.name}; font-weight: bold; margin-bottom: 6px; }
    .mpv-panel-list { max-height: ${CONFIG.historyPanel.listMaxHeight}vh; overflow-y: auto; }
    .mpv-panel-head { color: ${C.name}; margin-top: 6px; }
    .mpv-panel-head:first-child { margin-top: 0; }
    .mpv-panel-head ~ .mpv-panel-item { padding-left: 10px; }
    .mpv-panel-bar { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .mpv-panel-bar button { cursor: pointer; padding: 2px 10px; font-size: ${CONFIG.fontSize}px;
      color: ${C.buttonText}; background: ${C.buttonBackground}; border: 1px solid ${C.border}; border-radius: 4px; }
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

  // The list of the names that an update no longer shows, and the update history (Tampermonkey menu)
  const panel = document.createElement('div');
  panel.className = 'mpv-panel';
  document.body.appendChild(panel);
  const two = (n) => String(n).padStart(2, '0');
  const timeText = (t) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
  };
  const historyHead = (h) => `${timeText(h.at)} ${T.pages[h.lang] || h.lang} ${h.game === 'poe2' ? 'POE2' : 'POE1'}`;
  const itemText = ([kind, name]) => `${T.kinds[kind] || kind}: ${name}`;

  // groups: [{ head (optional), items: [[kind, name]] }]
  function showList(title, groups) {
    panel.textContent = '';
    panel.appendChild(el('mpv-panel-title', title));
    const list = el('mpv-panel-list', '');
    if (!groups.length) list.appendChild(el('mpv-panel-item', T.historyEmpty));
    for (const g of groups) {
      if (g.head) list.appendChild(el('mpv-panel-head', g.head));
      for (const item of g.items) list.appendChild(el('mpv-panel-item', itemText(item)));
    }
    panel.appendChild(list);
    const bar = el('mpv-panel-bar', '');
    const add = (label, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', onClick);
      bar.appendChild(b);
    };
    if (GM_getValue(KEY_HISTORY, []).length) add(T.historySave, () => { saveHistory(); panel.style.display = 'none'; });
    add(T.historyClose, () => { panel.style.display = 'none'; });
    panel.appendChild(bar);
    panel.style.display = 'block';
  }

  function showHistory() {
    showList(T.historyTitle, GM_getValue(KEY_HISTORY, []).map((h) => ({ head: historyHead(h), items: h.items })));
  }

  // the whole update history as a text file, into the browser's download folder
  function saveHistory() {
    const lines = [T.historyFileTitle, ''];
    for (const h of GM_getValue(KEY_HISTORY, [])) {
      lines.push(historyHead(h));
      for (const item of h.items) lines.push('  ' + itemText(item));
      lines.push('');
    }
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = T.historyFile;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // text: the line under the mouse
  function fillPopup(entry, text) {
    popup.textContent = '';
    if (!entry) {
      popup.appendChild(el('mpv-note', T.noData));
      return;
    }
    if (entry.multi) {
      // several names in one line: each one's effects, one under another (or in two columns, see placePopup)
      for (const part of entry.multi) {
        const box = el('mpv-part', '');
        fillPart(part, box, text);
        popup.appendChild(box);
      }
      return;
    }
    fillPart(entry, popup, text);
  }

  // The name as the popup shows it. A name that the line does not write itself (the Japanese text of the game writes
  // some names differently in the item lines and in the data: "レッサーブルータルシュラインのバフを持つ" and the buff
  // "残忍なシュライン") also gets its English name, which the line's name usually comes from: "残忍なシュライン(Brutal
  // Shrine)". A support gem's line writes its name without "サポート".
  function partTitle(entry, text) {
    const base = entry.b || entry.n;
    if (!entry.e || !base || !text) return entry.n;
    const squash = (s) => String(s).replace(/\s+/g, '');
    const line = squash(text);
    if (line.includes(squash(base)) || line.includes(squash(base.replace(/\s*(Support|サポート)$/i, '')))) return entry.n;
    return entry.n.replace(base, () => T.withEnglish(base, entry.e));
  }

  function fillPart(entry, box, text) {
    if (entry.n) box.appendChild(el('mpv-name', partTitle(entry, text)));
    if (entry.missing) box.appendChild(el('mpv-note', entry.skillMissing ? T.skillNotFound : T.notFound));
    for (const d of entry.d || []) box.appendChild(el('mpv-desc', d));
    for (const l of entry.l) box.appendChild(el('mpv-line', l));
    for (const r of unique(entry.r || [])) box.appendChild(el('mpv-rem', r));   // also for data made before 1.0.1
    if (entry.f && T.noJapanese) box.appendChild(el('mpv-note', T.noJapanese));
  }

  // two columns: the first half of the parts on the left, the rest on the right, each read from the top
  function setColumns(parts, on) {
    const rows = Math.ceil(parts.length / 2);
    popup.classList.toggle('mpv-cols', on);
    popup.style.gridTemplateRows = on ? `repeat(${rows}, auto)` : '';
    popup.style.display = on ? 'grid' : 'block';
    parts.forEach((p, i) => {
      p.classList.toggle('mpv-coltop', on && i % rows === 0);
      p.classList.toggle('mpv-right', on && i >= rows);
    });
  }

  // the left edge of the text of a line of the trade page (the line's box is as wide as the item)
  function textLeft(row) {
    const s = row.querySelector('[data-field]') || row.querySelector('.s') || row;
    const range = document.createRange();
    range.selectNodeContents(s);
    const r = range.getBoundingClientRect();
    return r.width || r.height ? r.left : s.getBoundingClientRect().left;
  }

  // The item's own lines: the lines next to the hovered one without a gap wider than CONFIG.itemLineGap px between
  // them (the next item's name and properties make a wider gap). rows: [[row, its box]] in the page's order.
  function itemRows(row, rows) {
    const i = rows.findIndex(([r]) => r === row);
    if (i < 0) return [];
    let lo = i, hi = i;
    while (lo > 0 && rows[lo][1].top - rows[lo - 1][1].bottom <= CONFIG.itemLineGap) lo--;
    while (hi < rows.length - 1 && rows[hi + 1][1].top - rows[hi][1].bottom <= CONFIG.itemLineGap) hi++;
    return rows.slice(lo, hi + 1);
  }

  // Left of the lines (see CONFIG.popupSideGap). First no line is covered, then (a tall popup reaches other items)
  // only the hovered item's lines are kept free, then only the hovered line (a longer line of the item beside it is
  // covered at its left end, not whole as below the line); first just below the hovered line, then just above it.
  function placeBeside(row, rr, parts, vh, m) {
    const rows = [...document.querySelectorAll(ROW_SELECTOR)].map((r) => [r, r.getBoundingClientRect()]).filter(([, b]) => b.height > 0);
    const own = itemRows(row, rows);
    for (const avoid of [rows, own, [[row, rr]]]) {
      for (const below of [true, false]) if (fitBeside(row, rr, parts, vh, m, avoid, below)) return true;
    }
    return false;
  }

  // The popup's right edge just left of the text of the lines of avoid beside it; false where it does not fit.
  function fitBeside(row, rr, parts, vh, m, avoid, below) {
    const gap = CONFIG.popupSideGap;
    let right = textLeft(row) - gap;
    for (let tries = 0; tries < 4; tries++) {
      const room = right - m;
      if (room < CONFIG.popupSideMinWidth) return false;
      setColumns(parts, false);
      popup.style.maxWidth = Math.floor(Math.min(CONFIG.popupMaxWidth, room)) + 'px';
      let pr = popup.getBoundingClientRect();
      if (pr.height > vh - m * 2) {
        // taller than the screen: two columns, each at least as wide as the narrowest popup
        if (parts.length < 2 || room < CONFIG.popupSideMinWidth * 2 + CONFIG.popupColumnGap) return false;
        setColumns(parts, true);
        popup.style.maxWidth = Math.floor(Math.min(CONFIG.popupColumnsMaxWidth, room)) + 'px';
        pr = popup.getBoundingClientRect();
        if (pr.height > vh - m * 2) return false;
      }
      const want = below ? rr.bottom + CONFIG.popupGap : rr.top - CONFIG.popupGap - pr.height;
      const top = Math.max(m, Math.min(want, vh - m - pr.height));
      // a longer line beside the popup moves it further left
      let edge = right;
      for (const [r, b] of avoid) if (b.bottom > top && b.top < top + pr.height) edge = Math.min(edge, textLeft(r) - gap);
      if (edge >= right) {
        popup.style.left = Math.floor(right - pr.width) + 'px';
        popup.style.top = Math.round(top) + 'px';
        return true;
      }
      right = edge;
    }
    return false;
  }

  function placePopup(row) {
    const rr = row.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const m = CONFIG.screenMargin;
    const parts = [...popup.children].filter((x) => x.classList.contains('mpv-part'));
    popup.style.left = '0px';
    popup.style.top = '0px';
    if (placeBeside(row, rr, parts, vh, m)) return;
    // not enough room left of the lines: just below the line, or just above it
    setColumns(parts, false);
    popup.style.maxWidth = Math.min(CONFIG.popupMaxWidth, vw - m * 2) + 'px';
    let pr = popup.getBoundingClientRect();
    // fits neither below nor above the line: two columns, so the popup does not cover the line
    const fits = (h) => rr.bottom + CONFIG.popupGap + h <= vh - m || rr.top - CONFIG.popupGap - h >= m;
    if (parts.length > 1 && !fits(pr.height)) {
      setColumns(parts, true);
      popup.style.maxWidth = Math.min(CONFIG.popupColumnsMaxWidth, vw - m * 2) + 'px';
      pr = popup.getBoundingClientRect();
    }
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
      fillPopup(entry, rowText(row));
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
  GM_registerMenuCommand(T.menuHistory, showHistory);
  loadTable();
  if (!(GAME === 'poe2' && LANG === 'ja')) dailyCheck();

  // for testing from the console of a test page
  if (TEST) TEST.api = { updateData, dailyCheck, loadTable, lookup, convertPoe1, convertPoe2, translateStats, buildIndex, GAME, LANG,
    showHistory, saveHistory, partTitle, fillPopup, placePopup };
})();
