/* test_dmv2_isolation.js
 * 敘事者之書 DM v2（Step 1.5 資料隔離）單測：
 *  §6 前綴命名空間隔離 + 世界來源 role 標記。
 *
 * 驗證重點：
 *  - DM v2 注入「加前綴 (dmv2:) 」storage adapter 後，store.js 的所有 localStorage
 *    讀寫都落在 dmv2: 前綴 key（如 dmv2:dnd_worlds_v2）。
 *  - 絕不污染無前綴 key（玩家版 v2/ 用的 dnd_worlds_v2 等維持乾淨）。
 *  - upsertWorld 附加的 role:'dm_owner' 欄位可持久化且不破壞既有 type 欄位。
 *  - 玩家版（無前綴 adapter）與 DM 版（前綴 adapter）互不可見（雙 store 隔離冒煙）。
 *
 * 以 store.js 的 setStorage 注入記憶體 adapter 模擬瀏覽器 localStorage。
 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
function loadAsWindow(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext('(function(){ var self=window; ' + code + '\n}).call(window);', sandbox, { filename: file });
}
loadAsWindow('shared/character-schema.js');
loadAsWindow('shared/store.js');
const S = sandbox.window.DND5E_STORE;
if (!S || typeof S.setStorage !== 'function' || typeof S.upsertWorld !== 'function') {
  console.error('❌ DND5E_STORE 未掛載或缺少 setStorage/upsertWorld');
  process.exit(1);
}

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } }

/* 記憶體 storage（底層真實 backing store，可檢查落地 key 名稱） */
function memStorage() {
  const m = {};
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; },
    _m: m
  };
}

/* 比照 worldbuilder-v2/app.js 的 makePrefixedStorage：包裝底層 storage、所有 key 加前綴 */
function makePrefixedStorage(prefix, backing) {
  return {
    getItem: (k) => backing.getItem(prefix + k),
    setItem: (k, v) => backing.setItem(prefix + k, v),
    removeItem: (k) => backing.removeItem(prefix + k)
  };
}

/* ============================================================
   案例 1：DM v2 前綴 adapter → 寫入只落在 dmv2: 前綴 key
   ============================================================ */
const backing = memStorage();
S.setStorage(makePrefixedStorage('dmv2:', backing));

S.upsertWorld({ id: 'w_dm_a', name: '破碎群島', note: 'DM 自建', type: 'dm', role: 'dm_owner' });
S.setActiveWorld('w_dm_a');

const keys = Object.keys(backing._m);
ok('底層至少寫入了 1 個 key', keys.length >= 1);
ok('所有落地 key 皆含 dmv2: 前綴', keys.every((k) => k.indexOf('dmv2:') === 0));
ok('世界 key 為 dmv2:dnd_worlds_v2', 'dmv2:dnd_worlds_v2' in backing._m);
ok('active world key 為 dmv2:dnd_active_world_v2', 'dmv2:dnd_active_world_v2' in backing._m);
ok('未污染無前綴 dnd_worlds_v2', !('dnd_worlds_v2' in backing._m));
ok('未污染無前綴 dnd_active_world_v2', !('dnd_active_world_v2' in backing._m));

/* role 標記可持久化且不破壞 type */
const dmWorlds = S.loadWorlds();
const created = Array.isArray(dmWorlds) && dmWorlds.find((w) => w.id === 'w_dm_a');
ok('世界可讀回', !!created);
ok('role 標記為 dm_owner', !!created && created.role === 'dm_owner');
ok('既有 type 欄位維持 dm（未被破壞）', !!created && created.type === 'dm');

/* ============================================================
   案例 2：玩家版（無前綴）與 DM 版（前綴）雙 store 互不可見
   ============================================================ */
const playerBacking = memStorage();
S.setStorage(playerBacking); /* 玩家版：直接用無前綴 storage */
S.upsertWorld({ id: 'w_guest_1', name: '朋友的野團', type: 'dm', role: 'guest' });

ok('玩家版寫入落在無前綴 dnd_worlds_v2', 'dnd_worlds_v2' in playerBacking._m);
ok('玩家版寫入未落在 dmv2: 前綴', !Object.keys(playerBacking._m).some((k) => k.indexOf('dmv2:') === 0));

/* 切回 DM 前綴 store：看不到玩家版剛寫的 guest 世界 */
S.setStorage(makePrefixedStorage('dmv2:', backing));
const dmWorlds2 = S.loadWorlds() || [];
ok('DM 版看不到玩家版 guest 世界', !dmWorlds2.some((w) => w.id === 'w_guest_1'));
ok('DM 版仍看得到自己的 dm_owner 世界', dmWorlds2.some((w) => w.id === 'w_dm_a'));

/* 切到玩家版：看不到 DM 版的世界（底層 backing 不同） */
S.setStorage(playerBacking);
const playerWorlds = S.loadWorlds() || [];
ok('玩家版看不到 DM 版 dm_owner 世界', !playerWorlds.some((w) => w.id === 'w_dm_a'));

/* ============================================================
   案例 3：removeItem 也走前綴（雙保險：確保 setStorage 對 removeItem 生效）
   ============================================================ */
const backing3 = memStorage();
S.setStorage(makePrefixedStorage('dmv2:', backing3));
S.upsertWorld({ id: 'w_tmp', name: '暫存世界', type: 'dm', role: 'dm_owner' });
S.getStorage().removeItem('dnd_worlds_v2');
ok('removeItem 透過前綴移除 dmv2:dnd_worlds_v2', !('dmv2:dnd_worlds_v2' in backing3._m));

console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
process.exit(fail ? 1 : 0);
