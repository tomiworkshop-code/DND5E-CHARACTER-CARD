/* archive/dev-scratch/test_step2_ui.js
 * 步驟 2 單元測試與 JSDOM UI 整合測試：職業資源與技能 UI 模組
 * 執行：node archive/dev-scratch/test_step2_ui.js
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '../..');
const VUE_LOCAL = '/tmp/vue.global.prod.js';

console.log('=== 🧪 開始執行步驟 2 職業資源 UI 模組測試 ===\n');

// 1. 純函數/引擎單元測試
const { deriveClassResources } = require(path.join(REPO, 'shared/class-resource-rules.js'));

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log('   ✅ ' + message);
    passCount++;
  } else {
    console.error('   ❌ ' + message);
    failCount++;
  }
}

console.log('1️⃣ 測試引擎純函數 (deriveClassResources)...');

const singleClassChar = {
  name: '單職戰士',
  abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
  classes: [
    { name_en: 'fighter', level: 3, subclass: 'battle_master', subclass_en: 'battle master' }
  ]
};

const derivedSingle = deriveClassResources(singleClassChar);
assert(derivedSingle.length === 3, '單職 3級戰術大師戰士導出 3 項資源 (二次風/行動湧浪/優勢骰)');
assert(derivedSingle.some(r => r.label.includes('二次風') && r.diceValue === '1d10+3'), '二次風骰式為 1d10+3');
assert(derivedSingle.some(r => r.label.includes('優勢骰') && r.max === 4), '優勢骰數量為 4');

const multiClassChar = {
  name: '兼職冒險者',
  abilities: { str: 14, dex: 16, con: 12, int: 10, wis: 14, cha: 10 },
  classes: [
    { name_en: 'fighter', level: 3, subclass: 'battle_master', subclass_en: 'battle master' },
    { name_en: 'monk', level: 2 }
  ]
};

const derivedMulti = deriveClassResources(multiClassChar);
assert(derivedMulti.length === 4, '多職業 (戰士 3 / 武僧 2) 導出 4 項資源 (二次風/行動湧浪/優勢骰/氣點)');
assert(derivedMulti.some(r => r.className === '武僧' && r.max === 2), '武僧氣點 max = 2');

console.log('\n2️⃣ 測試 JSDOM 動態掛載 v2/index.html 與 app.js 整合...');

if (!fs.existsSync(VUE_LOCAL)) {
  console.log('⚠️ 無 ' + VUE_LOCAL + '，跳過 JSDOM UI 測試。');
} else {
  let html = fs.readFileSync(path.join(REPO, 'v2/index.html'), 'utf8');
  html = html.replace(/https:\/\/unpkg\.com\/vue@3\/dist\/vue\.global\.prod\.js/, 'file://' + VUE_LOCAL);
  html = html.replace(/<script async src="https:\/\/www\.googletagmanager[^<]*<\/script>/g, '');
  html = html.replace(/<script[^>]*gtag\/js[^>]*><\/script>/g, '');

  assert(html.includes('shared/class-resource-rules.js'), 'v2/index.html 已引進 class-resource-rules.js 腳本');

  const vueWarns = [];
  const jsErrors = [];

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'file://' + path.join(REPO, 'v2', 'index.html'),
    beforeParse(window) {
      const _store = {};
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
          getItem: (k) => (k in _store ? _store[k] : null),
          setItem: (k, v) => { _store[k] = String(v); },
          removeItem: (k) => { delete _store[k]; },
          clear: () => { for (const k in _store) delete _store[k]; }
        }
      });
      window.alert = (msg) => { window._lastAlert = msg; };
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
      window.console.warn = (...a) => { vueWarns.push(a.map(String).join(' ')); };
      window.console.error = (...a) => { jsErrors.push(a.map(String).join(' ')); };
      window.fetch = async (url) => {
        const map = ['core-rules', 'classes', 'items', 'spells', 'sources', 'races'];
        for (const m of map) {
          if (url.includes(m + '.json')) {
            try { return { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(REPO, 'data', m + '.json'), 'utf8')) }; }
            catch (e) { return { ok: true, json: async () => ([]) }; }
          }
        }
        return { ok: true, json: async () => ({}) };
      };
    }
  });

  // 等待 window load & Vue setup 執行完成
  setTimeout(() => {
    const window = dom.window;
    const vm = window.__vm;

    assert(!!vm, 'Vue App 掛載成功 (window.__vm 存在)');
    assert(typeof window.deriveClassResources === 'function', 'window.deriveClassResources 全域純函數存在');

    // 建立一個兼職角色進行測試
    const testChar = {
      id: 'test_multi_1',
      name: '亞瑟',
      race: '人類',
      classes: [
        { name_en: 'fighter', level: 3, subclass: 'battle_master', subclass_en: 'battle master' },
        { name_en: 'monk', level: 2 }
      ],
      abilities: { str: 14, dex: 16, con: 12, int: 10, wis: 14, cha: 10 },
      hp: { current: 30, max: 30 },
      resources: []
    };

    vm.chars.push(testChar);
    vm.selectedCharId = testChar.id;

    // 手動或透過 watch 自動觸發 syncClassResources
    vm.syncClassResources(testChar);

    assert(testChar.resources.length === 4, 'syncClassResources 自動初始化 4 項職業資源到 selectedChar.resources');
    
    // 檢視標籤呈現
    const bmRes = testChar.resources.find(r => r.classKey === 'fighter' && (r.subclassName || r.label.includes('優勢骰')));
    const monkRes = testChar.resources.find(r => r.classKey === 'monk');
    assert(vm.getResourceBadge(bmRes).includes('戰士') && (vm.getResourceBadge(bmRes).includes('戰術') || vm.getResourceBadge(bmRes).includes('戰鬥')), '兼職資源正確標示子職業 [戰士 - 戰術大師/戰鬥大師]');
    assert(vm.getResourceBadge(monkRes) === '[武僧]', '兼職資源正確標示主職業 [武僧]');

    // 測試扣點與升級/再次 sync 時保持 current 剩餘點數
    monkRes.current = 1; // 原本 max=2，用掉1點氣
    vm.syncClassResources(testChar);
    assert(monkRes.current === 1, '再次同步資源時不蓋掉玩家已使用的當前剩餘點數 (current=1 保持不變)');

    // 測試骰子資源擲骰
    const secondWindRes = testChar.resources.find(r => r.label.includes('二次風'));
    assert(secondWindRes && secondWindRes.kind === 'dice', '二次風資源類型為 dice');
    vm.rollResourceDice(secondWindRes);
    assert(!!vm.diceState.lastResult, '點擊 [🎲 擲骰] 成功觸發既有擲骰機制 (diceState.lastResult 產生)');

    // 測試短休與長休重置
    monkRes.current = 0;
    vm.restResetResources('short');
    assert(monkRes.current === 2, '短休重置 (restResetResources) 成功將短休資源 (氣點) 恢復至 max=2');

    // 測試新增自訂資源
    vm.customResourceForm.label = '自訂護符';
    vm.customResourceForm.max = 3;
    vm.customResourceForm.reset = 'long';
    vm.addCustomResource();

    const customRes = testChar.resources.find(r => r.label === '自訂護符');
    assert(!!customRes && customRes.custom === true, '成功新增自訂資源到 selectedChar.resources');
    assert(vm.getResourceBadge(customRes) === '[自訂]', '自訂資源標籤顯示 [自訂]');

    console.log('\n================ 📊 測試結果彙整 ================');
    console.log(`通過: ${passCount} / 失敗: ${failCount}`);

    if (failCount === 0) {
      console.log('🎉 全部測試成功通過！ (All tests passed!)');
      process.exit(0);
    } else {
      console.error('❌ 存在失敗測試項！');
      process.exit(1);
    }
  }, 1000);
}
