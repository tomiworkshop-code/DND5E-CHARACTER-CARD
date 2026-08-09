/* PR-Local-4 Dev 冒煙測試：離線異動 changelog（offlineLog）。
 * 手法：以 vm 共享 context 載入 production 的 shared/character-schema.js + shared/store.js
 *   （兩檔都用 `typeof window !== 'undefined' ? window : this` 掛全域；我們注入 window=ctx，
 *    讓兩檔掛到同一 global，store 的 _char() 才讀得到 DND5E_CHAR）。驗真實 production code。
 * 覆蓋：changelog 產生、connected 不記錄、上限裁切、舊存檔無 offlineLog 不報錯、陣列欄位摘要、
 *       clearOfflineLog / markOfflineLogFlushed helper。
 * 執行：node archive/dev-scratch/test_pr_local_4_offlinelog.js
 * ※ 純測試檔；不修改 production code。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = {};
ctx.window = ctx;
ctx.console = console;
ctx.JSON = JSON;
ctx.Date = Date;
ctx.Math = Math;
ctx.Object = Object;
ctx.Array = Array;
vm.createContext(ctx);
function load(rel){
  vm.runInContext(fs.readFileSync(path.join(__dirname, rel), 'utf8'), ctx, { filename: rel });
}
load('../../shared/character-schema.js');
load('../../shared/store.js');

const CHAR = ctx.DND5E_CHAR;
const STORE = ctx.DND5E_STORE;

let pass = 0, fail = 0; const fails = [];
function check(name, cond) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; fails.push(name); console.log('  ❌ ' + name); } }

/* 由 char 建立 watch(chars) 慣例形狀的 identity + instance 種子（version_m/n=1）。 */
function seed(c) {
  const wid = STORE.DEFAULT_WORLD_ID;
  const ident = { characterId: c.id, identity: STORE.pickIdentityFields(c), version_n: 1 };
  const iid = c.id + '@' + wid;
  const inst = {
    instanceId: iid, characterId: c.id, worldId: wid,
    mechanical: STORE.pickMechanicalFields(c),
    narrative: STORE.pickInstanceNarrative(c),
    worldProgress: {}, version_m: 1, version_n: 1, updatedAt: Date.now()
  };
  return { ident, inst };
}

console.log('== PART A：local 模式產生 changelog（hp 純量欄位） ==');
(function () {
  const c = CHAR.defaultChar();
  const { ident, inst } = seed(c);
  c.hp.current = 3; // 由 10 → 3
  const changed = STORE.decomposeC(c, ident, inst, { mode: 'local' });
  check('decomposeC 回傳 true（有異動）', changed === true);
  check('version_m 由 1 bump→ 2', inst.version_m === 2);
  check('offlineLog 有 1 筆', Array.isArray(inst.offlineLog) && inst.offlineLog.length === 1);
  const e = inst.offlineLog[0];
  check('path === hp', e && e.path === 'hp');
  check('zone === mechanical', e && e.zone === 'mechanical');
  check('from.current === 10', e && e.from && e.from.current === 10);
  check('to.current === 3', e && e.to && e.to.current === 3);
  check('source === local-edit（預設）', e && e.source === 'local-edit');
  check('baseVm === 1（bump 前的 version_m）', e && e.baseVm === 1);
  check('at 為數字時間戳', e && typeof e.at === 'number');
})();

console.log('== PART B：connected 模式不記錄（維持現況） ==');
(function () {
  const c = CHAR.defaultChar();
  const { ident, inst } = seed(c);
  c.coins.gp = 50;
  const changed = STORE.decomposeC(c, ident, inst, { mode: 'connected' });
  check('decomposeC 仍落帳/bump（回傳 true）', changed === true);
  check('version_m 仍 bump→ 2', inst.version_m === 2);
  check('offlineLog 未建立/為空', !inst.offlineLog || inst.offlineLog.length === 0);
})();

console.log('== PART C：opts 省略維持現況（不寫 log、既有呼叫端相容） ==');
(function () {
  const c = CHAR.defaultChar();
  const { ident, inst } = seed(c);
  c.hp.max = 20;
  const changed = STORE.decomposeC(c, ident, inst); // 舊呼叫端 3 參數
  check('decomposeC 3 參數仍運作（回傳 true）', changed === true);
  check('version_m 仍 bump→ 2', inst.version_m === 2);
  check('offlineLog 未寫入', !inst.offlineLog || inst.offlineLog.length === 0);
})();

console.log('== PART D：上限裁切（OFFLINE_LOG_LIMIT） ==');
(function () {
  const c = CHAR.defaultChar();
  const { ident, inst } = seed(c);
  const LIMIT = STORE.OFFLINE_LOG_LIMIT;
  const total = LIMIT + 15;
  for (let i = 1; i <= total; i++) {
    c.coins.gp = i; // 每輪只改 coins → 每輪 1 筆 FieldChange
    STORE.decomposeC(c, ident, inst, { mode: 'local' });
  }
  check('OFFLINE_LOG_LIMIT === 200', LIMIT === 200);
  check('offlineLog 長度裁切至上限', inst.offlineLog.length === LIMIT);
  // 保留最新：最後一筆 to.gp === total
  const last = inst.offlineLog[inst.offlineLog.length - 1];
  check('保留最新（最後一筆 to.gp === total）', last && last.to && last.to.gp === total);
  // 丟最舊：第一筆 baseVm 不該是最初的 1（最舊已被丟）
  check('丟最舊（首筆 baseVm > 1）', inst.offlineLog[0].baseVm > 1);
})();

console.log('== PART E：舊存檔無 offlineLog 欄位不報錯 ==');
(function () {
  const c = CHAR.defaultChar();
  const { ident, inst } = seed(c);
  delete inst.offlineLog; // 模擬舊存檔（無此欄位）
  let threw = false;
  try {
    c.hp.current = 7;
    STORE.decomposeC(c, ident, inst, { mode: 'offline-dm' });
  } catch (err) { threw = true; }
  check('舊存檔 decomposeC 不丟例外', threw === false);
  check('offlineLog 自動初始化並記錄', Array.isArray(inst.offlineLog) && inst.offlineLog.length === 1);
  check('offline-dm 模式亦記錄', inst.offlineLog[0].path === 'hp');
})();

console.log('== PART F：陣列欄位存前/後快照 + 摘要（inventory） ==');
(function () {
  const c = CHAR.defaultChar();
  c.inventory = [{ name: '劍' }];
  const { ident, inst } = seed(c);
  c.inventory = [{ name: '劍' }, { name: '盾' }, { name: '藥水' }];
  STORE.decomposeC(c, ident, inst, { mode: 'local' });
  const e = inst.offlineLog.find(x => x.path === 'inventory');
  check('inventory 有 FieldChange', !!e);
  check('from 為長度 1 的快照', e && Array.isArray(e.from) && e.from.length === 1);
  check('to 為長度 3 的快照', e && Array.isArray(e.to) && e.to.length === 3);
  check('summary 反映 1 → 3', e && e.summary === '1 → 3 項');
})();

console.log('== PART G：多欄位一次落帳、identity(narrative) 欄位也記 ==');
(function () {
  const c = CHAR.defaultChar();
  const { ident, inst } = seed(c);
  c.hp.current = 5;       // mechanical
  c.coins.gp = 99;        // mechanical
  c.name = '卡娜拉';      // identity → narrative zone
  STORE.decomposeC(c, ident, inst, { mode: 'local' });
  const paths = inst.offlineLog.map(x => x.path);
  check('含 hp', paths.indexOf('hp') >= 0);
  check('含 coins', paths.indexOf('coins') >= 0);
  check('含 name', paths.indexOf('name') >= 0);
  const nameE = inst.offlineLog.find(x => x.path === 'name');
  check('name zone === narrative', nameE && nameE.zone === 'narrative');
  check('name from ""→ 卡娜拉', nameE && nameE.from === '' && nameE.to === '卡娜拉');
})();

console.log('== PART H：cleanup helper（clearOfflineLog / markOfflineLogFlushed） ==');
(function () {
  const c = CHAR.defaultChar();
  const { ident, inst } = seed(c);
  c.hp.current = 1;
  STORE.decomposeC(c, ident, inst, { mode: 'local' });
  check('先有 log', inst.offlineLog.length === 1);
  STORE.markOfflineLogFlushed(inst, 9);
  check('markOfflineLogFlushed 標 flushed', inst.offlineLog[0].flushed === true);
  check('markOfflineLogFlushed 標 flushedAtVm', inst.offlineLog[0].flushedAtVm === 9);
  STORE.clearOfflineLog(inst);
  check('clearOfflineLog 清空', Array.isArray(inst.offlineLog) && inst.offlineLog.length === 0);
})();

console.log('\n================ RESULT ================');
console.log('PASS=' + pass + '  FAIL=' + fail);
if (fail) { console.log('FAILED: ' + fails.join(' | ')); process.exit(1); }
console.log('ALL GREEN ✅');
