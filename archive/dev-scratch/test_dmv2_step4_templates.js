/* test_dmv2_step4_templates.js
 * Step 4.1 訊息模板資料模型：
 *  A) 純邏輯 shared/templates.js：scanVars / guessHint / normalize（變數同步+hint保留+
 *     command 校驗）/ applyValues / missingVars / builtins / parseLibrary
 *  B) DM app 儲存整合（jsdom）：loadTemplates 首載 seed 內建 / upsert / delete /
 *     persist reload round-trip / dmv2: 隔離 / ready.templates
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const T = require('./shared/templates.js');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713', name); } else { fail++; console.log('  \u2717', name); } }

/* ============================================================
   A) 純邏輯
   ============================================================ */
console.log('A) shared/templates.js 純邏輯');

ok('scanVars 依序去重', JSON.stringify(T.scanVars('{a} 打 {b}，再 {a}！')) === JSON.stringify(['a', 'b']));
ok('scanVars 支援中文變數名', JSON.stringify(T.scanVars('{玩家} 對 {怪物}')) === JSON.stringify(['玩家', '怪物']));
ok('scanVars 容忍空白 { x }', JSON.stringify(T.scanVars('{ dmg }')) === JSON.stringify(['dmg']));
ok('scanVars 空字串→[]', T.scanVars('').length === 0);

ok('guessHint playerName→roster', T.guessHint('playerName') === 'roster');
ok('guessHint monsterName→monster', T.guessHint('monsterName') === 'monster');
ok('guessHint npcName→npc', T.guessHint('npcName') === 'npc');
ok('guessHint 未知→free', T.guessHint('damage') === 'free');

const n1 = T.normalize({ name: 't', kind: 'broadcast', text: '{playerName} 造成 {damage}' });
ok('normalize 產生 vars 對齊文字', n1.vars.length === 2 && n1.vars[0].name === 'playerName');
ok('normalize 自動猜 hint', n1.vars[0].hint === 'roster' && n1.vars[1].hint === 'free');

const n2 = T.normalize({ text: '{a} {b}', vars: [{ name: 'a', hint: 'npc' }] });
ok('normalize 保留既有 hint', n2.vars[0].hint === 'npc');
ok('normalize 為新變數補 hint', n2.vars[1].name === 'b' && n2.vars[1].hint === 'free');

const n3 = T.normalize({ text: '{a}', vars: [{ name: 'a', hint: 'npc' }, { name: 'gone', hint: 'quest' }] });
ok('normalize 移除文字已不存在的變數', n3.vars.length === 1 && n3.vars[0].name === 'a');

const nBad = T.normalize({ kind: '亂填', text: 'x' });
ok('normalize 非法 kind→broadcast', nBad.kind === 'broadcast');

const nCmd = T.normalize({ kind: 'command', text: '{tgt} 受 {dmg}',
  command: { type: 'damage', amountVar: 'dmg', targetVar: 'tgt' } });
ok('normalize command 保留合法 amountVar/targetVar', nCmd.command.amountVar === 'dmg' && nCmd.command.targetVar === 'tgt');
ok('normalize command 強制 targetIsRoster', nCmd.command.targetIsRoster === true);

const nCmd2 = T.normalize({ kind: 'command', text: '{a}',
  command: { type: 'damage', amountVar: 'notexist', targetVar: 'notexist' } });
ok('normalize command 清掉不存在的變數綁定', nCmd2.command.amountVar === '' && nCmd2.command.targetVar === '');

const nCmd3 = T.normalize({ kind: 'command', text: '{a}', command: { type: '亂填' } });
ok('normalize 非法 command.type→不帶 command', !nCmd3.command);

ok('applyValues 代入', T.applyValues('{a} 打 {b}', { a: '貓', b: '鳥' }) === '貓 打 鳥');
ok('applyValues 缺值保留原樣', T.applyValues('{a} 打 {b}', { a: '貓' }) === '貓 打 {b}');
ok('missingVars 找出缺值', JSON.stringify(T.missingVars('{a}{b}', { a: 'x' })) === JSON.stringify(['b']));

const bi = T.builtins();
ok('builtins 5 筆', bi.length === 5);
ok('builtins 皆已 normalize（含 vars）', bi.every((t) => Array.isArray(t.vars)));
ok('builtins 攻擊命中=broadcast 無 command', bi[0].id === 'tpl_hit' && bi[0].kind === 'broadcast' && !bi[0].command);
ok('builtins 敵人反擊=command damage 對 roster', bi[1].command.type === 'damage' && bi[1].command.targetVar === 'playerName');

ok('parseLibrary 壞 JSON→null', T.parseLibrary('{壞') === null);
ok('parseLibrary 非陣列→null', T.parseLibrary('{"a":1}') === null);
const pl = T.parseLibrary(JSON.stringify([{ name: 'x', text: '{a}' }, { junk: 1 }]));
ok('parseLibrary 過濾空殼 + normalize', pl.length === 1 && pl[0].vars[0].name === 'a');

/* ============================================================
   B) DM app 儲存整合（jsdom）
   ============================================================ */
const html = fs.readFileSync('worldbuilder-v2/index.html', 'utf8');
function boot(sharedStore) {
  return new Promise((resolve, reject) => {
    const jsErrors = [];
    const dom = new JSDOM(html, {
      runScripts: 'dangerously', resources: 'usable',
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
  console.log('\nB) DM app 儲存整合（jsdom）');
  const store = {};
  const { vm, jsErrors } = await boot(store);
  ok('Vue 掛載成功且無 JS 錯誤', !!vm && jsErrors.length === 0);
  if (jsErrors.length) console.log('    errors:', jsErrors.slice(0, 5));

  ok('ready.templates = true', vm.ready.templates === true);
  ok('首載自動 seed 內建 5 筆', vm.templates.length === 5);
  ok('落 dmv2:dnd_templates_v2', typeof store['dmv2:dnd_templates_v2'] === 'string');
  ok('未污染無前綴 key', !('dnd_templates_v2' in store));
  ok('TPL 常數已導出', vm.TPL_KINDS.length === 3 && vm.TPL_HINTS.length === 8 && vm.TPL_COMMAND_TYPES.length === 5);

  /* 新增自訂模板 */
  const id = vm.upsertTemplate({ name: '毒霧', kind: 'command', text: '{who} 吸入毒霧，受 {dmg} 點毒傷。',
    command: { type: 'damage', amountVar: 'dmg', targetVar: 'who' } });
  await tick(vm);
  ok('upsert 回傳新 id', !!id && id.indexOf('tpl') === 0);
  ok('模板庫 6 筆', vm.templates.length === 6);
  const t = vm.templates.find((x) => x.id === id);
  ok('新模板變數自動掃描', t && t.vars.length === 2 && t.vars.some((v) => v.name === 'who'));
  ok('新模板 command 綁定正確', t && t.command.type === 'damage' && t.command.targetVar === 'who');

  /* 更新同一筆 */
  vm.upsertTemplate(Object.assign({}, t, { name: '劇毒霧' }));
  await tick(vm);
  ok('upsert 同 id 為更新非新增', vm.templates.length === 6 && vm.templates.find((x) => x.id === id).name === '劇毒霧');

  /* 刪除 */
  vm.deleteTemplate(id);
  await tick(vm);
  ok('delete 後剩 5 筆', vm.templates.length === 5 && !vm.templates.find((x) => x.id === id));

  /* persist reload round-trip */
  vm.upsertTemplate({ name: '重載測試', kind: 'broadcast', text: 'hello {x}' });
  await tick(vm);
  const { vm: vm2, jsErrors: e2 } = await boot(store);
  ok('重載無 JS 錯誤', e2.length === 0);
  ok('重載後不再 seed（沿用已存）', vm2.templates.length === 6);
  ok('重載後自訂模板仍在', !!vm2.templates.find((x) => x.name === '重載測試'));

  /* reset 回內建 */
  vm2.resetTemplatesToBuiltin();
  await tick(vm2);
  ok('reset 回 5 筆內建', vm2.templates.length === 5 && !vm2.templates.find((x) => x.name === '重載測試'));

  console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('測試異常', e); process.exit(1); });
