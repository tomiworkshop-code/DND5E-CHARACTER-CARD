/* test_dmv2_step3_finalize.js
 * Step 3.3 最關鍵安全測試：DM「就地編輯定案」回送的【最小 partial save】
 * 經玩家端真實合流（DND5E_CHAR.mergeInstance / applyZone）後，
 * 【只能】改到 DM 送出的欄位（hp/ac），【絕不能】損毀玩家完整的
 * 技能 / 背包 / 魔寵 / 敘事等未送出欄位。
 *
 * 同時驗證版本裁決：
 *  - remote.version_m >= local → 採用（機制區覆寫）＝定案生效。
 *  - remote.version_m <  local → 不覆寫（玩家領先，handleRemoteSave 會轉衝突 UI）。
 * 採用真實 shared/character-schema.js（與線上一字不差）。
 */
const vm = require('vm');
const fs = require('fs');

const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
function loadAsWindow(file) {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext('(function(){ var self=window; ' + code + '\n}).call(window);', sandbox, { filename: file });
}
loadAsWindow('shared/character-schema.js');
const C = sandbox.window.DND5E_CHAR;
if (!C) { console.error('❌ schema 未掛載'); process.exit(1); }

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713', name); } else { fail++; console.log('  \u2717', name); } }

/* ---- 建立一個「完整」玩家角色（機制區含豐富資料）---- */
function makeFullChar() {
  const c = C.defaultChar();
  c.id = 'cX'; c.characterId = 'cX'; c.name = '完整騎士';
  c.hp = { current: 24, max: 30, temp: 3 };
  c.ac = 16;
  c.abilities = { str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 8 };
  c.classes = [{ name: '聖騎士', level: 5 }];
  c.skills['察覺'] = { proficient: true, expertise: false, override: null };
  c.skills['運動'] = { proficient: true, expertise: true, override: null };
  c.inventory = [
    { name: '聖劍', qty: 1, equipped: true },
    { name: '治療藥水', qty: 3, equipped: false },
    { name: '盾', qty: 1, equipped: true }
  ];
  c.familiars = [{ name: '戰馬', type: '坐騎', ac: 12, hp: { current: 15, max: 15 }, abilities: {}, attacks: '', notes: '忠誠' }];
  c.story = { appearance: '金髮碧眼', personality: '正直', ideals: '守護弱小', bonds: '故鄉', flaws: '固執', allies: '教會', backstory: '出身貴族……' };
  c.spellsText = '聖光術、神聖打擊';
  C.ensureSync(c);
  c._sync.version_m = 2;   /* 玩家目前機制版本 */
  c._sync.version_n = 1;
  return c;
}

/* 模擬玩家端 adoptRemoteSave 的核心：以 local 為基、mergeInstance 合流，
 * 再用 extractZone/applyZone 明確套回 char（與 v2/app.js adoptRemoteSave 同手法）。 */
function playerAdopt(localChar, remoteSave) {
  const localFlat = C.extractZone(localChar, 'mechanical');
  Object.assign(localFlat, C.extractZone(localChar, 'narrative'));
  localFlat._sync = { version_m: localChar._sync.version_m, version_n: localChar._sync.version_n };
  const merged = C.mergeInstance(localFlat, remoteSave);
  const out = JSON.parse(JSON.stringify(localChar));
  C.applyZone(out, 'mechanical', C.extractZone(merged, 'mechanical'));
  C.applyZone(out, 'narrative', C.extractZone(merged, 'narrative'));
  out._sync = out._sync || {};
  out._sync.version_m = (merged._sync && merged._sync.version_m) || 0;
  out._sync.version_n = (merged._sync && merged._sync.version_n) || 0;
  return out;
}

/* ================= 案例 1：DM partial(version_m 前進) 生效且不損毀 ================= */
{
  const player = makeFullChar();
  /* DM 送出的最小 partial：只有 hp/ac + _sync（version_m = local+1 = 3） */
  const partial = {
    hp: { current: 8, max: 30, temp: 0 },
    ac: 20,
    _sync: { version_m: 3, version_n: 1 }
  };
  const after = playerAdopt(player, partial);

  console.log('案例1 partial 定案生效：');
  ok('HP 已被 DM 覆寫 (24→8)', after.hp.current === 8 && after.hp.max === 30 && after.hp.temp === 0);
  ok('AC 已被 DM 覆寫 (16→20)', after.ac === 20);
  ok('version_m 前進為 3', after._sync.version_m === 3);
  /* 關鍵：未送出欄位完全保留 */
  ok('技能未損毀（察覺仍熟練）', after.skills['察覺'].proficient === true);
  ok('技能未損毀（運動仍專精）', after.skills['運動'].expertise === true);
  ok('技能總數不變 (18)', Object.keys(after.skills).length === Object.keys(player.skills).length);
  ok('背包完整保留 (3 件、聖劍仍在)', after.inventory.length === 3 && after.inventory[0].name === '聖劍');
  ok('治療藥水數量保留 (qty 3)', after.inventory[1].qty === 3);
  ok('魔寵完整保留（戰馬 + notes）', after.familiars.length === 1 && after.familiars[0].name === '戰馬' && after.familiars[0].notes === '忠誠');
  ok('職業保留（聖騎士 Lv5）', after.classes[0].name === '聖騎士' && after.classes[0].level === 5);
  ok('屬性保留 (str16)', after.abilities.str === 16);
  ok('法術文字保留', after.spellsText === '聖光術、神聖打擊');
  ok('敘事保留（背景故事）', after.story.backstory === '出身貴族……');
}

/* ================= 案例 2：DM version_m 落後 → 機制區不覆寫（玩家領先） ================= */
{
  const player = makeFullChar();   /* local version_m = 2 */
  const stale = { hp: { current: 1, max: 30, temp: 0 }, ac: 5, _sync: { version_m: 1, version_n: 1 } };
  const after = playerAdopt(player, stale);
  console.log('案例2 DM 版本落後不覆寫：');
  ok('HP 不被覆寫（仍 24）', after.hp.current === 24);
  ok('AC 不被覆寫（仍 16）', after.ac === 16);
  ok('version_m 維持 2', after._sync.version_m === 2);
}

/* ================= 案例 3：version_m 相等 → 採用（支援「恢復」情境） ================= */
{
  const player = makeFullChar();   /* local version_m = 2 */
  const equal = { hp: { current: 10, max: 30, temp: 0 }, ac: 17, _sync: { version_m: 2, version_n: 1 } };
  const after = playerAdopt(player, equal);
  console.log('案例3 version_m 相等採用：');
  ok('HP 採用 (=版本，恢復情境, →10)', after.hp.current === 10);
  ok('AC 採用 (→17)', after.ac === 17);
  ok('技能仍完整（未損毀）', after.skills['運動'].expertise === true && after.inventory.length === 3);
}

console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
process.exit(fail ? 1 : 0);
