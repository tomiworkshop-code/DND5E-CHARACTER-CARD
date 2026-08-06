/* test_familiar_compose_crash.js
 * 回歸測試：魔寵帶 skills 陣列時，composeC round-trip 不可崩潰。
 * Bug: composeC 曾用角色專用 mergeChar 合併魔寵 → mergeChar 的 k==="skills"
 *      分支讀 out.skills["0"]（魔寵無 skills 物件）→ TypeError reading '0'。
 * Fix: 改用魔寵專用 mergeFam（逐欄複製、hp/abilities 深合併）。
 */
const fs = require('fs');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx; // 讓 (window||this) 掛載點一致
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('shared/character-schema.js', 'utf8'), ctx, { filename: 'character-schema.js' });
vm.runInContext(fs.readFileSync('shared/store.js', 'utf8'), ctx, { filename: 'store.js' });

const C = ctx.DND5E_CHAR;
const S = ctx.DND5E_STORE;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name); } }

// 建一隻「從範本匯入」風格的魔寵：含 skills 陣列 + attacks 陣列 + abilities
const c = C.defaultChar();
c.familiars = [{
  id: 'f1', name: '小惡魔', type: 'Imp', speed: '20ft', ac: 13,
  hp: { current: 10, max: 10 },
  abilities: { str: 6, dex: 17, con: 13, int: 11, wis: 12, cha: 14 },
  senses: '黑暗視覺 120ft', resistances: '冷/火/毒免疫',
  skills: [{ name: '欺瞞', desc: '+4' }, { name: '隱匿', desc: '+5' }],
  attacks: [{ name: '螫針', hit: '+5', dmg: '1d4+3 刺+3d6 毒' }],
  story: '', notes: ''
}];

const identity = { characterId: 'c1', identity: S.pickIdentityFields(c) };
const instance = {
  mechanical: S.pickMechanicalFields(c),
  narrative: S.pickInstanceNarrative(c),
  worldProgress: {}
};

let composed = null, threw = null;
try { composed = S.composeC(identity, instance); } catch (e) { threw = e; }

ok('composeC 不再崩潰（skills 陣列魔寵）', !threw);
if (threw) console.log('    ↳ ' + threw.message);
ok('魔寵數量保留 1', composed && composed.familiars && composed.familiars.length === 1);
const f = composed && composed.familiars && composed.familiars[0];
ok('機制面帶入：名稱', f && f.name === '小惡魔');
ok('機制面帶入：AC', f && f.ac === 13);
ok('機制面帶入：hp 深合併', f && f.hp && f.hp.max === 10);
ok('機制面帶入：abilities.dex', f && f.abilities && f.abilities.dex === 17);
ok('skills 陣列保留且不被角色化', f && Array.isArray(f.skills) && f.skills.length === 2 && f.skills[0].name === '欺瞞');
ok('attacks 陣列保留', f && Array.isArray(f.attacks) && f.attacks.length === 1 && f.attacks[0].name === '螫針');

// 刪到 0 隻 → round-trip 空清單也不炸
const c2 = C.defaultChar(); c2.familiars = [];
let threw2 = null, composed2 = null;
try {
  composed2 = S.composeC(
    { characterId: 'c2', identity: S.pickIdentityFields(c2) },
    { mechanical: S.pickMechanicalFields(c2), narrative: S.pickInstanceNarrative(c2), worldProgress: {} }
  );
} catch (e) { threw2 = e; }
ok('空魔寵清單 round-trip 不崩潰', !threw2 && composed2 && composed2.familiars.length === 0);

console.log('\n\u7d50\u679c\uff1a' + pass + ' \u901a\u904e, ' + fail + ' \u5931\u6557');
process.exit(fail ? 1 : 0);
