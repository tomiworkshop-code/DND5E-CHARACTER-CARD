/* test_drop_saves.js — SCHEMA v6：淘汰死欄位 saves（統一用 profSaves）
 *   - SCHEMA_VERSION === 6
 *   - defaultChar 不再含 saves 欄位；FIELD_ZONES.mechanical 不再列 "saves"
 *   - mergeChar 安全遷移：舊存檔 saves:{...} → 併入 profSaves（profSaves 已有值優先）
 *   - 遷移後結果物件不再有 saves 欄位
 *   - migrateLegacySaves 冪等，可重跑
 */
const core = require('./data/core-rules.json');
global.SKILLS = core.SKILLS;
const mod = require('./shared/character-schema.js');
const C = (mod && mod.DND5E_CHAR) || global.DND5E_CHAR;

let fail = 0;
function ok(cond, msg) { console.log((cond ? '✅ ' : '❌ ') + msg); if (!cond) fail++; }

ok(C.SCHEMA_VERSION === 6, 'SCHEMA_VERSION === 6 (實得 ' + C.SCHEMA_VERSION + ')');

const dc = C.defaultChar();
ok(!('saves' in dc), 'defaultChar 不再含 saves 欄位');
ok(dc.profSaves && typeof dc.profSaves === 'object', 'defaultChar profSaves 仍為物件');
ok(Array.isArray(C.FIELD_ZONES.mechanical) && C.FIELD_ZONES.mechanical.indexOf('saves') === -1, 'FIELD_ZONES.mechanical 不再列 "saves"');
ok(C.FIELD_ZONES.mechanical.indexOf('profSaves') >= 0, 'FIELD_ZONES.mechanical 仍列 profSaves');

/* Case 1：舊存檔帶 saves 且完全無 profSaves */
const old1 = { id: 'o1', name: '老遊俠', saves: { dex: true, con: true, str: false } };
const m1 = C.mergeChar(dc, old1);
ok(m1.profSaves.dex === true && m1.profSaves.con === true, 'Case1 舊 saves.dex/con → profSaves 為 true');
ok(m1.profSaves.str === false, 'Case1 舊 saves.str:false → profSaves.str 為 false');
ok(!('saves' in m1), 'Case1 遷移後結果不再有 saves 欄位');

/* Case 2：舊存檔帶 saves 且已有 profSaves（profSaves 已有值優先，不被覆蓋） */
const old2 = { id: 'o2', saves: { str: true, dex: true }, profSaves: { wis: true } };
const m2 = C.mergeChar(dc, old2);
ok(m2.profSaves.wis === true, 'Case2 較新 profSaves.wis:true 保留（未被舊 saves 覆蓋遺失）');
ok(m2.profSaves.str === true && m2.profSaves.dex === true, 'Case2 舊 saves.str/dex 併入 profSaves');
ok(!('saves' in m2), 'Case2 遷移後結果不再有 saves 欄位');

/* Case 2b：profSaves 已為 true，舊 saves 為 false，不得被降級 */
const old2b = { id: 'o2b', saves: { con: false }, profSaves: { con: true } };
const m2b = C.mergeChar(dc, old2b);
ok(m2b.profSaves.con === true, 'Case2b profSaves.con:true 不被舊 saves.con:false 降級');

/* Case 3：冪等 —— 對已遷移結果重跑 mergeChar 不變 */
const m1again = C.mergeChar(dc, m1);
ok(m1again.profSaves.dex === true && m1again.profSaves.con === true && !('saves' in m1again), 'Case3 重跑 mergeChar 冪等（profSaves 一致、無 saves）');

/* Case 4：migrateLegacySaves 直接重跑冪等 */
const t = { profSaves: {}, saves: { int: true } };
C.migrateLegacySaves(t, { saves: { int: true } });
C.migrateLegacySaves(t, { saves: { int: true } });
ok(t.profSaves.int === true && !('saves' in t), 'Case4 migrateLegacySaves 冪等且清除 saves 欄位');

/* Case 5：無 saved.saves → no-op，不誤造 profSaves 值 */
const t5 = C.migrateLegacySaves({ profSaves: { dex: true } }, { id: 'x' });
ok(t5.profSaves.dex === true && Object.keys(t5.profSaves).length === 1, 'Case5 無舊 saves → 不新增鍵、原值保留');

console.log('\n' + (fail === 0 ? '✅ 全部通過' : '❌ 失敗 ' + fail + ' 項'));
process.exit(fail === 0 ? 0 : 1);
