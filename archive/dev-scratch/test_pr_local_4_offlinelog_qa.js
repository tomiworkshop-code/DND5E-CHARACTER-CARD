/* PR-Local-4 【獨立 QA】離線異動 changelog（offlineLog）驗收。
 * 由 QA 子代理獨立撰寫，不採信 Dev 自報。載入真實 production code（vm 共享 context）：
 *   shared/character-schema.js + shared/store.js（現行工作區版本），
 *   以及 baseline 74831b8 的 store.js（另一 context）供「零破壞」逐步等價比對。
 * 覆蓋 QA 重點 1~8：零破壞等價、changelog 結構正確、模式判定（含連線 instance / applyCommand
 *   writeInstanceFromChar 保留版本→watch 無 diff→不寫 log）、R1 上限、舊存檔相容、cleanup helper。
 * 執行：node archive/dev-scratch/test_pr_local_4_offlinelog_qa.js
 * ※ 純測試檔；不修改 production code。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function makeCtx() {
  const ctx = {};
  ctx.window = ctx;
  ctx.console = console;
  ctx.JSON = JSON; ctx.Date = Date; ctx.Math = Math;
  ctx.Object = Object; ctx.Array = Array; ctx.parseInt = parseInt; ctx.parseFloat = parseFloat;
  vm.createContext(ctx);
  return ctx;
}
function loadInto(ctx, rel, abs) {
  const p = abs || path.join(__dirname, rel);
  vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
}

// --- current working-tree production ---
const cur = makeCtx();
loadInto(cur, '../../shared/character-schema.js');
loadInto(cur, '../../shared/store.js');
const CHAR = cur.DND5E_CHAR;
const STORE = cur.DND5E_STORE;

// --- baseline 74831b8 store.js (share same CHAR schema via a fresh ctx) ---
const base = makeCtx();
loadInto(base, '../../shared/character-schema.js');
loadInto(base, null, '/tmp/store_baseline.js');
const BASE_STORE = base.DND5E_STORE;

let pass = 0, fail = 0; const fails = [];
function check(name, cond) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; fails.push(name); console.log('  ❌ ' + name); } }

function memStorage() {
  const d = {};
  return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: k => { delete d[k]; }, _d: d };
}
function seed(c, S) {
  S = S || STORE;
  const wid = S.DEFAULT_WORLD_ID;
  const ident = { characterId: c.id, identity: S.pickIdentityFields(c), version_n: 1 };
  const iid = c.id + '@' + wid;
  const inst = {
    instanceId: iid, characterId: c.id, worldId: wid,
    mechanical: S.pickMechanicalFields(c),
    narrative: S.pickInstanceNarrative(c),
    worldProgress: {}, version_m: 1, version_n: 1, updatedAt: Date.now()
  };
  return { ident, inst, wid };
}

/* =====================================================================
 * QA-1 零破壞：baseline(74831b8) vs current，3 參數與 connected 模式逐步等價
 * ===================================================================== */
console.log('== QA-1 零破壞等價（baseline 74831b8 vs current） ==');
(function () {
  // 施加一連串代表性編輯，兩版分別跑，比對 return / version / 落帳結果
  const edits = [
    c => { c.hp.current = 3; },
    c => { c.coins.gp = 42; },
    c => { c.name = '卡娜拉'; c.story.ideals = '守序'; },
    c => { c.inventory = [{ name: '劍' }, { name: '盾' }]; },
    c => { c.notes = '離線筆記'; },
    c => { /* no-op：不改任何欄位 */ },
    c => { c.worldProgress = { location: '森林' }; }, // 只改 worldProgress
  ];

  // baseline: 3-arg
  const cb = CHAR.defaultChar(); cb.id = 'x1';
  const sb = seed(cb, BASE_STORE);
  // current: 3-arg（省略 opts）
  const cc = CHAR.defaultChar(); cc.id = 'x1';
  const sc = seed(cc, STORE);
  // current: connected（帶 opts.mode='connected'）
  const cd = CHAR.defaultChar(); cd.id = 'x1';
  const sd = seed(cd, STORE);

  let allEq = true, connNoLog = true, retEq = true;
  edits.forEach((mut, i) => {
    mut(cb); mut(cc); mut(cd);
    const rb = BASE_STORE.decomposeC(cb, sb.ident, sb.inst);
    const rc = STORE.decomposeC(cc, sc.ident, sc.inst);
    const rd = STORE.decomposeC(cd, sd.ident, sd.inst, { mode: 'connected', source: 'local-edit' });
    if (rb !== rc || rb !== rd) { retEq = false; console.log('     step ' + i + ' return mismatch b=' + rb + ' c=' + rc + ' d=' + rd); }
    if (sb.inst.version_m !== sc.inst.version_m || sb.inst.version_n !== sc.inst.version_n) allEq = false;
    if (sb.inst.version_m !== sd.inst.version_m || sb.inst.version_n !== sd.inst.version_n) allEq = false;
    if (sb.ident.version_n !== sc.ident.version_n || sb.ident.version_n !== sd.ident.version_n) allEq = false;
    if (JSON.stringify(sb.inst.mechanical) !== JSON.stringify(sc.inst.mechanical)) allEq = false;
    if (JSON.stringify(sb.inst.narrative) !== JSON.stringify(sc.inst.narrative)) allEq = false;
    if (JSON.stringify(sb.inst.worldProgress) !== JSON.stringify(sc.inst.worldProgress)) allEq = false;
    if (sc.inst.offlineLog || sd.inst.offlineLog) connNoLog = false;
  });
  check('return 值三版全等（每步）', retEq);
  check('version_m/n 與落帳結果 baseline≡current(3-arg)≡connected', allEq);
  check('3-arg 省略 opts → 從不建立 offlineLog', !sc.inst.offlineLog);
  check('connected 模式 → 從不建立 offlineLog', !sd.inst.offlineLog);
  check('最終 version_m 一致(=5：hp/coins/inv/notes... 共 5 次機制/敘事 bump 中的機制)', sb.inst.version_m === sc.inst.version_m);
})();

/* =====================================================================
 * QA-2 changelog 結構完整性：{ path, zone, from, to, at, source, baseVm, [summary] }
 * ===================================================================== */
console.log('== QA-2 FieldChange 結構完整性 ==');
(function () {
  const c = CHAR.defaultChar(); c.id = 'x2';
  const { ident, inst } = seed(c);
  c.hp.current = 4;                 // 純量 mechanical
  c.inventory = [{ name: 'a' }];    // 陣列 mechanical (from [] → [a])
  STORE.decomposeC(c, ident, inst, { mode: 'local', source: 'local-dice' });
  const hp = inst.offlineLog.find(e => e.path === 'hp');
  const inv = inst.offlineLog.find(e => e.path === 'inventory');
  const required = ['path', 'zone', 'from', 'to', 'at', 'source', 'baseVm'];
  const hpKeysOk = hp && required.every(k => Object.prototype.hasOwnProperty.call(hp, k));
  check('純量 FieldChange 含全部必填鍵', hpKeysOk);
  check('純量欄位無 summary', hp && !('summary' in hp));
  check('source 透傳 local-dice', hp && hp.source === 'local-dice');
  check('baseVm === bump 前 version_m(1)', hp && hp.baseVm === 1);
  check('陣列欄位含 summary', inv && typeof inv.summary === 'string');
  check('陣列 summary = "0 → 1 項"', inv && inv.summary === '0 → 1 項');
  check('陣列 from/to 存前後快照(非逐元素 diff)', inv && Array.isArray(inv.from) && inv.from.length === 0 && Array.isArray(inv.to) && inv.to.length === 1);
})();

/* =====================================================================
 * QA-3 baseVm 追蹤：連續離線編輯，baseVm 記錄「當下 bump 前」版本
 * ===================================================================== */
console.log('== QA-3 baseVm 逐次追蹤 ==');
(function () {
  const c = CHAR.defaultChar(); c.id = 'x3';
  const { ident, inst } = seed(c); // version_m=1
  c.hp.current = 9; STORE.decomposeC(c, ident, inst, { mode: 'local' }); // baseVm should be 1, →vm2
  c.hp.current = 8; STORE.decomposeC(c, ident, inst, { mode: 'local' }); // baseVm 2 →vm3
  c.hp.current = 7; STORE.decomposeC(c, ident, inst, { mode: 'local' }); // baseVm 3 →vm4
  const b = inst.offlineLog.map(e => e.baseVm);
  check('baseVm 序列 = [1,2,3]', JSON.stringify(b) === JSON.stringify([1, 2, 3]));
  check('最終 version_m = 4', inst.version_m === 4);
})();

/* =====================================================================
 * QA-4 identity narrative 欄位（name/story）+ instance narrative(notes) 都記錄
 * ===================================================================== */
console.log('== QA-4 narrative（identity story / notes）記錄 ==');
(function () {
  const c = CHAR.defaultChar(); c.id = 'x4';
  const { ident, inst } = seed(c);
  c.story.bonds = '守護村莊';   // identity narrative（pickIdentityFields.story）
  c.notes = '角色筆記';          // instance narrative（pickInstanceNarrative.notes）
  STORE.decomposeC(c, ident, inst, { mode: 'offline-dm' });
  const story = inst.offlineLog.find(e => e.path === 'story');
  const notes = inst.offlineLog.find(e => e.path === 'notes');
  check('story FieldChange 存在且 zone=narrative', story && story.zone === 'narrative');
  check('story 前後值正確', story && story.from && story.from.bonds === '' && story.to.bonds === '守護村莊');
  check('notes FieldChange 存在且 zone=narrative', notes && notes.zone === 'narrative');
  check('notes 前後值正確', notes && notes.from === '' && notes.to === '角色筆記');
})();

/* =====================================================================
 * QA-5【關鍵】模式判定：_modeForWid 三態 + 連線 instance 落帳不寫 log +
 *   applyCommand→writeInstanceFromChar 保留版本→watch 無 diff→不寫 log
 * ===================================================================== */
console.log('== QA-5 模式判定與 DM 權威流程不被污染 ==');
(function () {
  // 5a：忠實複刻 app.js 的 _modeForWid 邏輯並驗三態
  const DEFAULT = STORE.DEFAULT_WORLD_ID;
  function modeForWid(room, wid) {
    return (room.status === 'connected' && room.meta && room.meta.worldId === wid) ? 'connected'
      : (wid === DEFAULT ? 'local' : 'offline-dm');
  }
  const connRoom = { status: 'connected', meta: { worldId: 'w_dm_1' } };
  const offRoom = { status: 'idle', meta: {} };
  check('連線世界 instance → connected', modeForWid(connRoom, 'w_dm_1') === 'connected');
  check('本地預設世界 → local', modeForWid(connRoom, DEFAULT) === 'local');
  check('曾連 DM 世界但當前非連線 → offline-dm', modeForWid(offRoom, 'w_dm_1') === 'offline-dm');
  check('離線時本地世界 → local', modeForWid(offRoom, DEFAULT) === 'local');

  // 5b：連線世界 instance 直接落帳（mode=connected）→ 有 diff 也不寫 log
  const c = CHAR.defaultChar(); c.id = 'p1';
  const wid = 'w_dm_1';
  const ident = { characterId: c.id, identity: STORE.pickIdentityFields(c), version_n: 5 };
  const iid = c.id + '@' + wid;
  const inst = { instanceId: iid, characterId: c.id, worldId: wid, mechanical: STORE.pickMechanicalFields(c), narrative: STORE.pickInstanceNarrative(c), worldProgress: {}, version_m: 7, version_n: 5, updatedAt: Date.now() };
  c.hp.current = 1;
  const r = STORE.decomposeC(c, ident, inst, { mode: modeForWid(connRoom, wid), source: 'local-edit' });
  check('連線世界有異動仍落帳(return true)', r === true);
  check('連線世界 version_m bump(7→8)', inst.version_m === 8);
  check('連線世界 instance 落帳「不」寫 offlineLog', !inst.offlineLog);

  // 5c：applyCommand 模擬 — DM 指令用 writeInstanceFromChar「保留版本」寫回，
  //     隨後 watch 的 composeC→decomposeC(connected) 應偵測「無 diff」→ 不 bump、不寫 log。
  const store2 = memStorage();
  STORE.setStorage(store2);
  try {
    const dmChar = CHAR.defaultChar(); dmChar.id = 'p2';
    // 先建立 baseline instance（version_m=10）
    const seededVersions = { version_m: 10, version_n: 3 };
    dmChar.hp.current = 20; dmChar.hp.max = 20;
    // 模擬 DM 指令改 hp 後，applyCommand 走 writeInstanceFromChar 保留 DM 給的版本（不遞增）
    dmChar.hp.current = 12;
    STORE.writeInstanceFromChar(dmChar, wid, seededVersions);
    // 讀回 instance（如同 watch 前的最新落帳狀態）
    const instances = JSON.parse(store2._d['dnd_instances_v2']);
    const inst2 = instances[dmChar.id + '@' + wid];
    check('writeInstanceFromChar 保留 version_m=10（未遞增）', inst2.version_m === 10);
    // watch：由 instance composeC 回 live char，再 decomposeC（connected）
    const identC = { characterId: dmChar.id, identity: STORE.pickIdentityFields(dmChar), version_n: 3 };
    const live = STORE.composeC(identC, inst2);
    const changed = STORE.decomposeC(live, identC, inst2, { mode: modeForWid(connRoom, wid), source: 'local-edit' });
    check('watch 後 decomposeC 偵測無 diff（return false）', changed === false);
    check('version_m 未被 watch 假性遞增（仍 10）', inst2.version_m === 10);
    check('DM 指令未變成離線異動（無 offlineLog）', !inst2.offlineLog);
  } finally {
    STORE.setStorage(null);
  }
})();

/* =====================================================================
 * QA-6 R1 上限：> 200 丟最舊留最新，且裁切後陣列長度恆 = LIMIT
 * ===================================================================== */
console.log('== QA-6 R1 上限裁切 ==');
(function () {
  const c = CHAR.defaultChar(); c.id = 'x6';
  const { ident, inst } = seed(c);
  const LIMIT = STORE.OFFLINE_LOG_LIMIT;
  check('OFFLINE_LOG_LIMIT === 200', LIMIT === 200);
  const N = LIMIT + 37;
  for (let i = 1; i <= N; i++) { c.coins.gp = i; STORE.decomposeC(c, ident, inst, { mode: 'local' }); }
  check('長度精確等於上限', inst.offlineLog.length === LIMIT);
  const last = inst.offlineLog[inst.offlineLog.length - 1];
  const first = inst.offlineLog[0];
  check('保留最新（末筆 to.gp === N）', last.to.gp === N);
  check('丟最舊（首筆 to.gp === N-LIMIT+1）', first.to.gp === (N - LIMIT + 1));
})();

/* =====================================================================
 * QA-7 舊存檔相容：instance 無 offlineLog / offlineLog 為非陣列 → 不報錯、自動初始化
 * ===================================================================== */
console.log('== QA-7 舊存檔相容 ==');
(function () {
  // 7a: 完全無欄位
  const c1 = CHAR.defaultChar(); c1.id = 'x7a';
  const s1 = seed(c1); delete s1.inst.offlineLog;
  let threw = false;
  try { c1.hp.current = 2; STORE.decomposeC(c1, s1.ident, s1.inst, { mode: 'local' }); } catch (e) { threw = true; }
  check('無 offlineLog 欄位不報錯', !threw);
  check('自動初始化為陣列並記 1 筆', Array.isArray(s1.inst.offlineLog) && s1.inst.offlineLog.length === 1);

  // 7b: offlineLog 為髒值（非陣列）→ _pushOfflineLog 重置為陣列
  const c2 = CHAR.defaultChar(); c2.id = 'x7b';
  const s2 = seed(c2); s2.inst.offlineLog = 'corrupt';
  let threw2 = false;
  try { c2.hp.current = 6; STORE.decomposeC(c2, s2.ident, s2.inst, { mode: 'local' }); } catch (e) { threw2 = true; }
  check('offlineLog 非陣列髒值不報錯', !threw2);
  check('髒值被重置為陣列且記錄', Array.isArray(s2.inst.offlineLog) && s2.inst.offlineLog.length === 1);

  // 7c: connected 模式 + 無 offlineLog → 保持不建立（不初始化空陣列）
  const c3 = CHAR.defaultChar(); c3.id = 'x7c';
  const s3 = seed(c3); delete s3.inst.offlineLog;
  c3.hp.current = 9; STORE.decomposeC(c3, s3.ident, s3.inst, { mode: 'connected' });
  check('connected 下不會為舊存檔硬塞 offlineLog', !s3.inst.offlineLog);
})();

/* =====================================================================
 * QA-8 cleanup helper：clearOfflineLog / markOfflineLogFlushed（含防呆）
 * ===================================================================== */
console.log('== QA-8 cleanup helper ==');
(function () {
  const c = CHAR.defaultChar(); c.id = 'x8';
  const { ident, inst } = seed(c);
  c.hp.current = 1; c.coins.gp = 5;
  STORE.decomposeC(c, ident, inst, { mode: 'local' });
  const n = inst.offlineLog.length;
  check('先有 >=2 筆 log', n >= 2);
  STORE.markOfflineLogFlushed(inst, 42);
  check('每筆標 flushed=true', inst.offlineLog.every(e => e.flushed === true));
  check('每筆標 flushedAtVm=42', inst.offlineLog.every(e => e.flushedAtVm === 42));
  check('markOfflineLogFlushed 不改變筆數', inst.offlineLog.length === n);
  STORE.clearOfflineLog(inst);
  check('clearOfflineLog 清空為 []', Array.isArray(inst.offlineLog) && inst.offlineLog.length === 0);
  // 防呆：傳非法值不炸
  let ok = true;
  try { STORE.markOfflineLogFlushed(null, 1); STORE.markOfflineLogFlushed({}, 1); STORE.clearOfflineLog(null); } catch (e) { ok = false; }
  check('helper 對 null/無 log 防呆不報錯', ok);
  // markOfflineLogFlushed flushedAtVm 省略 → 只標 flushed
  const c2 = CHAR.defaultChar(); c2.id = 'x8b';
  const s2 = seed(c2); c2.hp.current = 3; STORE.decomposeC(c2, s2.ident, s2.inst, { mode: 'local' });
  STORE.markOfflineLogFlushed(s2.inst);
  check('flushedAtVm 省略 → flushed=true 但無 flushedAtVm', s2.inst.offlineLog[0].flushed === true && !('flushedAtVm' in s2.inst.offlineLog[0]));
})();

console.log('\n================ QA RESULT ================');
console.log('PASS=' + pass + '  FAIL=' + fail);
if (fail) { console.log('FAILED: ' + fails.join(' | ')); process.exit(1); }
console.log('ALL GREEN ✅');
