/* test_dmv2_shell.js
 * 敘事者之書 DM v2 — Step 2a 外殼重構驗證：
 *  §9.1 world-landing 主畫面 + 佔位入口卡（NPC/任務/線索/地點/事件/世界設定）
 *  §9.2 右上「換世界」切換器（點擊開世界浮動選單；單步清單 + 新增世界）
 *  §9.3 版本徽章在選單面板底部、且不在 header
 *  §9.4 圖示按鈕系統（導覽/主要動作用圖示）
 *  §6   切換/新增世界仍走 dmv2: 前綴命名空間（不破壞隔離）
 * shared/* 由 resources:'usable' 真實載入。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('worldbuilder-v2/index.html', 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713', name); } else { fail++; console.log('  \u2717', name); } }

const jsErrors = [];
let rawStore = null;

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + __dirname + '/worldbuilder-v2/index.html',
  beforeParse(window) {
    const _store = {};
    rawStore = _store; // 供測試檢查底層落地 key（驗證 dmv2: 前綴）
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (k) => (k in _store ? _store[k] : null),
      setItem: (k, v) => { _store[k] = String(v); },
      removeItem: (k) => { delete _store[k]; },
      clear: () => Object.keys(_store).forEach((k) => delete _store[k])
    }});
    window.addEventListener('error', (e) => { jsErrors.push(String(e.message || e.error)); });
    window.console.error = function () {
      jsErrors.push(Array.from(arguments).map(String).join(' '));
    };
  }
});

setTimeout(() => {
  const w = dom.window, doc = w.document, vm = w.__vm;

  ok('Vue 掛載成功且無 JS 錯誤', !!vm && jsErrors.length === 0);
  if (jsErrors.length) console.log('    errors:', jsErrors.slice(0, 5));

  const header = doc.querySelector('header');
  const headerHtml = header ? header.innerHTML : '';

  /* ---- §9.2 右上換世界切換器 ---- */
  const switcherBtn = doc.querySelector('[data-testid="world-switcher-btn"]');
  ok('header 內有「換世界」切換器按鈕', !!switcherBtn && header.contains(switcherBtn));
  ok('切換器按鈕含「換世界」語意（aria-label）',
    !!switcherBtn && switcherBtn.getAttribute('aria-label') === '換世界');

  /* ---- §9.3 版本徽章在選單面板底部、不在 header ---- */
  const versionBadge = doc.querySelector('[data-testid="version-badge"]');
  ok('版本徽章存在（選單面板）', !!versionBadge);
  ok('版本徽章文字含版本號', !!versionBadge && /Build/.test(versionBadge.textContent));
  ok('版本徽章不在 header 內',
    !!versionBadge && !!header && !header.contains(versionBadge));
  ok('header 不含版本字串（Build/vX）',
    !/Build/.test(headerHtml) && !/v2\.\d/.test(headerHtml));
  // 版本徽章隸屬選單面板（側欄 aside，md 以上顯示；DOM 內恆存在）
  const asideMenu = versionBadge && versionBadge.closest('aside');
  ok('版本徽章位於選單抽屜/側欄 (aside) 內', !!asideMenu);

  /* ---- §9.1 landing 佔位入口卡 ---- */
  ok('landing 為預設分頁', vm && vm.currentTab === 'landing');
  ok('entryCards 定義 6 張佔位卡', vm && Array.isArray(vm.entryCards) && vm.entryCards.length === 6);
  ['NPC', '任務', '線索', '地點', '事件', '世界設定'].forEach((label) => {
    ok('入口卡含：' + label, vm && vm.entryCards.some((e) => e.label === label));
  });
  // 尚無世界時 landing 顯示空狀態 + 建立第一個世界
  ok('無世界時顯示 landing 空狀態',
    !!doc.querySelector('[data-testid="landing-empty"]'));
  ok('空狀態含「建立第一個世界」按鈕',
    !!doc.querySelector('[data-testid="landing-create-first"]'));

  /* ---- 點擊切換器 → 開世界浮動選單 ---- */
  ok('初始換世界選單為關閉', vm && vm.switcherOpen === false);
  switcherBtn.click();

  vm.$nextTick(() => setTimeout(() => {
    ok('點擊切換器後 switcherOpen 為 true', vm.switcherOpen === true);
    ok('世界浮動選單 DOM 出現',
      !!doc.querySelector('[data-testid="world-switcher-menu"]'));
    ok('浮動選單含「新增世界」入口',
      !!doc.querySelector('[data-testid="switcher-add-world"]'));

    /* ---- §6 新增世界仍走 dmv2: 前綴 ---- */
    vm.switcherOpen = false;
    vm.newWorldName = '前綴驗證世界';
    vm.newWorldNote = 'shell 測試';
    vm.addWorld();

    vm.$nextTick(() => setTimeout(() => {
      const created = vm.worlds.find((x) => x.name === '前綴驗證世界');
      ok('新增世界成功', !!created);
      ok('新增世界標 role=dm_owner', !!created && created.role === 'dm_owner');
      ok('新增後成為 active world', !!created && vm.activeWorldId === created.id);

      const keys = Object.keys(rawStore);
      ok('底層有落地 key', keys.length >= 1);
      ok('世界資料落在 dmv2: 前綴 (dmv2:dnd_worlds_v2)', 'dmv2:dnd_worlds_v2' in rawStore);
      ok('active world 落在 dmv2: 前綴 (dmv2:dnd_active_world_v2)', 'dmv2:dnd_active_world_v2' in rawStore);
      ok('未污染無前綴 dnd_worlds_v2', !('dnd_worlds_v2' in rawStore));

      /* ---- landing 進入儀表板 + 入口卡渲染 ---- */
      ok('選定世界後 landing 顯示儀表板',
        !!doc.querySelector('[data-testid="landing-dashboard"]'));
      ok('landing 入口卡容器存在',
        !!doc.querySelector('[data-testid="landing-entry-cards"]'));

      /* ---- 點入口卡 → Step 2b 即將推出提示（不做 CRUD） ---- */
      vm.openEntry({ key: 'npc', label: 'NPC' });
      vm.$nextTick(() => setTimeout(() => {
        ok('點入口卡顯示「即將推出」提示', /即將推出/.test(vm.comingSoon));

        /* ---- 切換世界走 setActiveWorld（dmv2: adapter） ---- */
        vm.newWorldName = '第二世界';
        vm.addWorld();
        vm.$nextTick(() => setTimeout(() => {
          const w1 = vm.worlds.find((x) => x.name === '前綴驗證世界');
          vm.switchWorld(w1);
          ok('切換世界後 active 更新為目標世界', vm.activeWorldId === w1.id);
          ok('切換後仍透過 dmv2: 前綴儲存 active',
            rawStore['dmv2:dnd_active_world_v2'] === w1.id);

          console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
          process.exit(fail ? 1 : 0);
        }, 40));
      }, 40));
    }, 60));
  }, 60));
}, 2500);
