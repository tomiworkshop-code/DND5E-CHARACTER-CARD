/* QA (PR-Local-1 → 已更新至 PR-Local-2 新規格): sessionMode / sessionModeBadge 狀態機驗收。
 * ⚠️ PR-Local-2 修正：sessionMode 改依「目前檢視世界 vs 連線目標(room.meta.worldId)」判定，
 *   不再一見 room.status==='connected' 就回 connected。[E]/[F] 已更新為新規格預期值。
 * 手法：從 v2/app.js 原始碼「原文擷取」sessionMode 與 sessionModeBadge 的 computed 定義，
 *   以 vm 注入 mock 的 computed/ref（依 .value 取值），驗證真實程式邏輯（非手抄）。
 * 執行：node archive/dev-scratch/test_pr_local_1_sessionmode_qa.js
 */
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('v2/app.js', 'utf8');

/* 擷取 const sessionMode = computed(() => { ... }); 與 sessionModeBadge。 */
function extract(name) {
  const start = src.indexOf('const ' + name + ' = computed(');
  if (start < 0) throw new Error('找不到 ' + name);
  // 從 start 起做括號配對到 ');' 結束
  let i = src.indexOf('computed(', start) + 'computed('.length - 1; // 指到 '('
  let depth = 0, end = -1;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) { end = j; break; } }
  }
  // 取到結尾的 ');'
  return src.slice(start, end + 1) + ';';
}

const sessionModeSrc = extract('sessionMode');
const badgeSrc = extract('sessionModeBadge');
console.log('--- 擷取到的 sessionMode 原文 ---\n' + sessionModeSrc + '\n');

let pass = 0, fail = 0; const fails = [];
function check(name, cond){ if(cond){pass++;console.log('  ✅ '+name);} else {fail++;fails.push(name);console.log('  ❌ '+name);} }

const DEFAULT_WORLD_ID = 'w_local_default';

/* mock computed：回傳有 .value getter 的物件，每次讀取重算（貼近 Vue 語意） */
function makeCtx(state) {
  const ctx = {
    computed: (fn) => ({ get value(){ return fn(); } }),
    DEFAULT_WORLD_ID,
    room: state.room,
    selectedWorldKey: { value: state.selectedWorldKey },
    selectedWorldObj: { value: state.selectedWorldObj }
  };
  vm.createContext(ctx);
  // const 為區塊作用域，需以無宣告賦值把結果掛回 context 物件
  vm.runInContext(sessionModeSrc + '\n' + badgeSrc + '\n__mode = sessionMode; __badge = sessionModeBadge;', ctx);
  return ctx;
}

function evalMode(state){ return makeCtx(state).__mode.value; }
function evalBadge(state){ return makeCtx(state).__badge.value; }

console.log('[A] connected 房間 → connected');
{
  const s = { room:{status:'connected',meta:{worldId:'w_dm_1'}}, selectedWorldKey:'w_dm_1', selectedWorldObj:{id:'w_dm_1',type:'dm'} };
  check('connected 房間、看 DM 世界 → connected', evalMode(s) === 'connected');
  check('badge=📡連線 DM', evalBadge(s).icon === '📡');
}

console.log('[B] 本地世界、未連線 → local');
{
  const s = { room:{status:'idle',meta:null}, selectedWorldKey:DEFAULT_WORLD_ID, selectedWorldObj:{id:DEFAULT_WORLD_ID,type:'local'} };
  check('local', evalMode(s) === 'local');
  check('badge=🏠本地單人', evalBadge(s).icon === '🏠');
}

console.log('[C] DM 世界、未連線 → offline-dm');
{
  const s = { room:{status:'idle',meta:null}, selectedWorldKey:'w_dm_2', selectedWorldObj:{id:'w_dm_2',type:'dm'} };
  check('offline-dm', evalMode(s) === 'offline-dm');
  check('badge=🕳️離線待提案', evalBadge(s).icon === '🕳️');
}

console.log('[D] type=solo → local');
{
  const s = { room:{status:'idle',meta:null}, selectedWorldKey:'someSolo', selectedWorldObj:{id:'someSolo',type:'solo'} };
  check('solo 視為 local', evalMode(s) === 'local');
}

console.log('[E] 房間 connected 但切到「本地世界」（PR-Local-2 新規格：依檢視世界判定）');
{
  const s = { room:{status:'connected',meta:{worldId:'w_dm_1'}}, selectedWorldKey:DEFAULT_WORLD_ID, selectedWorldObj:{id:DEFAULT_WORLD_ID,type:'local'} };
  const mode = evalMode(s);
  console.log('     → 實得 sessionMode =', mode);
  // PR-Local-2 修正（設計 §2.2）：連線目標≠檢視世界時不再一律 connected；看本地世界→local。
  check('看本地世界 → local（PR-Local-2 新規格，非 connected）', mode === 'local');
  check('badge=🏠本地單人', evalBadge(s).icon === '🏠');
}

console.log('[F] 連線世界 A，但檢視「不同 DM 世界 B」（PR-Local-2 新規格）');
{
  const s = { room:{status:'connected',meta:{worldId:'w_dm_A'}}, selectedWorldKey:'w_dm_B', selectedWorldObj:{id:'w_dm_B',type:'dm'} };
  const mode = evalMode(s);
  console.log('     → 實得 sessionMode =', mode);
  // 檢視非連線目標的 DM 世界 → offline-dm（離線待提案）。
  check('看別的 DM 世界 → offline-dm（PR-Local-2 新規格）', mode === 'offline-dm');
  check('badge=🕳️離線待提案', evalBadge(s).icon === '🕳️');
}

console.log('[G] selectedWorldObj 為 undefined 防呆');
{
  const s = { room:{status:'idle',meta:null}, selectedWorldKey:'ghost', selectedWorldObj:undefined };
  let threw=false, mode;
  try { mode = evalMode(s); } catch(e){ threw=true; }
  check('undefined world 不拋錯', !threw);
  check('fallback = local', mode === 'local');
}

console.log('[H] badge 結構完整（key/icon/label/cls）');
{
  const s = { room:{status:'idle',meta:null}, selectedWorldKey:DEFAULT_WORLD_ID, selectedWorldObj:{type:'local'} };
  const b = evalBadge(s);
  check('badge 具 key/icon/label/cls', b.key && b.icon && b.label && b.cls);
}

console.log('\n================ QA 結果 ================');
console.log('PASS: '+pass+'  FAIL: '+fail);
if(fail){ console.log('失敗:\n - '+fails.join('\n - ')); process.exit(1); }
console.log('✅ 全部通過');
process.exit(0);
