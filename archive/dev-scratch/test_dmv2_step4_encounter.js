/* test_dmv2_step4_encounter.js
 * Step 4.0 遭遇 (Encounter) 模組：
 *  - 新實體型別 encounter：三軸定位 questId/locationId/eraId + monsters[{name,count,notes}]
 *  - 走現有 entity 管線存 world.entities（dmv2: 隔離）
 *  - 三軸篩選 encounterFilter → currentEntities 收斂
 *  - encounterMonsters 攤平清單（供 4.4 模板 {monsterName} 用）
 *  - 名稱解析 entityNameById / eraNameById
 *  - persist round-trip（dmv2: 前綴、重載後仍在）+ 編輯 round-trip
 * shared/* 由 resources:'usable' 真實載入。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('worldbuilder-v2/index.html', 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713', name); } else { fail++; console.log('  \u2717', name); } }

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

/* 用 CRUD 管線新增一筆一般 entity，回傳其 id */
async function addEntity(vm, type, name, extra) {
  vm.openAddEntity(type);
  Object.assign(vm.editingEntity, { name: name }, extra || {});
  vm.saveEntity();
  await tick(vm);
  const list = vm.worldEntities.filter((e) => e.type === type);
  const rec = list.find((e) => e.name === name);
  return rec ? rec.id : '';
}

(async () => {
  const store = {};
  const { vm, jsErrors } = await boot(store);
  ok('Vue 掛載成功且無 JS 錯誤', !!vm && jsErrors.length === 0);
  if (jsErrors.length) console.log('    errors:', jsErrors.slice(0, 5));

  /* 世界 */
  vm.newWorldName = '遭遇測試世界'; vm.newWorldNote = 'Step 4.0'; vm.addWorld();
  await tick(vm);
  ok('世界建立且 active', !!vm.activeWorld && vm.activeWorldName === '遭遇測試世界');

  vm.goTab('worldset'); await tick(vm);

  /* ENTITY_TYPES / 模組含 encounter */
  ok('worldsetModules 含遭遇分頁', vm.worldsetModules.some((m) => m.key === 'encounter'));

  /* 先建三軸素材：任務 / 地點 / 兩個紀元 */
  const questId = await addEntity(vm, 'quest', '討伐哥布林');
  const locId = await addEntity(vm, 'location', '破敗神殿');
  ok('任務/地點已建立', !!questId && !!locId);

  vm.newEraName = '和平紀元'; vm.addEra(); await tick(vm);
  vm.newEraName = '墮落紀元'; vm.addEra(); await tick(vm);
  const eraPeace = vm.worldEras.find((e) => e.name === '和平紀元');
  const eraFall = vm.worldEras.find((e) => e.name === '墮落紀元');
  ok('兩個紀元已建立', !!eraPeace && !!eraFall);

  /* ---- 新增遭遇（三軸 + 怪物子清單）---- */
  vm.openModule({ key: 'encounter' }); await tick(vm);
  ok('切到遭遇分頁 (worldsetView=encounter)', vm.worldsetView === 'encounter');

  vm.openAddEntity('encounter');
  ok('新表單帶 encounter 三軸空值 + monsters 陣列',
    vm.editingEntity.type === 'encounter' && vm.editingEntity.questId === '' && Array.isArray(vm.editingEntity.monsters));
  vm.editingEntity.name = '哥布林突襲';
  vm.editingEntity.questId = questId;
  vm.editingEntity.locationId = locId;
  vm.editingEntity.eraId = eraFall.id;
  vm.addMonsterRow(); vm.addMonsterRow();
  vm.editingEntity.monsters[0] = { name: '哥布林', count: 4, notes: '弓兵' };
  vm.editingEntity.monsters[1] = { name: '哥布林頭目', count: 1, notes: '' };
  vm.addMonsterRow();  /* 空白列，應在存檔時被濾掉 */
  vm.saveEntity();
  await tick(vm);

  const enc = vm.worldEntities.find((e) => e.type === 'encounter' && e.name === '哥布林突襲');
  ok('遭遇已存入 world.entities', !!enc);
  ok('三軸正確落地', enc && enc.questId === questId && enc.locationId === locId && enc.eraId === eraFall.id);
  ok('怪物子清單存 2 筆（空白列被濾掉）', enc && enc.monsters.length === 2);
  ok('怪物欄位 name/count/notes 正確', enc && enc.monsters[0].name === '哥布林' && enc.monsters[0].count === 4 && enc.monsters[0].notes === '弓兵');

  /* 名稱解析 */
  ok('entityNameById 解析任務名', vm.entityNameById(questId) === '討伐哥布林');
  ok('eraNameById 解析紀元名', vm.eraNameById(eraFall.id) === '墮落紀元');

  /* 再加一筆：同任務同地點、但在「和平紀元」→ 驗證平行線 + 篩選 */
  vm.openAddEntity('encounter');
  vm.editingEntity.name = '寧靜神殿';
  vm.editingEntity.questId = questId;
  vm.editingEntity.locationId = locId;
  vm.editingEntity.eraId = eraPeace.id;
  vm.saveEntity();
  await tick(vm);
  ok('遭遇共 2 筆', vm.worldEntities.filter((e) => e.type === 'encounter').length === 2);

  /* 三軸篩選 */
  vm.encounterFilter.eraId = eraFall.id; await tick(vm);
  ok('依墮落紀元篩選 → 只剩哥布林突襲', vm.currentEntities.length === 1 && vm.currentEntities[0].name === '哥布林突襲');
  vm.encounterFilter.eraId = eraPeace.id; await tick(vm);
  ok('依和平紀元篩選 → 只剩寧靜神殿', vm.currentEntities.length === 1 && vm.currentEntities[0].name === '寧靜神殿');
  vm.encounterFilter.eraId = ''; vm.encounterFilter.questId = questId; await tick(vm);
  ok('依任務篩選 → 兩筆都在（同任務不同紀元）', vm.currentEntities.length === 2);
  vm.encounterFilter.questId = ''; await tick(vm);

  /* encounterMonsters 攤平（供模板 {monsterName}）*/
  const flat = vm.encounterMonsters;
  ok('encounterMonsters 攤平出哥布林+頭目', flat.some((m) => m.name === '哥布林') && flat.some((m) => m.name === '哥布林頭目'));
  ok('攤平項帶 encounterName 溯源', flat.find((m) => m.name === '哥布林').encounterName === '哥布林突襲');

  /* 編輯 round-trip：改怪物數量 */
  vm.openEditEntity(enc);
  ok('編輯載入怪物副本', vm.editingEntity.monsters.length === 2 && vm.editingEntity.monsters[0].name === '哥布林');
  vm.editingEntity.monsters[0].count = 6;
  vm.saveEntity();
  await tick(vm);
  const enc2 = vm.worldEntities.find((e) => e.id === enc.id);
  ok('編輯後怪物數量更新為 6', enc2 && enc2.monsters[0].count === 6);

  /* dmv2: 隔離 + persist */
  ok('遭遇落 dmv2: 命名空間', /encounter/.test(store['dmv2:dnd_worlds_v2'] || ''));
  ok('未污染玩家版 key', !('dnd_worlds_v2' in store));

  /* 重載 round-trip */
  const { vm: vm2, jsErrors: e2 } = await boot(store);
  ok('重載無 JS 錯誤', e2.length === 0);
  vm2.goTab('worldset'); vm2.openModule({ key: 'encounter' }); await tick(vm2);
  const encR = vm2.worldEntities.find((e) => e.type === 'encounter' && e.name === '哥布林突襲');
  ok('重載後遭遇仍在且怪物數=6', !!encR && encR.monsters[0].count === 6);
  ok('重載後三軸仍在', encR && encR.questId === questId && encR.eraId === eraFall.id);

  console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('測試異常', e); process.exit(1); });
