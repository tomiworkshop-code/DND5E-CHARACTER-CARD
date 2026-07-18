// P2-B 單測：onSave 合流形狀、version_m 紅線、xp、指令去重持久化。
// 真實 shared 模組（schema + store）+ 逐字複製 app.js 的
//   currentWorldId / dedup helpers / applyCommand / adoptRemoteSave / handleRemoteSave / resolveConflict。
const vm = require('vm');
const fs = require('fs');

// ---- 載入真實 shared 模組（與 test_backup_merge 相同手法）----
const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
function loadAsWindow(file){
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext('(function(){ var self=window; ' + code + '\n}).call(window);', sandbox, { filename: file });
}
loadAsWindow('shared/character-schema.js');
loadAsWindow('shared/store.js');

const CHAR = sandbox.window.DND5E_CHAR;
const STORE = sandbox.window.DND5E_STORE;
if (!CHAR || !STORE) { console.error('❌ 模組未掛載'); process.exit(1); }

// ---- 記憶體 localStorage（供 STORE + dedup helpers 共用同一份）----
const _mem = {};
const localStorage = {
  getItem: (k) => (k in _mem ? _mem[k] : null),
  setItem: (k, v) => { _mem[k] = String(v); },
  removeItem: (k) => { delete _mem[k]; },
  clear: () => { for (const k in _mem) delete _mem[k]; }
};
STORE.setStorage(localStorage);

// ---- 逐字擷取 app.js 的目標函式（維持與線上程式碼一字不差）----
const appSrc = fs.readFileSync('v2/app.js', 'utf8');
function slice(startAnchor, endAnchor){
  const a = appSrc.indexOf(startAnchor);
  const b = appSrc.indexOf(endAnchor, a + startAnchor.length);
  if (a < 0 || b < 0) throw new Error('找不到錨點: ' + startAnchor + ' / ' + endAnchor);
  return appSrc.slice(a, b);
}
// block1: currentWorldId → applyCommand → adoptRemoteSave → handleRemoteSave（到 bindDmWorld 前）
const block1 = slice('const currentWorldId =', 'const bindDmWorld =');
// block2: resolveConflict（到 leaveRoom 前）
const block2 = slice('const resolveConflict =', 'const leaveRoom =');

const window = { DND5E_CHAR: CHAR, DND5E_STORE: STORE };
const DEFAULT_WORLD_ID = STORE.DEFAULT_WORLD_ID;

// ---- 測試 harness ----
let pass = 0, fail = 0;
function ok(name, cond){ if(cond){ pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } }

function mkChar(){
  const c = CHAR.defaultChar();
  c.id = 'cHero';
  c.name = '英雄';
  c.hp = { current: 20, max: 20, temp: 0 };
  c.coins = { cp:0, sp:0, gp:10, pp:0 };
  c.inventory = [];
  c.xp = 0;
  c.classes = [{ name_en: 'Fighter', level: 3 }];
  return c;
}
// DM 存檔（remote）= 攤平 char 形狀：機制欄位在頂層 + _sync
function mkSave(overrides, vm_, vn_){
  const dm = mkChar();
  Object.assign(dm, overrides.top || {});
  if (overrides.hp) dm.hp = overrides.hp;
  if (overrides.coins) dm.coins = overrides.coins;
  if (overrides.inventory) dm.inventory = overrides.inventory;
  if (overrides.xp != null) dm.xp = overrides.xp;
  if (overrides.classes) dm.classes = overrides.classes;
  const save = CHAR.extractZone(dm, 'mechanical');
  Object.assign(save, CHAR.extractZone(dm, 'narrative'));
  save._sync = { version_m: vm_, version_n: vn_ };
  return save;
}

const sendRequests = [];
function makeHarness(char, roomOverrides){
  const selectedChar = { value: char };
  const room = Object.assign({
    status: 'connected', meta: { worldId: 'w_dm1' }, roomId: 'RID1', playerId: 'P1',
    messages: [], appliedCommands: new Set(), conflictSave: null, showConflict: false
  }, roomOverrides || {});
  const sendRoomRequest = (req) => { sendRequests.push(req); };
  const alert = () => {};
  const factory = new Function(
    'window','STORE','selectedChar','room','DEFAULT_WORLD_ID','localStorage','sendRoomRequest','alert',
    block1 + '\n' + block2 + '\n' +
    'return { currentWorldId, applyCommand, adoptRemoteSave, handleRemoteSave, resolveConflict, loadAppliedCommands, persistAppliedCommands };'
  );
  const fns = factory(window, STORE, selectedChar, room, DEFAULT_WORLD_ID, localStorage, sendRoomRequest, alert);
  return { selectedChar, room, fns };
}

// ============================================================
console.log('[Schema] defaultChar 有 xp、mergeChar 回填舊存檔');
ok('defaultChar().xp === 0', CHAR.defaultChar().xp === 0);
ok('mechanical zone 含 xp', CHAR.FIELD_ZONES.mechanical.includes('xp'));
const oldSave = { id: 'cOld', name: '老角色', hp: { current: 3, max: 8 } }; // 無 xp / 無 _sync
const migrated = CHAR.mergeChar(CHAR.defaultChar(), oldSave);
ok('mergeChar 回填 xp=0', migrated.xp === 0);
ok('mergeChar 回填 _sync {0,0}', migrated._sync && migrated._sync.version_m === 0 && migrated._sync.version_n === 0);

// ============================================================
console.log('\n[onSave-A] DM 較新 → 真正採用（char 變 DM 值，非 stale）');
{
  _mem_clear();
  const char = mkChar();
  STORE.writeInstanceFromChar(char, 'w_dm1', { version_m: 1, version_n: 1 });
  const { selectedChar, room, fns } = makeHarness(char);
  const save = mkSave({ hp:{current:5,max:20,temp:0}, coins:{cp:0,sp:0,gp:999,pp:0},
    inventory:[{name:'魔劍',qty:1,desc:''}], xp:1500 }, 2, 1);
  fns.handleRemoteSave(save);
  ok('char.hp.current 變 DM 值 5（非舊 20）', char.hp.current === 5);
  ok('char.coins.gp 變 999', char.coins.gp === 999);
  ok('char.inventory 含魔劍', (char.inventory||[]).some(i=>i.name==='魔劍'));
  ok('char.xp 變 1500', char.xp === 1500);
  ok('未觸發衝突', room.showConflict === false);
  const inst = STORE.loadInstances()['cHero@w_dm1'];
  ok('store instance version_m = 2（採 DM）', inst.version_m === 2);
  ok('store instance hp 落回 5', inst.mechanical.hp.current === 5);
}

// ============================================================
console.log('\n[onSave-B] 玩家真領先（玩家自編輯 bump）→ 不覆蓋、轉提案、跳衝突');
{
  _mem_clear();
  const char = mkChar();
  // 模擬玩家自己編輯造成 version_m 領先（如 watch/decomposeC bump 到 5）
  STORE.writeInstanceFromChar(char, 'w_dm1', { version_m: 5, version_n: 1 });
  const { selectedChar, room, fns } = makeHarness(char);
  const save = mkSave({ hp:{current:1,max:20,temp:0} }, 3, 1);
  fns.handleRemoteSave(save);
  ok('跳出衝突 UI', room.showConflict === true);
  ok('conflictSave 已設', room.conflictSave === save);
  ok('char 未被覆蓋（hp 仍 20）', char.hp.current === 20);
  // 保留本機 → 轉提案
  const before = sendRequests.length;
  fns.resolveConflict('keep_local');
  ok('keep_local 送出提案請求', sendRequests.length === before + 1 && sendRequests[sendRequests.length-1].kind === 'ask');
  ok('衝突面板關閉', room.showConflict === false);
}

// ============================================================
console.log('\n[衝突] 採用 DM（adopt_dm）真的覆寫本機（繞過版本閘）');
{
  _mem_clear();
  const char = mkChar();
  // 玩家自編輯造成 version_m 領先（localVm=5 > remoteVm=3）→ 觸發衝突
  char.hp = { current: 18, max: 20, temp: 0 };
  char.xp = 0;
  char.coins = { cp:0, sp:0, gp:10, pp:0 };
  STORE.writeInstanceFromChar(char, 'w_dm1', { version_m: 5, version_n: 1 });
  const { selectedChar, room, fns } = makeHarness(char);
  // DM 存檔（remoteVm=3 < localVm=5）：hp=1 / xp=7 / gp=99 / 等級 5
  const save = mkSave({ hp:{current:1,max:20,temp:0}, xp:7, coins:{cp:0,sp:0,gp:99,pp:0},
    classes:[{ name_en:'Fighter', level:5 }] }, 3, 1);
  fns.handleRemoteSave(save);
  ok('先觸發衝突 UI（localVm>remoteVm）', room.showConflict === true);
  ok('衝突時 char 尚未變動（hp 仍 18）', char.hp.current === 18);
  // 按「採用 DM（覆寫本機）」
  fns.resolveConflict('adopt_dm');
  ok('adopt_dm 後 char.hp 真的變 DM 值 1（非舊 18）', char.hp.current === 1);
  ok('adopt_dm 後 char.xp 真的變 DM 值 7（非舊 0）', char.xp === 7);
  ok('adopt_dm 後 char.coins.gp 變 99', char.coins.gp === 99);
  const lvl = (char.classes||[]).reduce((a,cl)=>a+(Number(cl.level)||0),0);
  ok('adopt_dm 後 等級 變 DM 值 5', lvl === 5);
  ok('衝突面板關閉', room.showConflict === false);
  ok('conflictSave 清空', room.conflictSave === null);
  const inst = STORE.loadInstances()['cHero@w_dm1'];
  ok('store instance hp 落回 DM 值 1', inst.mechanical.hp.current === 1);
  ok('store instance xp 落回 DM 值 7', inst.mechanical.xp === 7);
  ok('store instance version_m 對齊 DM（=3，不再領先）', inst.version_m === 3);
  // 對齊後：DM 再推相同 version_m 的 save → 不再誤判假衝突
  const save2 = mkSave({ hp:{current:2,max:20,temp:0} }, 3, 1);
  fns.handleRemoteSave(save2);
  ok('對齊後不觸發假衝突（相等版本採用 DM，hp=2）', char.hp.current === 2 && room.showConflict === false);
}

// ============================================================
console.log('\n[onSave-C] 版本相等 → 恢復（採用 DM，含 =）');
{
  _mem_clear();
  const char = mkChar();
  STORE.writeInstanceFromChar(char, 'w_dm1', { version_m: 4, version_n: 1 });
  const { selectedChar, room, fns } = makeHarness(char);
  const save = mkSave({ hp:{current:7,max:20,temp:0} }, 4, 1);
  fns.handleRemoteSave(save);
  ok('相等版本採用 DM（hp=7）', char.hp.current === 7);
  ok('無衝突', room.showConflict === false);
}

// ============================================================
console.log('\n[onSave-D] 缺 _sync → 回填（save 無 _sync 視為 {0,0}，local 首次無 instance）');
{
  _mem_clear();
  const char = mkChar();
  // 不建立 instance（首次入世界）
  const { selectedChar, room, fns } = makeHarness(char);
  const save = CHAR.extractZone(mkChar(), 'mechanical');
  save.hp = { current: 12, max: 20, temp: 0 };
  // 故意不給 _sync
  fns.handleRemoteSave(save);
  ok('首次無 instance + 無 _sync → 採用 DM（hp=12）', char.hp.current === 12);
  const inst = STORE.loadInstances()['cHero@w_dm1'];
  ok('落帳建立 instance', !!inst);
  ok('instance version_m 回填為 0', inst.version_m === 0);
}

// ============================================================
console.log('\n[紅線] DM 指令套用「不」bump 玩家 version_m；隨後 DM save 正常採用');
{
  _mem_clear();
  const char = mkChar();
  STORE.writeInstanceFromChar(char, 'w_dm1', { version_m: 1, version_n: 1 });
  const { selectedChar, room, fns } = makeHarness(char);
  // DM 指令：傷害 6
  fns.applyCommand({ type:'damage', amount:6, damageType:'火焰', _key:'k1', ts:1 });
  ok('char.hp 由指令更新（20→14）', char.hp.current === 14);
  let inst = STORE.loadInstances()['cHero@w_dm1'];
  ok('DM 指令未 bump version_m（仍為 1）', inst.version_m === 1);
  ok('HP 事件文案為規格格式', room.messages.some(m=>/DM 已調整 HP：20→14/.test(m.text)));

  // 模擬 reactive watch 的 decomposeC：因 applyCommand 已把新值落帳，decompose 偵測不到差異 → 不 bump
  const ident = { characterId: char.id, identity: STORE.pickIdentityFields(char), version_n: inst.version_n };
  const changed = STORE.decomposeC(char, ident, inst);
  ok('decomposeC 偵測無差異（DM 指令不觸發玩家 bump）', changed === false);
  ok('version_m 經 decompose 後仍為 1', inst.version_m === 1);
  STORE.saveInstances(Object.assign(STORE.loadInstances(), { 'cHero@w_dm1': inst }));

  // 隨後 DM 推 onSave（version_m 遞增到 2）→ 玩家端正確採用、不誤判衝突
  const save = mkSave({ hp:{current:9,max:20,temp:0} }, 2, 1);
  fns.handleRemoteSave(save);
  ok('DM save 被正確採用（hp=9）', char.hp.current === 9);
  ok('未誤判衝突', room.showConflict === false);
}

// ============================================================
console.log('\n[對照] 玩家自編輯確實 bump version_m（讓「領先→轉提案」偵測有意義）');
{
  _mem_clear();
  const char = mkChar();
  STORE.writeInstanceFromChar(char, 'w_dm1', { version_m: 1, version_n: 1 });
  let inst = STORE.loadInstances()['cHero@w_dm1'];
  // 玩家主動改機制（未先落帳）→ decomposeC 應偵測差異並 bump
  char.hp.current = 18;
  const ident = { characterId: char.id, identity: STORE.pickIdentityFields(char), version_n: inst.version_n };
  const changed = STORE.decomposeC(char, ident, inst);
  ok('玩家自編輯 decomposeC 偵測到差異', changed === true);
  ok('玩家自編輯 bump version_m → 2', inst.version_m === 2);
}

// ============================================================
console.log('\n[xp] give-xp 指令真正累加並寫事件流');
{
  _mem_clear();
  const char = mkChar();
  STORE.writeInstanceFromChar(char, 'w_dm1', { version_m: 1, version_n: 1 });
  const { room, fns } = makeHarness(char);
  fns.applyCommand({ type:'xp', amount:250, _key:'x1', ts:1 });
  fns.applyCommand({ type:'xp', amount:100, _key:'x2', ts:2 });
  ok('char.xp 累加 = 350', char.xp === 350);
  ok('xp 寫入事件流', room.messages.filter(m=>/XP/.test(m.text)).length === 2);
  const inst = STORE.loadInstances()['cHero@w_dm1'];
  ok('xp 落帳到 instance.mechanical', inst.mechanical.xp === 350);
}

// ============================================================
console.log('\n[去重] 指令去重持久化（模擬重連不重算）');
{
  _mem_clear();
  const char = mkChar();
  STORE.writeInstanceFromChar(char, 'w_dm1', { version_m: 1, version_n: 1 });
  // 第一次連線
  let h = makeHarness(char);
  h.room.appliedCommands = h.fns.loadAppliedCommands();
  const onCmd = (cmd) => {
    if (h.room.appliedCommands.has(cmd._key)) return false;
    h.room.appliedCommands.add(cmd._key);
    h.fns.persistAppliedCommands();
    h.fns.applyCommand(cmd);
    return true;
  };
  ok('首次套用 k1', onCmd({ type:'gold', amount:5, _key:'k1', ts:1 }) === true);
  ok('重放 k1 被去重', onCmd({ type:'gold', amount:5, _key:'k1', ts:1 }) === false);

  // 模擬「重連」：新的 harness（記憶體 Set 清空），但 localStorage 仍在
  let h2 = makeHarness(char);
  h2.room.appliedCommands = h2.fns.loadAppliedCommands();
  ok('重連後從 localStorage 載回已套用集合', h2.room.appliedCommands.has('k1'));
  const onCmd2 = (cmd) => {
    if (h2.room.appliedCommands.has(cmd._key)) return false;
    h2.room.appliedCommands.add(cmd._key);
    h2.fns.persistAppliedCommands();
    h2.fns.applyCommand(cmd);
    return true;
  };
  ok('重連後重放歷史 k1 不重算', onCmd2({ type:'gold', amount:5, _key:'k1', ts:1 }) === false);
}

console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
process.exit(fail ? 1 : 0);

function _mem_clear(){ for (const k in _mem) delete _mem[k]; }
