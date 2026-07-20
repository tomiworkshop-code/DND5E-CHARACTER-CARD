/* test_schema_v4.js — SCHEMA v4 遷移最小測試（純 node）
 *   - SCHEMA_VERSION === 4
 *   - defaultChar 技能含 expertise:false；profSaves 為 {}
 *   - mergeChar 相容舊存檔（skills 無 expertise → 補 false；無 profSaves → 補 {}）
 *   - migrateSkillsSaves 冪等
 */
// 提供宿主全域 SKILLS 供 defaultChar 使用（含 attr/attrZh）
const core = require('./data/core-rules.json');
global.SKILLS = core.SKILLS;
const mod = require('./shared/character-schema.js');
const C = (mod && mod.DND5E_CHAR) || global.DND5E_CHAR;

let fail = 0;
function ok(cond, msg) { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail++; }

ok(C.SCHEMA_VERSION === 4, 'SCHEMA_VERSION 為 4 (實得 ' + C.SCHEMA_VERSION + ')');

const dc = C.defaultChar();
const firstSkill = core.SKILLS[0].zh;
ok(dc.skills[firstSkill] && dc.skills[firstSkill].expertise === false, 'defaultChar 技能含 expertise:false');
ok(dc.skills[firstSkill].proficient === false && dc.skills[firstSkill].override === null, 'defaultChar 技能保留 proficient/override');
ok(dc.profSaves && typeof dc.profSaves === 'object' && !Array.isArray(dc.profSaves), 'defaultChar profSaves 為物件');

/* 模擬 v3 舊存檔：技能只有 {proficient, override}，且完全無 profSaves */
const oldSave = {
  id: 'oldc1', name: '老戰士',
  skills: { [firstSkill]: { proficient: true, override: null }, '運動': { proficient: true, override: 3 } }
};
delete oldSave.profSaves;

const merged = C.mergeChar(dc, oldSave);
ok(merged.skills[firstSkill].expertise === false, '舊存檔技能無 expertise → mergeChar 補 false');
ok(merged.skills[firstSkill].proficient === true, '舊存檔 proficient 保留');
ok(merged.skills['運動'].expertise === false && merged.skills['運動'].override === 3, '舊存檔第二技能也補 expertise 且保留 override');
ok(merged.profSaves && typeof merged.profSaves === 'object' && Object.keys(merged.profSaves).length === 0, '舊存檔無 profSaves → mergeChar 補 {}');

/* 帶 expertise 的新存檔：不被覆蓋 */
const newSave = { id: 'newc', skills: { [firstSkill]: { proficient: true, expertise: true, override: null } }, profSaves: { str: true } };
const merged2 = C.mergeChar(dc, newSave);
ok(merged2.skills[firstSkill].expertise === true, '新存檔 expertise:true 被保留');
ok(merged2.profSaves.str === true, '新存檔 profSaves.str 被保留');

/* migrateSkillsSaves 冪等 */
const m3 = { skills: { a: { proficient: false, override: null } } };
C.migrateSkillsSaves(m3);
C.migrateSkillsSaves(m3);
ok(m3.skills.a.expertise === false && m3.profSaves && Object.keys(m3.profSaves).length === 0, 'migrateSkillsSaves 冪等且補齊');

console.log('\n' + (fail === 0 ? '✅ 全部通過' : '❌ 失敗 ' + fail + ' 項'));
process.exit(fail === 0 ? 0 : 1);
