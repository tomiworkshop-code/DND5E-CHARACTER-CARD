/* 魔寵範本匯入 (Familiar Preset Import) 最小測試
 *   1) preset 匯入：保留敘事面 (name/story/notes)、正確帶入機制面且深拷貝
 *   2) canImportFamiliar 主權閘門 (§5)
 * 純 node require（familiar-presets.js 走 UMD/IIFE，可 module.exports）。 */
const P = require('./shared/familiar-presets.js');

let fail = 0;
function ok(cond, msg) {
  console.log((cond ? '✅ ' : '❌ ') + msg);
  if (!cond) fail++;
}

/* ---- 資料完整性 ---- */
const srd = P.PRESETS.filter((p) => p.tier === 'srd');
const pact = P.PRESETS.filter((p) => p.tier === 'pact');
ok(srd.length === 15, 'tier=srd 共 15 種 CR0 野獸 (實得 ' + srd.length + ')');
ok(pact.length === 4, 'tier=pact 共 4 種官方進階魔寵 (實得 ' + pact.length + ')');
ok(P.PRESETS.every((p) => p.name === '' && p.story === '' && p.notes === ''), '所有範本的敘事面欄位皆留空');
ok(srd.every((p) => p.canAttack === false), 'srd 範本 canAttack=false');
ok(pact.every((p) => p.canAttack === true), 'pact 範本 canAttack=true');
const cat = srd.find((p) => p.id === 'cat');
ok(cat && cat.ac === 12 && cat.hp.max === 2 && cat.abilities.dex === 15, '貓 stat block 正確 (AC12/HP2/DEX15)');
const imp = pact.find((p) => p.id === 'imp');
ok(imp && imp.ac === 13 && imp.hp.max === 10 && imp.abilities.dex === 17, '小惡魔 stat block 正確 (AC13/HP10/DEX17)');

/* ---- applyPreset：保留敘事面、覆蓋機制面 ---- */
const prev = {
  name: '奶油小卷餅',            // 玩家自取名（敘事）
  story: '在酒館撿到的小傢伙',    // 玩家故事（敘事）
  notes: '很怕水',               // 敘事備註
  type: '狗', ac: 99, hp: { current: 50, max: 50 },
  abilities: { str: 20, dex: 20, con: 20, int: 20, wis: 20, cha: 20 },
  skills: [{ name: '亂咬', desc: '舊資料' }], attacks: [{ name: '舊攻擊' }]
};
const merged = P.applyPreset(prev, cat);
ok(merged.name === '奶油小卷餅', '匯入後保留玩家 name (敘事面)');
ok(merged.story === '在酒館撿到的小傢伙', '匯入後保留玩家 story (敘事面)');
ok(merged.notes === '很怕水', '匯入後保留玩家 notes (敘事面)');
ok(merged.type === '貓 (Cat)' && merged.ac === 12 && merged.hp.max === 2, '匯入後機制面帶入範本值 (type/AC/HP)');
ok(merged.abilities.dex === 15 && merged.abilities.str === 3, '匯入後能力值帶入範本值');
ok(Array.isArray(merged.attacks) && merged.attacks[0].name.indexOf('爪') === 0, '匯入後 attacks 帶入範本值');
ok(merged.tier === undefined && merged.id === undefined, '落地魔寵剝除 preset 專用 meta (id/tier)');
// 深拷貝：改動 merged 不得污染 preset 原始資料
merged.abilities.dex = 1;
merged.attacks.push({ name: 'x' });
ok(cat.abilities.dex === 15 && cat.attacks.length === 1, 'applyPreset 為深拷貝，未污染範本原始資料');

/* 無既有魔寵 (prev=null) → 敘事面為空字串 */
const fresh = P.applyPreset(null, imp);
ok(fresh.name === '' && fresh.story === '' && fresh.ac === 13, 'prev=null 時敘事面留空、機制面帶入');

/* ---- canImportFamiliar 主權閘門 (§5) ---- */
const G = P.canImportFamiliar;
// local：全部允許
ok(G(cat, { mode: 'local' }).ok === true, 'local: srd 允許');
ok(G(imp, { mode: 'local' }).ok === true, 'local: pact 允許');
// dm 未開團：srd 允許
ok(G(cat, { mode: 'dm', started: false }).ok === true, 'dm 未開團: srd 允許');
// dm 未開團：pact 需 allowPactFamiliar
ok(G(imp, { mode: 'dm', started: false, allowPactFamiliar: false }).ok === false, 'dm 未開團: pact 未開放 → 拒絕');
ok(G(imp, { mode: 'dm', started: false, allowPactFamiliar: true }).ok === true, 'dm 未開團: pact 已開放 → 允許');
// dm 開團後：機制面鎖定，一律拒絕
ok(G(cat, { mode: 'dm', started: true }).ok === false, 'dm 開團後: srd 鎖定 → 拒絕');
ok(G(imp, { mode: 'dm', started: true, allowPactFamiliar: true }).ok === false, 'dm 開團後: 即便 pact 已開放仍鎖定 → 拒絕');
ok(!G(imp, { mode: 'dm', started: false, allowPactFamiliar: false }).ok && G(imp, { mode: 'dm', started: false }).reason.length > 0, '拒絕時附帶原因字串');

console.log('\n' + (fail === 0 ? '✅ 全部通過' : '❌ 失敗 ' + fail + ' 項'));
process.exit(fail === 0 ? 0 : 1);
