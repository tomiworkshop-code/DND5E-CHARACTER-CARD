// TC-04.5 單測：store.js deleteInstance / deleteIdentity
//  - deleteInstance 只刪目標 instance/worldProgress，其他 instance/角色不受影響
//  - deleteIdentity 連帶清該角色所有 instances
//  - 刪除後 active 指標正確 fallback、不留空指標
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
function loadAsWindow(file){
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext('(function(){ var self=window; ' + code + '\n}).call(window);', sandbox, { filename: file });
}
loadAsWindow('shared/character-schema.js');
loadAsWindow('shared/store.js');
const S = sandbox.window.DND5E_STORE;
if(!S || typeof S.deleteInstance!=='function' || typeof S.deleteIdentity!=='function'){
  console.error('❌ deleteInstance/deleteIdentity 未掛載'); process.exit(1);
}

// 記憶體 storage adapter
function memStorage(){
  const m = {};
  return { getItem:k=> (k in m? m[k]: null), setItem:(k,v)=>{m[k]=String(v);}, removeItem:k=>{delete m[k];}, _m:m };
}

let pass=0, fail=0;
function ok(name, cond){ if(cond){pass++;console.log('  ✓',name);} else {fail++;console.log('  ✗',name);} }

// ---- 建立測試場景 ----
// 3 角色：cA, cB, cC。世界：__solo__, w_local_default, w_dm1(DM), w_local2
// per-world 進度存在各角色 default-instance 的 worldProgress
function seed(){
  const st = memStorage();
  S.setStorage(st);
  const identities = [
    { characterId:'cA', identity:{name:'Aragorn'}, version_n:1 },
    { characterId:'cB', identity:{name:'Boromir'}, version_n:1 },
    { characterId:'cC', identity:{name:'Celeborn'}, version_n:1 },
  ];
  function inst(cid, wp){
    const iid = cid+'@w_local_default';
    return { instanceId:iid, characterId:cid, worldId:'w_local_default',
      mechanical:{hp:{current:10}}, narrative:{notes:''}, version_m:1, version_n:1, updatedAt:1,
      worldProgress: wp };
  }
  const instances = {
    'cA@w_local_default': inst('cA', { '__solo__':{location:'A-solo'}, 'w_dm1':{location:'A-dm1'}, 'w_local2':{location:'A-loc2'} }),
    'cB@w_local_default': inst('cB', { '__solo__':{location:'B-solo'}, 'w_dm1':{location:'B-dm1'} }),
    'cC@w_local_default': inst('cC', { '__solo__':{location:'C-solo'} }),
    // 一個未來風格的真 per-world instance（驗證也會被 deleteInstance 移除）
    'cA@w_dm1': { instanceId:'cA@w_dm1', characterId:'cA', worldId:'w_dm1', mechanical:{}, narrative:{}, version_m:1, version_n:1, updatedAt:1, worldProgress:{} },
  };
  S.saveIdentities(identities);
  S.saveInstances(instances);
  S.setActiveCharId('cA');
  S.setActiveWorld('w_dm1');
  S.setActiveInstance('cA@w_dm1');
  return st;
}

// ===== Test 1: deleteInstance 只刪 cA 在 w_dm1 的紀錄 =====
seed();
const r1 = S.deleteInstance('cA@w_dm1');
let inst = S.loadInstances();
ok('deleteInstance 回報 removed=true', r1.removed === true);
ok('cA@w_dm1 真 instance 已移除', !inst['cA@w_dm1']);
ok('cA 的 worldProgress.w_dm1 已移除', !(inst['cA@w_local_default'].worldProgress.hasOwnProperty('w_dm1')));
ok('cA 的 worldProgress.__solo__ 保留', inst['cA@w_local_default'].worldProgress['__solo__'].location==='A-solo');
ok('cA 的 worldProgress.w_local2 保留', inst['cA@w_local_default'].worldProgress['w_local2'].location==='A-loc2');
// 關鍵：同世界 w_dm1 的其他角色 cB 不受影響
ok('cB 在 w_dm1 的紀錄不受影響', inst['cB@w_local_default'].worldProgress['w_dm1'].location==='B-dm1');
ok('cB identity 仍在', S.loadIdentities().some(i=>i.characterId==='cB'));
ok('cC 完全不受影響', inst['cC@w_local_default'].worldProgress['__solo__'].location==='C-solo');
// active 指標 fallback：active world 曾是 w_dm1 → 回 default；active instance 曾是 cA@w_dm1 → fallback
ok('active world fallback 到 default', S.getActiveWorld()==='w_local_default');
ok('active instance fallback 到 cA@w_local_default', S.getActiveInstance()==='cA@w_local_default');
ok('active char 未動 (cA)', S.getActiveCharId()==='cA');

// ===== Test 2: deleteInstance 對「本地世界」也只刪目標槽 =====
seed();
S.deleteInstance('cA@w_local2');
inst = S.loadInstances();
ok('T2 cA.w_local2 已移除', !inst['cA@w_local_default'].worldProgress.hasOwnProperty('w_local2'));
ok('T2 cA.w_dm1 仍保留', inst['cA@w_local_default'].worldProgress.hasOwnProperty('w_dm1'));
ok('T2 cB 不受影響', inst['cB@w_local_default'].worldProgress['w_dm1'].location==='B-dm1');

// ===== Test 3: deleteIdentity 連帶清所有 instances + active fallback =====
seed();
const r3 = S.deleteIdentity('cA');
let ids = S.loadIdentities();
inst = S.loadInstances();
ok('deleteIdentity 回報 removed=true', r3.removed===true);
ok('cA identity 已移除', !ids.some(i=>i.characterId==='cA'));
ok('cA@w_local_default instance 已移除', !inst['cA@w_local_default']);
ok('cA@w_dm1 instance 也連帶移除', !inst['cA@w_dm1']);
ok('cB / cC identity 保留', ids.length===2 && ids.some(i=>i.characterId==='cB') && ids.some(i=>i.characterId==='cC'));
ok('cB instance 保留', !!inst['cB@w_local_default']);
// active char 曾是 cA → fallback 到剩餘第一個 (cB)
ok('active char fallback 到 cB', S.getActiveCharId()==='cB');
ok('active world fallback 到 default', S.getActiveWorld()==='w_local_default');
ok('active instance fallback 到 cB@w_local_default', S.getActiveInstance()==='cB@w_local_default');

// ===== Test 4: deleteIdentity 刪到最後一個角色 → 清為安全空狀態 =====
seed();
S.deleteIdentity('cB'); S.deleteIdentity('cC');
S.setActiveCharId('cA'); S.setActiveWorld('w_dm1'); S.setActiveInstance('cA@w_dm1');
const r4 = S.deleteIdentity('cA');
ok('T4 已無角色', S.loadIdentities().length===0);
ok('T4 active char 清空 (無空指標殘留)', S.getActiveCharId()==='' );
ok('T4 active world 清空', S.getActiveWorld()==='');
ok('T4 active instance 清空', S.getActiveInstance()==='');
ok('T4 instances 全清', Object.keys(S.loadInstances()).length===0);

// ===== Test 5: parseInstanceId 邊界 =====
ok('parseInstanceId 正常', S.parseInstanceId('cA@w1').characterId==='cA' && S.parseInstanceId('cA@w1').worldId==='w1');
ok('parseInstanceId 無@', S.parseInstanceId('cA').worldId===null);

console.log('\n結果: '+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
