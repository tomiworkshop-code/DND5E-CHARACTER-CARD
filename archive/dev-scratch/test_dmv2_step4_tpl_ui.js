/* test_dmv2_step4_tpl_ui.js
 * Step 4.2 模板設定 UI（CRUD）— jsdom 真實 Vue 掛載：
 *  - 指令中心分頁渲染模板庫（內建 5 筆卡片）
 *  - 新增流程：openAddTemplate → 填 name/kind/text → 變數自動偵測 → hint 設定 →
 *    command 綁定 → submit → 落地 + 卡片出現
 *  - 編輯流程：openEditTemplate 載入工作副本（hints/command 還原）→ 改 → 落地
 *  - 刪除、回復內建
 *  - 表單只在 showTemplateForm 時渲染；DOM testid 齊全
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
  const store = {};
  const { dom, vm, jsErrors } = await boot(store);
  const doc = dom.window.document;
  ok('Vue 掛載成功且無 JS 錯誤', !!vm && jsErrors.length === 0);
  if (jsErrors.length) console.log('    errors:', jsErrors.slice(0, 5));

  /* 切到指令中心分頁 */
  vm.goTab('command'); await tick(vm);
  ok('指令中心渲染模板管理器', !!doc.querySelector('[data-testid="template-manager"]'));
  const cards0 = doc.querySelectorAll('[data-testid="tpl-cards"] .entity-card');
  ok('內建 5 筆卡片渲染', cards0.length === 5);
  ok('指令型卡片顯示 command badge', !!doc.querySelector('[data-testid="tpl-cmd-badge"]'));
  ok('卡片顯示變數 chips', !!doc.querySelector('[data-testid="tpl-var-chips"]'));

  /* 表單預設不渲染 */
  ok('表單初始未渲染', !doc.querySelector('[data-testid="tpl-form-modal"]'));

  /* ---- 新增流程 ---- */
  vm.openAddTemplate(); await tick(vm);
  ok('新增：表單渲染', !!doc.querySelector('[data-testid="tpl-form-modal"]'));
  ok('新增：工作副本為空白 broadcast', vm.editingTemplate.kind === 'broadcast' && vm.editingTemplate.name === '');

  vm.editingTemplate.name = '毒針陷阱';
  vm.editingTemplate.kind = 'command';
  vm.editingTemplate.text = '{who} 被 {trap} 刺中，受 {dmg} 點毒傷！';
  await tick(vm);
  ok('變數自動偵測 3 個', vm.editVarNames.length === 3 && vm.editVarNames.indexOf('who') >= 0);
  ok('who 預設 hint=roster（猜測）', vm.hintFor('who') === 'roster');
  const varRows = doc.querySelectorAll('[data-testid="tpl-var-row"]');
  ok('變數編輯列渲染 3 列', varRows.length === 3);

  /* command 綁定 UI 出現 */
  ok('kind=command → 指令綁定編輯器渲染', !!doc.querySelector('[data-testid="tpl-command-editor"]'));
  vm.editingTemplate.command.type = 'damage';
  vm.editingTemplate.command.amountVar = 'dmg';
  vm.editingTemplate.command.targetVar = 'who';
  await tick(vm);

  vm.submitTemplateForm(); await tick(vm);
  ok('新增後表單關閉', vm.showTemplateForm === false && vm.editingTemplate === null);
  ok('模板庫 6 筆', vm.templates.length === 6);
  const made = vm.templates.find((t) => t.name === '毒針陷阱');
  ok('新模板落地含 command 綁定', made && made.command.type === 'damage' && made.command.targetVar === 'who');
  ok('新模板 vars 帶 hint', made && made.vars.find((v) => v.name === 'who').hint === 'roster');
  ok('落 dmv2:dnd_templates_v2', /毒針陷阱/.test(store['dmv2:dnd_templates_v2'] || ''));

  /* ---- 編輯流程 ---- */
  vm.openEditTemplate(made); await tick(vm);
  ok('編輯：工作副本還原 name/kind', vm.editingTemplate.name === '毒針陷阱' && vm.editingTemplate.kind === 'command');
  ok('編輯：command 還原', vm.editingTemplate.command.type === 'damage' && vm.editingTemplate.command.amountVar === 'dmg');
  ok('編輯：hints 還原', vm.hintFor('who') === 'roster');
  vm.editingTemplate.name = '劇毒針陷阱';
  vm.submitTemplateForm(); await tick(vm);
  ok('編輯為更新非新增', vm.templates.length === 6 && !!vm.templates.find((t) => t.name === '劇毒針陷阱') && !vm.templates.find((t) => t.name === '毒針陷阱'));

  /* 改成 broadcast 後再 submit → 不應帶 command */
  const b = vm.templates.find((t) => t.name === '劇毒針陷阱');
  vm.openEditTemplate(b); await tick(vm);
  vm.editingTemplate.kind = 'broadcast';
  vm.submitTemplateForm(); await tick(vm);
  ok('改回 broadcast → 去除 command', !vm.templates.find((t) => t.name === '劇毒針陷阱').command);

  /* ---- 刪除 ---- */
  const del = vm.templates.find((t) => t.name === '劇毒針陷阱');
  vm.removeTemplate(del); await tick(vm);
  ok('刪除後剩 5 筆', vm.templates.length === 5);

  /* ---- 回復內建 ---- */
  vm.upsertTemplate({ name: '臨時', kind: 'broadcast', text: 'x' }); await tick(vm);
  ok('加一筆後 6 筆', vm.templates.length === 6);
  vm.resetTemplatesToBuiltin(); await tick(vm);
  ok('回復內建 → 5 筆', vm.templates.length === 5 && !vm.templates.find((t) => t.name === '臨時'));

  /* 資料隔離 */
  ok('未污染玩家版 key', !('dnd_templates_v2' in store));

  console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('測試異常', e); process.exit(1); });
