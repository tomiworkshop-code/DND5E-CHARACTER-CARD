// TC-04 單測：驗證 shared/services/backup.js 的 version-aware merge 邏輯
//   - parseBackupPayload → extractCollections 後不報錯
//   - detectConflicts 找出版本差異角色
//   - mergeBackup 依版本合併，且尊重 resolutions（overwrite / keep）
//   - 單角色匯入不覆蓋全域（其他角色保留）
const vm = require('vm');
const fs = require('fs');

// 建一個共用 sandbox，載入 schema + store + backup（皆為 IIFE 掛到 global）
const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
function load(file){
  const code = fs.readFileSync(file, 'utf8');
  // 這些模組用 (typeof window !== "undefined" ? window : this) 決定 global；
  // 在 vm 裡把 window 當 global，直接執行使其掛到 sandbox.window
  vm.runInContext(code, sandbox, { filename: file });
}
// backup.js 依賴 window.DND5E_CHAR / window.DND5E_STORE
// 讓 IIFE 的 global 解析成 sandbox.window：包一層 with
function loadAsWindow(file){
  const code = fs.readFileSync(file, 'utf8');
  vm.runInContext('(function(){ var self=window; ' + code + '\n}).call(window);', sandbox, { filename: file });
}
loadAsWindow('shared/character-schema.js');
loadAsWindow('shared/store.js');
loadAsWindow('shared/services/backup.js');

const BK = sandbox.window.DND5E_BACKUP;
const CHAR = sandbox.window.DND5E_CHAR;
if (!BK) { console.error('❌ DND5E_BACKUP 未掛載'); process.exit(1); }
if (!CHAR || typeof CHAR.mergeInstance !== 'function') { console.error('❌ DND5E_CHAR.mergeInstance 缺失'); process.exit(1); }

let pass = 0, fail = 0;
function ok(name, cond){ if(cond){ pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } }

// ---- 建立測試資料 ----
function mkInstance(cid, wid, vm_, vn_, hpCur, notes){
  return {
    instanceId: cid + '@' + wid, characterId: cid, worldId: wid,
    mechanical: { hp: { current: hpCur, max: 20, temp: 0 }, ac: 12, inventory: [] },
    narrative: { notes: notes || '', familiar: null },
    version_m: vm_, version_n: vn_, updatedAt: 1000,
    worldProgress: {}
  };
}
function mkIdentity(cid, name, vn_){
  return { characterId: cid, identity: { name: name, race: '人類', story: {} }, version_n: vn_ };
}

const local = {
  identities: [ mkIdentity('cA', '阿爾法', 2), mkIdentity('cB', '貝塔', 1) ],
  instances: {
    'cA@w1': mkInstance('cA', 'w1', 3, 2, 10, '本機筆記A'),
    'cB@w1': mkInstance('cB', 'w1', 1, 1, 5, '本機筆記B')
  },
  worlds: [ { id: 'w1', name: '本地世界' } ],
  activeWorld: 'w1'
};

// 匯入檔：cA 機制版本較高（DM 進度更新）、cB 相同、cC 全新角色
const importedRaw = {
  __type: 'dnd5e_character_card_backup', __version: 2,
  data: {
    dnd_identities_v2: JSON.stringify([ mkIdentity('cA', '阿爾法-改', 3), mkIdentity('cC', '伽瑪', 1) ]),
    dnd_instances_v2: JSON.stringify({
      'cA@w1': mkInstance('cA', 'w1', 5, 1, 99, '備份筆記A'),   // version_m 5 > 3 → 機制被覆蓋
      'cC@w1': mkInstance('cC', 'w1', 1, 1, 7, '新角色C')
    }),
    dnd_worlds_v2: JSON.stringify([ { id: 'w1', name: '備份世界(不應覆蓋)' }, { id: 'w2', name: '新世界' } ]),
    dnd_active_world_v2: 'w2'
  }
};

console.log('[Test 1] parseBackupPayload + extractCollections 不報錯');
const d = BK.parseBackupPayload(JSON.stringify(importedRaw));
const imported = BK.extractCollections(d);
ok('imported.identities 為陣列且含 cC', Array.isArray(imported.identities) && imported.identities.some(i=>i.characterId==='cC'));
ok('imported.instances 含 cA@w1', !!imported.instances['cA@w1']);

console.log('[Test 2] detectConflicts 找到 cA（版本差異）而非 cB');
const conflicts = BK.detectConflicts(local, imported);
const conflictIds = conflicts.map(c=>c.characterId);
ok('偵測到 cA 衝突', conflictIds.includes('cA'));
ok('未把相同版本的 cB 當衝突', !conflictIds.includes('cB'));
ok('未把全新角色 cC 當衝突', !conflictIds.includes('cC'));

console.log('[Test 3] mergeBackup 預設（版本感知）— cA 機制被較高版本覆蓋');
const merged = BK.mergeBackup(local, imported, { resolutions: {} });
ok('cA 機制 hp.current 變 99（DM 版本 5 >= 3）', merged.instances['cA@w1'].mechanical.hp.current === 99);
ok('cA version_m = 5', merged.instances['cA@w1'].version_m === 5);
ok('cB 保留本機（未被動）hp.current=5', merged.instances['cB@w1'].mechanical.hp.current === 5);
ok('新角色 cC 被加入 instances', !!merged.instances['cC@w1']);
ok('新角色 cC identity 被加入', merged.identities.some(i=>i.characterId==='cC'));
ok('本機 cB identity 仍在', merged.identities.some(i=>i.characterId==='cB'));
ok('worlds 保留本機 w1 定義（不被備份覆蓋）', merged.worlds.find(w=>w.id==='w1').name === '本地世界');
ok('worlds 新增 w2', !!merged.worlds.find(w=>w.id==='w2'));
ok('activeWorld 保留本機 w1', merged.activeWorld === 'w1');

console.log('[Test 4] resolutions=keep 時保留本機（不合併覆蓋 cA）');
const mergedKeep = BK.mergeBackup(local, imported, { resolutions: { cA: 'keep' } });
ok('cA 保留本機 hp.current=10', mergedKeep.instances['cA@w1'].mechanical.hp.current === 10);
ok('cA identity 保留本機名「阿爾法」', mergedKeep.identities.find(i=>i.characterId==='cA').identity.name === '阿爾法');

console.log('[Test 5] resolutions=overwrite 時整組用備份覆蓋 cA');
const mergedOw = BK.mergeBackup(local, imported, { resolutions: { cA: 'overwrite' } });
ok('cA identity 名變「阿爾法-改」', mergedOw.identities.find(i=>i.characterId==='cA').identity.name === '阿爾法-改');
ok('cA 機制 hp.current=99', mergedOw.instances['cA@w1'].mechanical.hp.current === 99);

console.log('[Test 6] 單角色匯入 onlyCharacterId=cC → 不動其他角色');
const mergedOne = BK.mergeBackup(local, imported, { onlyCharacterId: 'cC' });
ok('僅新增 cC', !!mergedOne.instances['cC@w1']);
ok('cA 機制未被更動（仍為本機 10）', mergedOne.instances['cA@w1'].mechanical.hp.current === 10);
ok('cA identity 未被覆蓋（仍「阿爾法」）', mergedOne.identities.find(i=>i.characterId==='cA').identity.name === '阿爾法');

console.log('[Test 7] mergeStoredInstance 直接呼叫不報錯，且委派 mergeInstance');
const r = BK.mergeStoredInstance(local.instances['cA@w1'], imported.instances['cA@w1']);
ok('回傳含 instance', !!r.instance);
ok('mechChanged=true（rm 5 >= lm 3）', r.mechChanged === true);

console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
process.exit(fail ? 1 : 0);
