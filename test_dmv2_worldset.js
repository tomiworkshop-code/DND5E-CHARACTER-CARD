/* test_dmv2_worldset.js
 * 敘事者之書 DM v2 — Step 2b 世界設定驗證（線性版）：
 *  §10 entity CRUD（五型：npc/location/quest/clue/event；status + story）
 *  §10.6 紀元節點管理（線性）：新增(parentId=currentEra)/設為當前/順序/刪除、currentEraId
 *  世界規則開關 allowPactFamiliar（預設 false）toggle
 *  §6 資料只落 dmv2: 前綴、未污染無前綴 key；重載後資料仍在（persist round-trip）
 *  持久化選擇：直接擴充 world 物件（upsertWorld 以 Object.assign 合併、saveWorlds
 *              整份序列化，自訂欄位 entities/eras/rules 原樣 round-trip）。
 * shared/* 由 resources:'usable' 真實載入。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('worldbuilder-v2/index.html', 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713', name); } else { fail++; console.log('  \u2717', name); } }

/* 以共享 store 物件開機一個 DM v2 實例，等 Vue 掛載完成後回傳 {dom, vm, jsErrors}。 */
function boot(sharedStore) {
  return new Promise((resolve, reject) => {
    const jsErrors = [];
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      resources: 'usable',
      url: 'file://' + __dirname + '/worldbuilder-v2/index.html',
      beforeParse(window) {
        Object.defineProperty(window, 'localStorage', { configurable: true, value: {
          getItem: (k) => (k in sharedStore ? sharedStore[k] : null),
          setItem: (k, v) => { sharedStore[k] = String(v); },
          removeItem: (k) => { delete sharedStore[k]; },
          clear: () => Object.keys(sharedStore).forEach((k) => delete sharedStore[k])
        }});
        window.addEventListener('error', (e) => { jsErrors.push(String(e.message || e.error)); });
        window.console.error = function () { jsErrors.push(Array.from(arguments).map(String).join(' ')); };
      }
    });
    const t0 = Date.now();
    (function wait() {
      if (dom.window.__vm) return resolve({ dom, vm: dom.window.__vm, jsErrors });
      if (Date.now() - t0 > 6000) return reject(new Error('vm 未就緒；errors: ' + jsErrors.join(' | ')));
      setTimeout(wait, 50);
    })();
  });
}

function tick(vm) { return new Promise((r) => vm.$nextTick(() => setTimeout(r, 20))); }

(async () => {
  const store = {};
  const { vm, jsErrors } = await boot(store);
  ok('Vue 掛載成功且無 JS 錯誤', !!vm && jsErrors.length === 0);
  if (jsErrors.length) console.log('    errors:', jsErrors.slice(0, 5));

  /* ---- 建立測試世界 ---- */
  vm.newWorldName = '測試世界';
  vm.newWorldNote = 'Step 2b';
  vm.addWorld();
  await tick(vm);
  const w = vm.worlds.find((x) => x.name === '測試世界');
  ok('世界建立且成為 active', !!w && vm.activeWorldId === w.id);

  vm.goTab('worldset');
  await tick(vm);
  ok('goTab worldset 回到模組格 (worldsetView 空)', vm.worldsetView === '');

  /* ============================================================
     1) 五型 entity 新增 + status + story + 專屬欄位
     ============================================================ */
  const types = ['npc', 'location', 'quest', 'clue', 'event'];
  for (const t of types) {
    vm.openModule({ key: t === 'location' ? 'place' : t });
    await tick(vm);
    ok('進入模組：' + t, vm.worldsetView === t);

    vm.openAddEntity(t);
    await tick(vm);
    ok(t + ' 開啟新增表單', vm.showEntityForm === true && !!vm.editingEntity && vm.editingEntity.type === t);

    vm.editingEntity.name = t + '-甲';
    vm.editingEntity.status = 'changed';
    vm.editingEntity.story = t + ' 的經歷故事';
    vm.editingEntity.notes = t + ' 備註';
    if (t === 'quest') { vm.editingEntity.objective = '尋回聖劍'; vm.editingEntity.reward = '500gp'; vm.editingEntity.state = '已完成'; }
    if (t === 'location') { vm.editingEntity.region = '北方山脈'; vm.editingEntity.placeKind = 'shop'; }
    if (t === 'event') { vm.editingEntity.trigger = '午夜鐘響'; }
    vm.saveEntity();
    await tick(vm);

    const ents = vm.currentEntities;
    ok(t + ' 新增成功（列表 1 筆）', ents.length === 1 && ents[0].name === t + '-甲');
    ok(t + ' status 正確存取（changed）', ents[0].status === 'changed');
    ok(t + ' story 正確存取', ents[0].story === t + ' 的經歷故事');
    ok(t + ' 表單關閉', vm.showEntityForm === false);
    if (t === 'quest') ok('quest 專屬欄位 objective/reward/state', ents[0].objective === '尋回聖劍' && ents[0].reward === '500gp' && ents[0].state === '已完成');
    if (t === 'location') ok('location 專屬欄位 region', ents[0].region === '北方山脈');
    if (t === 'location') ok('location 種類 placeKind 存取(shop)', ents[0].placeKind === 'shop');
    if (t === 'event') ok('event 專屬欄位 trigger', ents[0].trigger === '午夜鐘響');

    vm.closeWorldsetView();
    await tick(vm);
  }

  /* ============================================================
     2) 編輯（npc）與刪除（clue）
     ============================================================ */
  vm.openModule({ key: 'npc' });
  await tick(vm);
  vm.openEditEntity(vm.currentEntities[0]);
  await tick(vm);
  ok('編輯載入既有值', vm.editingEntity.id === vm.currentEntities[0].id && vm.editingEntity.name === 'npc-甲');
  vm.editingEntity.name = 'NPC-改';
  vm.editingEntity.status = 'destroyed';
  vm.editingEntity.story = '改後的故事';
  vm.saveEntity();
  await tick(vm);
  ok('編輯後名稱更新', vm.currentEntities[0].name === 'NPC-改');
  ok('編輯後 status 更新（destroyed）', vm.currentEntities[0].status === 'destroyed');
  ok('編輯後 story 更新', vm.currentEntities[0].story === '改後的故事');
  ok('編輯未產生重複（仍 1 筆）', vm.currentEntities.length === 1);
  vm.closeWorldsetView();
  await tick(vm);

  /* location placeKind 編輯 round-trip */
  vm.openModule({ key: 'place' });
  await tick(vm);
  vm.openEditEntity(vm.currentEntities[0]);
  await tick(vm);
  ok('編輯載入 placeKind(shop)', vm.editingEntity.placeKind === 'shop');
  vm.editingEntity.placeKind = 'temple';
  vm.saveEntity();
  await tick(vm);
  ok('編輯後 placeKind 更新(temple)', vm.currentEntities[0].placeKind === 'temple');
  vm.closeWorldsetView();
  await tick(vm);

  vm.openModule({ key: 'clue' });
  await tick(vm);
  ok('刪除前線索 1 筆', vm.currentEntities.length === 1);
  vm.deleteEntity(vm.currentEntities[0]);
  await tick(vm);
  ok('線索刪除成功（0 筆）', vm.currentEntities.length === 0);
  vm.closeWorldsetView();
  await tick(vm);

  /* ============================================================
     3) §6 隔離：資料只落 dmv2: 前綴、未污染無前綴 key
     ============================================================ */
  const keys = Object.keys(store);
  ok('世界資料落在 dmv2:dnd_worlds_v2', 'dmv2:dnd_worlds_v2' in store);
  ok('未污染無前綴 dnd_worlds_v2', !('dnd_worlds_v2' in store));
  ok('所有落地 key 均為 dmv2: 前綴', keys.length > 0 && keys.every((k) => k.indexOf('dmv2:') === 0));

  const storedWorlds = JSON.parse(store['dmv2:dnd_worlds_v2']);
  const sw = storedWorlds.find((x) => x.id === w.id);
  ok('entities 持久化於 world 物件（5 建 -1 刪 = 4）', !!sw && Array.isArray(sw.entities) && sw.entities.length === 4);

  /* ============================================================
     4) 紀元節點（線性）
     ============================================================ */
  vm.goTab('worldset');
  await tick(vm);
  ok('初始無紀元節點', vm.worldEras.length === 0);

  vm.newEraName = '第一紀元';
  vm.newEraSummary = '創世';
  vm.addEra();
  await tick(vm);
  ok('新增第一紀元', vm.worldEras.length === 1);
  const era1 = vm.worldEras[0];
  ok('第一紀元 parentId=null（根）', era1.parentId === null);
  ok('第一紀元自動成為 currentEra', vm.currentEraId === era1.id);
  ok('第一紀元 canon=true', era1.canon === true);

  vm.newEraName = '第二紀元';
  vm.addEra();
  await tick(vm);
  ok('新增第二紀元', vm.worldEras.length === 2);
  const era2 = vm.worldEras[1];
  ok('第二紀元 parentId = 前一 currentEra（線性）', era2.parentId === era1.id);
  ok('第二紀元自動成為 currentEra', vm.currentEraId === era2.id);
  ok('order 遞增', (vm.worldEras[0].order || 0) < (vm.worldEras[1].order || 0));

  /* 順序調整：era2 上移 */
  vm.moveEra(era2, -1);
  await tick(vm);
  ok('順序調整後 era2 排到最前', vm.worldEras[0].id === era2.id);

  /* 設為當前：切回 era1 */
  vm.setCurrentEra(era1);
  await tick(vm);
  ok('設為當前 → currentEraId = era1', vm.currentEraId === era1.id);

  /* 刪除 era2（葉節點，無子） */
  vm.deleteEra(era2);
  await tick(vm);
  ok('刪除紀元後剩 1', vm.worldEras.length === 1 && vm.worldEras[0].id === era1.id);
  ok('刪除後 currentEraId 仍有效', vm.currentEraId === era1.id);

  /* ============================================================
     5) 世界規則 allowPactFamiliar toggle（預設 false）
     ============================================================ */
  ok('allowPactFamiliar 預設 false', vm.worldRules.allowPactFamiliar === false);
  vm.toggleRule('allowPactFamiliar');
  await tick(vm);
  ok('toggle 後 allowPactFamiliar = true', vm.worldRules.allowPactFamiliar === true);
  vm.toggleRule('allowPactFamiliar');
  await tick(vm);
  ok('再 toggle 回 false', vm.worldRules.allowPactFamiliar === false);
  /* 留 true 供重載驗證 */
  vm.toggleRule('allowPactFamiliar');
  await tick(vm);

  /* ============================================================
     6) 持久化 round-trip：以同一 store 重載新實例
     ============================================================ */
  const { vm: vm2 } = await boot(store);
  const w2 = vm2.worlds.find((x) => x.id === w.id);
  ok('重載後世界仍在', !!w2);
  vm2.switchWorld(w2);
  await tick(vm2);
  vm2.goTab('worldset');
  await tick(vm2);
  ok('重載後 entities 仍在（4 筆）', vm2.worldEntities.length === 4);
  const npc2 = vm2.worldEntities.find((e) => e.type === 'npc');
  ok('重載後 npc 編輯內容仍在', !!npc2 && npc2.name === 'NPC-改' && npc2.status === 'destroyed');
  const quest2 = vm2.worldEntities.find((e) => e.type === 'quest');
  ok('重載後 quest 專屬欄位仍在', !!quest2 && quest2.objective === '尋回聖劍' && quest2.state === '已完成');
  ok('重載後 era 仍在（1 節點）', vm2.worldEras.length === 1 && vm2.worldEras[0].id === era1.id);
  ok('重載後 currentEraId 仍在', vm2.currentEraId === era1.id);
  ok('重載後 rules 仍在（allowPactFamiliar=true）', vm2.worldRules.allowPactFamiliar === true);

  /* 重載後 store 仍只有 dmv2: 前綴 */
  ok('重載後仍未污染無前綴 key', Object.keys(store).every((k) => k.indexOf('dmv2:') === 0));

  console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
