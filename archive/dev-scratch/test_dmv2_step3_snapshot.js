/* test_dmv2_step3_snapshot.js
 * Step 3.5 玩家端「完整快照」驗證：逐字擷取 v2/app.js 的 buildPlayerSnapshot 原始碼，
 * 在 sandbox 以 stub 依賴執行（與 test_p2b_onsave.js 同手法，確保與線上碼一字不差）。
 * 驗：
 *  - Tier1 頂層欄位維持原樣（name/level/characterId/hp/ac）— 相容不破壞。
 *  - full 區：abilities(6)/profBonus/saves(6+prof)/skills(18)/passivePerception/familiars/inventory/narrative。
 *  - 相容：舊單一 c.familiar → familiars 陣列；字串背包 → 正規化物件。
 *  - 背包「已裝備優先」+ 上限 40；敘事欄位截斷。
 *  - try/catch：full 建構丟例外時退回純 Tier1（不中斷上傳）。
 *  - 無選角 → { name:'(未選角色)', level:1 }。
 */
const vm = require('vm');
const fs = require('fs');

const appSrc = fs.readFileSync('v2/app.js', 'utf8');
function slice(startAnchor, endAnchor) {
  const a = appSrc.indexOf(startAnchor);
  const b = appSrc.indexOf(endAnchor, a + startAnchor.length);
  if (a < 0 || b < 0) throw new Error('找不到錨點: ' + startAnchor + ' / ' + endAnchor);
  return appSrc.slice(a, b);
}
/* buildPlayerSnapshot 定義區塊（到下一個註記/函式前） */
const fnSrc = slice('const buildPlayerSnapshot =', '\n        /* §5.6');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713', name); } else { fail++; console.log('  \u2717', name); } }

/* ---- 18 技能（取自 core-rules.json，維持真實清單）---- */
const SKILLS = require('./data/core-rules.json').SKILLS;

/* 以 stub 依賴組出 sandbox，回傳 buildPlayerSnapshot 函式。
 * charRef 為 { value: char }；opts.throwOnAbility 用來模擬 full 區丟例外。 */
function makeSnapFn(charRef, opts) {
  opts = opts || {};
  const sandbox = { console };
  sandbox.selectedChar = charRef;
  sandbox.computedAC = { value: 15 };
  sandbox.abilityMod = (score) => Math.floor((Number(score) - 10) / 2);
  sandbox.abilityTotal = (key) => {
    if (opts.throwOnAbility) throw new Error('boom');
    const c = charRef.value || {};
    return (Number(c.abilities && c.abilities[key]) || 10) + (Number(c.abilityBonus && c.abilityBonus[key]) || 0);
  };
  sandbox.profBonus = { value: 3 };
  sandbox.SAVE_LIST = [
    { key: 'str', zh: '力量' }, { key: 'dex', zh: '敏捷' }, { key: 'con', zh: '體質' },
    { key: 'int', zh: '智力' }, { key: 'wis', zh: '感知' }, { key: 'cha', zh: '魅力' }
  ];
  sandbox.saveValue = (key) => 99; /* 決定性 stub */
  sandbox.skillValue = (zh) => (zh === '察覺' ? 5 : 1);
  sandbox.coreRules = { SKILLS: SKILLS };
  vm.createContext(sandbox);
  vm.runInContext(fnSrc + '\n; globalThis.__snap = buildPlayerSnapshot;', sandbox, { filename: 'buildPlayerSnapshot' });
  return sandbox.__snap;
}

/* ---- 案例 1：完整角色 ---- */
{
  const char = {
    id: 'c1', name: '亞拉岡', race: '人類', alignment: '守序善良', background: '貴族',
    speed: '30 呎', initiative: 2,
    classes: [{ name: '遊俠', level: 3 }, { name: '戰士', level: 2 }],
    abilities: { str: 16, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
    abilityBonus: { str: 1 },
    hp: { current: 30, max: 42 }, ac: 17,
    profSaves: { str: true, con: true },
    skills: { '察覺': { proficient: true }, '運動': { proficient: true, expertise: true } },
    familiars: [{ name: '獵鷹', type: '猛禽', ac: 13, hp: { current: 5, max: 5 }, notes: '偵察用' }],
    inventory: [
      { name: '長劍', qty: 1, equipped: true },
      '火把',                                   /* 字串舊格式 */
      { name: '繩索', qty: 2, equipped: false }
    ],
    story: { appearance: 'A'.repeat(600), backstory: 'B'.repeat(2000), ideals: '正義' }
  };
  const snap = makeSnapFn({ value: char })();

  console.log('案例1 完整角色：');
  ok('Tier1 name 保留', snap.name === '亞拉岡');
  ok('Tier1 level = 總等級 5', snap.level === 5);
  ok('Tier1 characterId 保留', snap.characterId === 'c1');
  ok('Tier1 hp 保留', snap.hp.current === 30 && snap.hp.max === 42);
  ok('Tier1 ac 用 computedAC', snap.ac === 15);
  ok('full 存在', !!snap.full);
  ok('full.abilities 六屬性 + bonus 併入 (str=17)', snap.full.abilities.str === 17 && snap.full.abilities.cha === 8);
  ok('full.profBonus = 3', snap.full.profBonus === 3);
  ok('full.saves 六項 + prof 旗標', snap.full.saves.length === 6 &&
    snap.full.saves.find(s => s.key === 'str').prof === true &&
    snap.full.saves.find(s => s.key === 'dex').prof === false);
  ok('full.skills 18 項', snap.full.skills.length === 18);
  ok('full.skills 帶熟練/專精旗標', (() => {
    const ath = snap.full.skills.find(s => s.zh === '運動');
    return ath && ath.proficient === true && ath.expertise === true;
  })());
  ok('full.passivePerception = 10 + 察覺(5) = 15', snap.full.passivePerception === 15);
  ok('full.classes 摘要', snap.full.classes.length === 2 && snap.full.classes[0].name === '遊俠');
  ok('full.familiars 陣列', snap.full.familiars.length === 1 && snap.full.familiars[0].name === '獵鷹');
  ok('full.inventory 已裝備優先 (長劍在首)', snap.full.inventory[0].name === '長劍' && snap.full.inventory[0].equipped === true);
  ok('full.inventory 字串物品正規化 (火把 qty=1)', (() => {
    const t = snap.full.inventory.find(i => i.name === '火把'); return t && t.qty === 1 && t.equipped === false;
  })());
  ok('full.narrative.appearance 截斷 500', snap.full.narrative.appearance.length === 500);
  ok('full.narrative.backstory 截斷 1200', snap.full.narrative.backstory.length === 1200);
  ok('full.updatedAt 為數字', typeof snap.full.updatedAt === 'number');
}

/* ---- 案例 2：舊單一 familiar + 無 story ---- */
{
  const char = {
    id: 'c2', name: '半身人', classes: [{ name: '盜賊', level: 1 }],
    abilities: { str: 8, dex: 16, con: 12, int: 13, wis: 10, cha: 14 },
    hp: { current: 8, max: 8 }, ac: 14,
    familiar: { name: '老鼠', type: '野獸', ac: 10, hp: { current: 1, max: 1 } }
  };
  const snap = makeSnapFn({ value: char })();
  console.log('案例2 舊單一 familiar：');
  ok('舊 c.familiar → familiars 陣列 1 筆', snap.full.familiars.length === 1 && snap.full.familiars[0].name === '老鼠');
  ok('無 story 時 narrative 欄位為空字串', snap.full.narrative.appearance === '' && snap.full.narrative.backstory === '');
}

/* ---- 案例 3：背包上限 40 ---- */
{
  const big = [];
  for (let i = 0; i < 60; i++) big.push({ name: 'item' + i, qty: 1, equipped: false });
  const char = { id: 'c3', name: '囤物者', classes: [{ name: '法師', level: 1 }], hp: { current: 6, max: 6 }, ac: 12, inventory: big, abilities: {} };
  const snap = makeSnapFn({ value: char })();
  console.log('案例3 背包上限：');
  ok('full.inventory 上限 40', snap.full.inventory.length === 40);
}

/* ---- 案例 4：full 建構丟例外 → 退回 Tier1 ---- */
{
  const char = { id: 'c4', name: '容錯測試', classes: [{ name: '牧師', level: 2 }], hp: { current: 10, max: 10 }, ac: 13, abilities: {} };
  const snap = makeSnapFn({ value: char }, { throwOnAbility: true })();
  console.log('案例4 例外退回：');
  ok('Tier1 仍完整', snap.name === '容錯測試' && snap.level === 2 && snap.hp.max === 10);
  ok('full 不存在（安全退回，不中斷上傳）', !('full' in snap));
}

/* ---- 案例 5：無選角 ---- */
{
  const snap = makeSnapFn({ value: null })();
  console.log('案例5 無選角：');
  ok('回傳占位 {name:(未選角色), level:1}', snap.name === '(未選角色)' && snap.level === 1);
}

console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
process.exit(fail ? 1 : 0);
