/* 獨立 QA (PR-Local-2 + PR-Local-3)：source-derived 驗收，不信任手抄參考實作。
 * 手法：從 v2/app.js 原始碼「原文擷取」真實的 computed / 函式定義，注入 mock 依賴後
 *   於 vm 沙盒執行，驗證的是「production 程式碼本身」而非測試檔內的複製品。
 *   dice.js 直接 require（CommonJS 出口）。
 * 執行：node archive/dev-scratch/test_pr_local_2_3_qa.js
 * ※ 純測試檔；不修改 production code。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const APP = path.join(__dirname, '../../v2/app.js');
const src = fs.readFileSync(APP, 'utf8');
const DICE = require('../../shared/services/dice.js');

let pass = 0, fail = 0; const fails = [];
function check(name, cond) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; fails.push(name); console.log('  ❌ ' + name); } }

/* ---- 原文擷取工具 ---- */
// 括號配對（用於 computed(...) ）
function extractParen(name) {
  const start = src.indexOf('const ' + name + ' = computed(');
  if (start < 0) throw new Error('找不到 computed ' + name);
  let i = src.indexOf('computed(', start) + 'computed('.length - 1;
  let depth = 0, end = -1;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) { end = j; break; } }
  }
  return src.slice(start, end + 1) + ';';
}
// 大括號配對（用於 const NAME = (args) => { ... } 箭頭函式）
function extractArrowBlock(name) {
  const start = src.indexOf('const ' + name + ' = (');
  if (start < 0) throw new Error('找不到 arrow ' + name);
  const braceStart = src.indexOf('{', src.indexOf('=>', start));
  let depth = 0, end = -1;
  for (let j = braceStart; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = j; break; } }
  }
  return src.slice(start, end + 1) + ';';
}

/* ================================================================
 * PART A — sessionMode 決策矩陣（source-derived，驗真實 app.js）
 * ================================================================ */
const sessionModeSrc = extractParen('sessionMode');
const badgeSrc = extractParen('sessionModeBadge');
const connWidSrc = extractParen('connectedWorldId');
const DEFAULT_WORLD_ID = 'w_local_default';

function makeCtx(state) {
  const ctx = {
    computed: (fn) => ({ get value() { return fn(); } }),
    DEFAULT_WORLD_ID,
    room: state.room,
    selectedWorldKey: { value: state.selectedWorldKey },
    selectedWorldObj: { value: state.selectedWorldObj }
  };
  vm.createContext(ctx);
  vm.runInContext(sessionModeSrc + '\n' + badgeSrc + '\n' + connWidSrc +
    '\n__mode=sessionMode; __badge=sessionModeBadge; __cwid=connectedWorldId;', ctx);
  return ctx;
}
const mode = (s) => makeCtx(s).__mode.value;
const badge = (s) => makeCtx(s).__badge.value;
const cwid = (s) => makeCtx(s).__cwid.value;

const localW = { id: DEFAULT_WORLD_ID, type: 'local' };
const dmA = { id: 'w_dm_a', worldId: 'w_dm_a', type: 'dm' };
const dmB = { id: 'w_dm_b', worldId: 'w_dm_b', type: 'dm' };
const idle = { status: 'idle', meta: null };
const connA = { status: 'connected', meta: { worldId: 'w_dm_a' } };

console.log('\n[A] sessionMode 決策矩陣（真實 app.js 原文）');
console.log('    擷取確認 sessionMode 原文長度 =', sessionModeSrc.length, 'chars');
check('未連線 + 本地世界 → local', mode({ room: idle, selectedWorldKey: DEFAULT_WORLD_ID, selectedWorldObj: localW }) === 'local');
check('未連線 + DM 世界 → offline-dm', mode({ room: idle, selectedWorldKey: 'w_dm_a', selectedWorldObj: dmA }) === 'offline-dm');
check('連 w_dm_a 看 w_dm_a → connected', mode({ room: connA, selectedWorldKey: 'w_dm_a', selectedWorldObj: dmA }) === 'connected');
check('連 w_dm_a 看 local → local (非 connected)', mode({ room: connA, selectedWorldKey: DEFAULT_WORLD_ID, selectedWorldObj: localW }) === 'local');
check('連 w_dm_a 看 w_dm_b → offline-dm', mode({ room: connA, selectedWorldKey: 'w_dm_b', selectedWorldObj: dmB }) === 'offline-dm');

console.log('\n[B] id / worldId 兼容（既有存檔）');
check('連線世界只用 id 對齊(無 worldId 欄) → connected',
  mode({ room: connA, selectedWorldKey: 'w_dm_a', selectedWorldObj: { id: 'w_dm_a', type: 'dm' } }) === 'connected');
check('連線世界只用 worldId 對齊(key≠worldId) → connected',
  mode({ room: connA, selectedWorldKey: 'legacyid', selectedWorldObj: { id: 'legacyid', worldId: 'w_dm_a', type: 'dm' } }) === 'connected');
check('type=solo → local', mode({ room: idle, selectedWorldKey: 'x', selectedWorldObj: { id: 'x', type: 'solo' } }) === 'local');

console.log('\n[C] 缺 meta / worldId / 退化狀態容錯');
check('connected 但 meta=null → 不誤判 connected (看 DM 世界回 offline-dm)',
  mode({ room: { status: 'connected', meta: null }, selectedWorldKey: 'w_dm_a', selectedWorldObj: dmA }) === 'offline-dm');
check('connected 但 meta 無 worldId → offline-dm',
  mode({ room: { status: 'connected', meta: {} }, selectedWorldKey: 'w_dm_a', selectedWorldObj: dmA }) === 'offline-dm');
check('connecting 狀態(尚未 connected) 看 DM → offline-dm',
  mode({ room: { status: 'connecting', meta: null }, selectedWorldKey: 'w_dm_a', selectedWorldObj: dmA }) === 'offline-dm');
check('error 狀態 看 DM → offline-dm',
  mode({ room: { status: 'error', meta: null }, selectedWorldKey: 'w_dm_a', selectedWorldObj: dmA }) === 'offline-dm');
{
  let threw = false, m;
  try { m = mode({ room: idle, selectedWorldKey: 'ghost', selectedWorldObj: undefined }); } catch (e) { threw = true; }
  check('selectedWorldObj=undefined 不拋錯', !threw);
  check('undefined world fallback → local', m === 'local');
}
check('connectedWorldId 未連線→null', cwid({ room: idle, selectedWorldKey: DEFAULT_WORLD_ID, selectedWorldObj: localW }) === null);
check('connectedWorldId 連線→room.meta.worldId', cwid({ room: connA, selectedWorldKey: 'w_dm_a', selectedWorldObj: dmA }) === 'w_dm_a');

console.log('\n[D] sessionModeBadge 對齊（header 手機徽章 & 世界卡徽章共用同一 computed）');
{
  const bl = badge({ room: idle, selectedWorldKey: DEFAULT_WORLD_ID, selectedWorldObj: localW });
  const bc = badge({ room: connA, selectedWorldKey: 'w_dm_a', selectedWorldObj: dmA });
  const bo = badge({ room: idle, selectedWorldKey: 'w_dm_a', selectedWorldObj: dmA });
  check('local badge 🏠 + key/icon/label/cls 齊全', bl.icon === '🏠' && bl.key === 'local' && bl.label && bl.cls);
  check('connected badge 📡', bc.icon === '📡' && bc.key === 'connected');
  check('offline-dm badge 🕳️', bo.icon === '🕳️' && bo.key === 'offline-dm');
}

/* ================================================================
 * PART B — 一鍵套用 HP（source-derived applyHp 系列，驗真實 app.js clamp/gate）
 * ================================================================ */
console.log('\n[E] applyHp / applyHpFromDice / applyHpManual（真實 app.js 原文，mock 依賴）');
const applyHpSrc = extractArrowBlock('applyHp');
const applyHpFromDiceSrc = extractArrowBlock('applyHpFromDice');
const applyHpManualSrc = extractArrowBlock('applyHpManual');

function makeHpCtx(opts) {
  const logs = [];
  const alerts = [];
  const ctx = {
    canApplyHp: { value: opts.canApply },
    selectedChar: { value: opts.char },
    diceState: opts.diceState || { lastResult: null, hpAmount: 0 },
    pushWorldLog: (t, k) => logs.push({ t, k }),
    alert: (m) => alerts.push(m),
    Number: Number, Math: Math,
    __logs: logs, __alerts: alerts
  };
  vm.createContext(ctx);
  vm.runInContext(applyHpSrc + '\n' + applyHpFromDiceSrc + '\n' + applyHpManualSrc +
    '\n__applyHp=applyHp; __fromDice=applyHpFromDice; __manual=applyHpManual;', ctx);
  return ctx;
}

// 傷害 clamp 到 0
{
  const char = { hp: { current: 5, max: 20 } };
  const ctx = makeHpCtx({ canApply: true, char });
  ctx.__applyHp(-10);
  check('傷害超量 → clamp 0', char.hp.current === 0);
  check('傷害寫戰報 kind=hp', ctx.__logs.some(l => l.k === 'hp'));
}
// 治療 clamp 到 max
{
  const char = { hp: { current: 15, max: 20 } };
  const ctx = makeHpCtx({ canApply: true, char });
  ctx.__applyHp(100);
  check('治療超量 → clamp max', char.hp.current === 20);
}
// max=0 視為未設上限
{
  const char = { hp: { current: 3, max: 0 } };
  const ctx = makeHpCtx({ canApply: true, char });
  ctx.__applyHp(50);
  check('max=0 不 clamp（+50=53）', char.hp.current === 53);
}
// 一般傷害/治療
{
  const char = { hp: { current: 10, max: 30 } };
  const ctx = makeHpCtx({ canApply: true, char });
  ctx.__applyHp(-4);
  check('傷害 10→6', char.hp.current === 6);
  ctx.__applyHp(3);
  check('治療 6→9', char.hp.current === 9);
}
// connected 模式禁用
{
  const char = { hp: { current: 10, max: 30 } };
  const ctx = makeHpCtx({ canApply: false, char });
  ctx.__applyHp(-5);
  check('connected 模式 HP 不變（禁用）', char.hp.current === 10);
  check('connected 模式跳 alert 提示', ctx.__alerts.length === 1);
}
// 無角色
{
  const ctx = makeHpCtx({ canApply: true, char: null });
  ctx.__applyHp(-5);
  check('無角色 → alert，不崩', ctx.__alerts.some(a => /選擇角色/.test(a)));
}
// hp 物件缺失自動初始化
{
  const char = {};
  const ctx = makeHpCtx({ canApply: true, char });
  ctx.__applyHp(5);
  check('char.hp 缺失自動建立並套用（0+5=5）', char.hp && char.hp.current === 5);
}
// applyHpFromDice 傷害/治療
{
  const char = { hp: { current: 20, max: 30 } };
  const ctx = makeHpCtx({ canApply: true, char, diceState: { lastResult: { total: 7 }, hpAmount: 0 } });
  ctx.__fromDice(-1);
  check('骰值當傷害 20→13', char.hp.current === 13);
  ctx.__fromDice(1);
  check('骰值當治療 13→20', char.hp.current === 20);
}
// applyHpFromDice 無骰結果
{
  const char = { hp: { current: 20, max: 30 } };
  const ctx = makeHpCtx({ canApply: true, char, diceState: { lastResult: null, hpAmount: 0 } });
  ctx.__fromDice(-1);
  check('無骰結果 → alert，HP 不變', char.hp.current === 20 && ctx.__alerts.some(a => /擲骰/.test(a)));
}
// applyHpManual 手填
{
  const char = { hp: { current: 20, max: 30 } };
  const ds = { lastResult: null, hpAmount: 8 };
  const ctx = makeHpCtx({ canApply: true, char, diceState: ds });
  ctx.__manual(-1);
  check('手填 8 扣血 20→12', char.hp.current === 12);
  check('手填後歸零 hpAmount', ds.hpAmount === 0);
}
// applyHpManual 無金額
{
  const char = { hp: { current: 20, max: 30 } };
  const ctx = makeHpCtx({ canApply: true, char, diceState: { lastResult: null, hpAmount: 0 } });
  ctx.__manual(1);
  check('手填 0 → alert，HP 不變', char.hp.current === 20 && ctx.__alerts.some(a => /金額/.test(a)));
}

/* ================================================================
 * PART C — dice.js RNG 邊界（不合規 rng 是否出界；判 blocking）
 * ================================================================ */
console.log('\n[F] dice.js RNG 邊界（非法 rng）');
{
  // rng=1（違反 [0,1) 契約）：floor(1*20)+1 = 21 → 出界。
  const r1 = DICE.roll('1d20', { rng: () => 1 });
  console.log('     rng=1 → d20 =', r1.total, '(契約外輸入)');
  check('rng=1 會出界(21) — 已知：僅測試注入才可能，production 用 Math.random 不會', r1.total === 21);
  // rng 負值：floor(-0.5*20)+1 = -9 → 出界。
  const r2 = DICE.roll('1d20', { rng: () => -0.5 });
  console.log('     rng=-0.5 → d20 =', r2.total);
  check('rng<0 會出界(負值) — 同上，僅測試注入', r2.total < 1);
  // 合規邊界 rng=0 與趨近 1
  check('rng=0 → 下界 1', DICE.roll('1d20', { rng: () => 0 }).total === 1);
  check('rng→0.9999 → 上界 20', DICE.roll('1d20', { rng: () => 0.9999 }).total === 20);
}

console.log('\n[G] dice.js 優勢/劣勢語意 & 非 d20 套用（UX note 佐證）');
{
  // 非 d20 套 adv：2d6 adv → 每顆擲兩顆取高，共 4 顆 raw。非標準 5E 語意（僅供佐證 note）。
  const advNonD20 = DICE.roll('2d6', { mode: 'adv', rng: (function () { let i = 0; const v = [0, 0.9, 0.9, 0]; return () => v[i++ % v.length]; })() });
  check('2d6 adv 擲 4 顆 raw（非 d20 也接受 adv → UX note）', advNonD20.rolls.length === 4);
  check('2d6 adv kept 2 顆', advNonD20.kept.length === 2);
}

console.log('\n================ QA 結果 (PR-Local-2/3) ================');
console.log('PASS: ' + pass + '  FAIL: ' + fail);
if (fail) { console.log('失敗:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('✅ 全部通過');
process.exit(0);
