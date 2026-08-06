/* test_dmv2_scaffold.js
 * 敘事者之書 DM v2 地基冒煙測試（Step 2a 後更新）：
 *  - 頁面掛載無 JS 錯誤
 *  - 五個導覽分頁殼存在（landing/開團/世界設定/指令/設定）
 *  - 預設進入 landing（世界儀表板）
 *  - 共用腳本就緒檢查不報錯
 *  - 世界列表實功能：新增一筆並成為 active world
 * shared/* 由 resources:'usable' 真實載入；firebase CDN 可能離線失敗，
 * 但 app.js 對 firebase 已 try/catch，故不影響本測試。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('worldbuilder-v2/index.html', 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713', name); } else { fail++; console.log('  \u2717', name); } }

const jsErrors = [];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + __dirname + '/worldbuilder-v2/index.html',
  beforeParse(window) {
    const _store = {};
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (k) => (k in _store ? _store[k] : null),
      setItem: (k, v) => { _store[k] = String(v); },
      removeItem: (k) => { delete _store[k]; },
      clear: () => Object.keys(_store).forEach((k) => delete _store[k])
    }});
    window.addEventListener('error', (e) => { jsErrors.push(String(e.message || e.error)); });
    const _cerr = window.console.error;
    window.console.error = function () {
      jsErrors.push(Array.from(arguments).map(String).join(' '));
    };
    void _cerr;
  }
});

setTimeout(() => {
  const w = dom.window, doc = w.document, vm = w.__vm;

  ok('Vue 根實例掛載成功 (window.__vm)', !!vm);
  ok('掛載期間無 JS / Vue 錯誤', jsErrors.length === 0);
  if (jsErrors.length) console.log('    errors:', jsErrors.slice(0, 5));

  const appHtml = doc.getElementById('app') ? doc.getElementById('app').innerHTML : '';

  // 標題（版本徽章文字含「敘事者之書」）
  ok('標題「敘事者之書」存在', appHtml.includes('敘事者之書'));

  // 五個分頁殼
  ok('分頁定義為 5 個', vm && Array.isArray(vm.tabs) && vm.tabs.length === 5);
  ['landing', 'session', 'worldset', 'command', 'settings'].forEach((k) => {
    ok('分頁 key 存在：' + k, vm && vm.tabs.some((t) => t.key === k));
  });

  // 預設進入 landing
  ok('預設分頁為 landing', vm && vm.currentTab === 'landing');

  // 共用腳本就緒檢查
  ok('DND5E_CHAR 就緒', !!w.DND5E_CHAR && vm.ready.char === true);
  ok('DND5E_STORE 就緒', !!w.DND5E_STORE && vm.ready.store === true);
  ok('DND5E_ROOM 就緒', !!w.DND5E_ROOM && vm.ready.room === true);
  ok('sharedError 無錯誤', vm && vm.sharedError === '');

  // 世界列表實功能：新增一筆並切換 active
  vm.newWorldName = '測試世界一';
  vm.newWorldNote = '冒煙測試建立';
  vm.addWorld();

  vm.$nextTick(() => setTimeout(() => {
    ok('新增世界後 worlds 至少 1 筆', vm.worlds.length >= 1);
    const created = vm.worlds.find((x) => x.name === '測試世界一');
    ok('新增的世界存在且 type=dm', !!created && created.type === 'dm');
    ok('新增的世界標記 role=dm_owner', !!created && created.role === 'dm_owner');
    ok('新增後成為 active world', !!created && vm.activeWorldId === created.id);
    ok('STORE.loadWorlds 可讀回剛建立的世界',
      Array.isArray(w.DND5E_STORE.loadWorlds()) &&
      w.DND5E_STORE.loadWorlds().some((x) => x.name === '測試世界一'));

    console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
    process.exit(fail ? 1 : 0);
  }, 60));
}, 2500);
