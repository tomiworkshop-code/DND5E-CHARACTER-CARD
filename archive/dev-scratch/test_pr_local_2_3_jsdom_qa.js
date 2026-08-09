/* 獨立 QA (PR-Local-2/3) jsdom 動態掛載：驗真實 Vue app 掛載新模板無錯、
 *   dice UI 渲染、擲骰→戰報落帳、一鍵套用 HP 走 reactive→decomposeC bump version_m。
 * 需求：本機 /tmp/vue.global.prod.js（離線 Vue），否則 SKIP。
 * 執行（cwd = repo 根）：node archive/dev-scratch/test_pr_local_2_3_jsdom_qa.js
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '../..');
const VUE_LOCAL = '/tmp/vue.global.prod.js';

if (!fs.existsSync(VUE_LOCAL)) { console.log('SKIP: 無 ' + VUE_LOCAL + '（離線 Vue 不可用）'); process.exit(0); }

let html = fs.readFileSync(path.join(REPO, 'v2/index.html'), 'utf8');
// 把 CDN Vue 換成本機檔，其餘保持原樣（測真實模板 + 真實 app.js）。
html = html.replace(/https:\/\/unpkg\.com\/vue@3\/dist\/vue\.global\.prod\.js/,
  'file://' + VUE_LOCAL);
// 移除 GA / firebase CDN（離線避免噪音，不影響被測邏輯）。
html = html.replace(/<script async src="https:\/\/www\.googletagmanager[^<]*<\/script>/g, '');
html = html.replace(/<script[^>]*gtag\/js[^>]*><\/script>/g, '');

const vueWarns = [];
const jsErrors = [];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + path.join(REPO, 'v2', 'index.html'),
  beforeParse(window) {
    const _store = {};
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (k) => (k in _store ? _store[k] : null),
      setItem: (k, v) => { _store[k] = String(v); },
      removeItem: (k) => { delete _store[k]; }, clear: () => { for (const k in _store) delete _store[k]; }
    }});
    window.alert = () => {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
    const origWarn = window.console.warn, origErr = window.console.error;
    window.console.warn = (...a) => { const s = a.map(String).join(' '); vueWarns.push(s); };
    window.console.error = (...a) => { const s = a.map(x => (x && x.stack) ? x.stack : String(x)).join(' '); jsErrors.push(s); };
    window.fetch = async (url) => {
      const map = ['core-rules', 'classes', 'items', 'spells', 'sources', 'races'];
      for (const m of map) if (url.includes(m + '.json')) {
        try { return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(REPO, 'data', m + '.json'), 'utf8')) }; }
        catch (e) { return { ok: true, json: async () => ([]) }; }
      }
      return { ok: true, json: async () => ({}) };
    };
  }
});

let pass = 0, fail = 0; const fails = [];
function ok(name, cond) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; fails.push(name); console.log('  ❌ ' + name); } }

setTimeout(() => {
  const w = dom.window, doc = w.document;
  const vm = w.__vm;
  ok('Vue app 掛載成功（window.__vm 存在）', !!vm);
  const logicErrs = jsErrors.filter(e => /TypeError:|ReferenceError:/.test(e));
  ok('無 TypeError / ReferenceError', logicErrs.length === 0);
  if (logicErrs.length) console.log('    錯誤:\n    ' + logicErrs.slice(0, 3).join('\n    '));
  // Vue 模板未暴露變數會噴 warn: "Property "xxx" was accessed during render but is not defined"
  const undefWarns = vueWarns.filter(s => /was accessed during render but is not defined|Failed to resolve component|is not defined on instance/.test(s));
  ok('無「模板存取未定義變數」Vue 警告', undefWarns.length === 0);
  if (undefWarns.length) console.log('    警告:\n    ' + undefWarns.slice(0, 5).join('\n    '));

  if (!vm) { finish(); return; }

  // 建立角色 + 選定 + 進入 characters view（本地世界 → 可套用 HP）。
  const ch = w.DND5E_CHAR.defaultChar();
  ch.name = 'QA骰俠'; ch.hp = { current: 20, max: 30, temp: 0 };
  vm.chars = [ch];
  vm.selectedCharId = ch.id;
  vm.currentView = 'worlds';   // 擲骰器 UI 位於 currentView==='worlds' 的世界卡
  vm.selectedWorldKey = vm.LOCAL_WORLD_ID;

  vm.$nextTick(() => setTimeout(() => {
    ok('本地世界 sessionMode=local', vm.sessionMode === 'local');
    ok('canApplyHp=true（local 可套用）', vm.canApplyHp === true);

    const h1 = doc.getElementById('app').innerHTML;
    ok('本地擲骰器 UI 渲染（含「本地擲骰器」標題）', /本地擲骰器/.test(h1));
    ok('快捷骰按鈕渲染（含 1d20）', /1d20/.test(h1));
    ok('世界卡模式徽章渲染（🏠 本地單人）', /本地單人/.test(h1));
    ok('一鍵套用 HP 區塊渲染', /一鍵套用 HP/.test(h1));

    // 擲骰（注入不可能，改用 rollQuick 走真實 Math.random）→ 檢查落帳 records.log kind=dice
    const wpBefore = ch.worldProgress && ch.worldProgress[vm.LOCAL_WORLD_ID];
    const logBefore = (wpBefore && wpBefore.records && wpBefore.records.log) ? wpBefore.records.log.length : 0;
    const res = vm.rollQuick('1d20');
    ok('rollQuick 回傳結構化結果(total 1..20)', res && res.total >= 1 && res.total <= 20);
    const wpAfter = ch.worldProgress[vm.LOCAL_WORLD_ID];
    const log = wpAfter.records.log;
    ok('擲骰落帳 records.log +1', log.length === logBefore + 1);
    ok('戰報 kind=dice', log[0].kind === 'dice');
    ok('lastResult 已更新', vm.diceState.lastResult && vm.diceState.lastResult.total === res.total);

    // 一鍵套用 HP：從骰值當傷害 → hp.current 下降、走 reactive
    const hpBefore = ch.hp.current;
    vm.applyHpFromDice(-1);
    vm.$nextTick(() => setTimeout(() => {
      ok('applyHpFromDice(-1) 扣血（hp 下降或 clamp 0）', ch.hp.current === Math.max(0, hpBefore - res.total));
      ok('HP 變更寫戰報 kind=hp', wpAfter.records.log[0].kind === 'hp');

      // 驗證走 decomposeC → instance.version_m bump（本地權威）
      setTimeout(() => {
        const insts = JSON.parse(w.localStorage.getItem('dnd_instances_v2') || '{}');
        const inst = insts[ch.id + '@' + vm.LOCAL_WORLD_ID];
        ok('instance 已持久化到 dnd_instances_v2', !!inst);
        ok('version_m 已 bump(>1，因 hp 機制欄變更)', inst && inst.version_m > 1);
        ok('worldProgress 戰報已持久化(含 dice/hp log)', inst && inst.worldProgress &&
          inst.worldProgress[vm.LOCAL_WORLD_ID] && inst.worldProgress[vm.LOCAL_WORLD_ID].records.log.length >= 2);
        finish();
      }, 120);
    }, 60));
  }, 120));

  function finish() {
    console.log('\n================ QA 結果 (jsdom 動態) ================');
    console.log('PASS: ' + pass + '  FAIL: ' + fail);
    if (fail) { console.log('失敗:\n - ' + fails.join('\n - ')); process.exit(1); }
    console.log('✅ 全部通過');
    process.exit(0);
  }
}, 900);
