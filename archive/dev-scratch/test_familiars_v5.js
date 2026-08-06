const C = require('./shared/character-schema.js').DND5E_CHAR;
const P = require('./shared/familiar-presets.js');

let fail = 0;
function ok(cond, msg) { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail++; }

// 1. empty familiar fallback
let oldSaveEmpty = { id: 'test1', familiar: null };
let mergedEmpty = C.mergeChar(C.defaultChar(), oldSaveEmpty);
ok(Array.isArray(mergedEmpty.familiars) && mergedEmpty.familiars.length === 0, '舊 null familiar 轉為 []');

// 2. single familiar migration
let oldSaveF = { id: 'test2', familiar: { name: '小貓', type: '貓', ac: 12, hp: {max: 2, current: 2} } };
let mergedF = C.mergeChar(C.defaultChar(), oldSaveF);
ok(Array.isArray(mergedF.familiars) && mergedF.familiars.length === 1, '舊單一 familiar 轉為 [該物件]');
ok(mergedF.familiars[0].name === '小貓', '資料不失: name');
ok(mergedF.familiars[0].ac === 12, '資料不失: ac');

// 3. multi familiars append
let fams = mergedF.familiars;
ok(fams.length === 1, '現有 1 隻');
let preset = P.PRESETS.find(p => p.id === 'owl');
fams.push(P.applyPreset(C.defaultFamiliar(), preset));
ok(fams.length === 2, '多隻新增/append 成功');
ok(fams[1].type === '貓頭鷹 (Owl)', '匯入的 type 為貓頭鷹');

// 4. canImportFamiliar gate remains active
let gate = P.canImportFamiliar(preset, { mode: 'dm', started: true });
ok(gate.ok === false, '主權閘門開團後拒絕匯入 (生效)');

console.log('\n' + (fail === 0 ? '✅ 全部通過' : '❌ 失敗 ' + fail + ' 項'));
process.exit(fail === 0 ? 0 : 1);
