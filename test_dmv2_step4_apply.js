/* test_dmv2_step4_apply.js
 * Step 4.3 套用流程（jsdom 真實 Vue）：
 *  - openApplyTemplate → 逐變數搜尋式選擇器（軟過濾：依 hint 取候選池）
 *  - 候選池：roster 玩家 / 世界實體(npc…) / 遭遇怪物；showAll 切全部；search 過濾
 *  - setApplyValue → 即時代入可編輯預覽；手改預覽後 edited 鎖住不被覆蓋；regen 還原
 *  - applyMissing 缺值提示；command 預覽解析對象(必為 roster)+數值
 *  - confirmApply → stagedApply（4.4 才真發送）
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
async function addEntity(vm, type, name, extra) {
  vm.openAddEntity(type);
  Object.assign(vm.editingEntity, { name: name }, extra || {});
  vm.saveEntity(); await tick(vm);
}

(async () => {
  const store = {};
  const { dom, vm, jsErrors } = await boot(store);
  const doc = dom.window.document;
  ok('Vue 掛載成功且無 JS 錯誤', !!vm && jsErrors.length === 0);
  if (jsErrors.length) console.log('    errors:', jsErrors.slice(0, 5));

  /* 世界 + 素材 */
  vm.newWorldName = '套用測試世界'; vm.addWorld(); await tick(vm);
  vm.goTab('worldset'); await tick(vm);
  await addEntity(vm, 'npc', '哥布林長老');
  await addEntity(vm, 'location', '幽暗洞窟');
  /* 一個遭遇（帶怪物）→ 給 monster 候選池 */
  vm.openModule({ key: 'encounter' }); await tick(vm);
  vm.openAddEntity('encounter');
  vm.editingTemplate; // no-op
  vm.editingEntity.name = '洞窟伏擊';
  vm.addMonsterRow(); vm.editingEntity.monsters[0] = { name: '哥布林', count: 3, notes: '' };
  vm.saveEntity(); await tick(vm);
  ok('遭遇怪物入池', vm.encounterMonsters.some((m) => m.name === '哥布林'));

  /* 注入兩名連線玩家（roster）*/
  vm.rosterMap = {
    p1: { name: '亞拉岡', level: 5, hp: 30, characterId: 'c-aragon' },
    p2: { name: '甘道夫', level: 9, hp: 22, characterId: 'c-gandalf' }
  };
  await tick(vm);
  ok('roster 兩名玩家', vm.rosterList.length === 2);

  /* 建一個 command 模板：{playerName} 被 {monsterName} 咬，受 {damage} 傷 */
  const id = vm.upsertTemplate({ name: '被咬', kind: 'command',
    text: '{playerName} 被 {monsterName} 咬中，受 {damage} 點傷害！',
    command: { type: 'damage', amountVar: 'damage', targetVar: 'playerName' } });
  await tick(vm);
  const tpl = vm.templates.find((t) => t.id === id);

  /* ---- 套用 ---- */
  vm.goTab('command'); await tick(vm);
  vm.openApplyTemplate(tpl); await tick(vm);
  ok('套用表單渲染', !!doc.querySelector('[data-testid="tpl-apply-modal"]'));
  ok('掃出 3 變數區塊', doc.querySelectorAll('[data-testid="apply-var-block"]').length === 3);

  /* 候選池：playerName(hint roster) → 2 玩家；monsterName(hint monster) → 哥布林 */
  const pcCands = vm.applyCandidates('playerName');
  ok('playerName 候選=連線玩家', pcCands.length === 2 && pcCands[0].src === 'roster');
  const monCands = vm.applyCandidates('monsterName');
  ok('monsterName 候選=遭遇怪物', monCands.some((c) => c.name === '哥布林' && c.src === 'monster'));
  const dmgCands = vm.applyCandidates('damage');
  ok('damage(hint free) 無候選', dmgCands.length === 0);

  /* showAll：damage 顯示全部 → 匯集所有池 */
  vm.toggleApplyShowAll('damage'); await tick(vm);
  ok('damage showAll → 含玩家+怪物+實體', vm.applyCandidates('damage').length >= 4);

  /* search 過濾 */
  vm.setApplySearch('playerName', '甘'); await tick(vm);
  ok('search 過濾出甘道夫', vm.applyCandidates('playerName').length === 1 && vm.applyCandidates('playerName')[0].name === '甘道夫');
  vm.setApplySearch('playerName', ''); await tick(vm);

  /* 填值 → 即時代入預覽 */
  vm.setApplyValue('playerName', '亞拉岡');
  vm.setApplyValue('monsterName', '哥布林');
  vm.setApplyValue('damage', '7');
  await tick(vm);
  ok('預覽即時代入', vm.applyState.finalText === '亞拉岡 被 哥布林 咬中，受 7 點傷害！');
  ok('applyMissing 清空', vm.applyMissing.length === 0);

  /* 手改預覽 → edited 鎖住，再改變數不覆蓋 */
  vm.onApplyTextEdit('亞拉岡 硬扛了一擊，只受 7 點傷！');
  vm.setApplyValue('damage', '99');
  await tick(vm);
  ok('手改後不被變數覆蓋', vm.applyState.finalText === '亞拉岡 硬扛了一擊，只受 7 點傷！');
  /* regen 還原（用最新值）*/
  vm.regenApplyText(); await tick(vm);
  ok('regen 以最新值重新代入', vm.applyState.finalText.indexOf('99') >= 0 && vm.applyState.edited === false);

  /* command 預覽：對象=亞拉岡=roster ✅ */
  const cp = vm.applyCommandPreview;
  ok('command 預覽 type/amount', cp && cp.type === 'damage' && String(cp.amount) === '99');
  ok('command 對象為連線玩家 ✅', cp && cp.targetName === '亞拉岡' && cp.targetIsRoster === true);

  /* 對象改成非 roster（怪物名）→ 警告 */
  vm.setApplyValue('playerName', '哥布林'); await tick(vm);
  ok('對象非 roster → targetIsRoster=false', vm.applyCommandPreview.targetIsRoster === false);
  /* 改回合法 */
  vm.setApplyValue('playerName', '甘道夫'); await tick(vm);

  /* 確認 → stagedApply（4.4 才發送）*/
  const staged = vm.confirmApply();
  await tick(vm);
  ok('confirmApply 關閉表單', vm.showApplyForm === false);
  ok('staged 帶解析後 command(pid/characterId)', staged && staged.command.targetIsRoster === true && staged.command.characterId === 'c-gandalf');
  ok('staged.kind/text 帶出', staged.kind === 'command' && typeof staged.text === 'string');
  ok('stagedApply ref 同步', vm.stagedApply && vm.stagedApply.at === staged.at);

  /* broadcast 模板（無 command）→ 預覽無 command */
  const bId = vm.upsertTemplate({ name: '旁白', kind: 'broadcast', text: '{loc} 傳來低吼。' });
  await tick(vm);
  vm.openApplyTemplate(vm.templates.find((t) => t.id === bId)); await tick(vm);
  ok('broadcast 套用無 command 預覽', vm.applyCommandPreview === null);
  const locCands = vm.applyCandidates('loc');
  ok('loc(hint location) 候選=地點', locCands.some((c) => c.name === '幽暗洞窟' && c.src === 'location'));

  console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('測試異常', e); process.exit(1); });
