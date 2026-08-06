// P2-B jsdom 掛載煙霧：無白屏、無 JS 錯誤、未按加入前不連線、請求/衝突 UI 存在。
const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('v2/index.html', 'utf8');
const consoleErrors = [];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + __dirname + '/v2/index.html',
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
    const origErr = window.console.error;
    window.console.error = (...args) => {
      consoleErrors.push(args.map(a => (a && a.stack) ? a.stack : String(a)).join(' '));
      origErr.apply(window.console, args);
    };
    window.fetch = async (url) => {
      let file = '{}';
      if (url.includes('core-rules.json')) file = fs.readFileSync('data/core-rules.json', 'utf8');
      else if (url.includes('classes.json')) file = fs.readFileSync('data/classes.json', 'utf8');
      else if (url.includes('items.json')) file = fs.readFileSync('data/items.json', 'utf8');
      else if (url.includes('spells.json')) file = fs.readFileSync('data/spells.json', 'utf8');
      else if (url.includes('sources.json')) file = fs.readFileSync('data/sources.json', 'utf8');
      else if (url.includes('races.json')) file = fs.readFileSync('data/races.json', 'utf8');
      return { ok: true, json: async () => JSON.parse(file) };
    };
  }
});

let pass = 0, fail = 0;
function ok(name, cond){ if(cond){ pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } }

setTimeout(() => {
  const doc = dom.window.document;
  const appEl = doc.getElementById('app');
  const appText = (appEl && appEl.textContent) || '';
  const appHtml = (appEl && appEl.innerHTML) || '';
  const errJoined = consoleErrors.filter(e => /TypeError:|ReferenceError:/.test(e)).join('\n');

  ok('無 TypeError / ReferenceError（app 邏輯）', !errJoined);
  ok('Vue 掛載（非白屏）', appText.includes('冒險') && !appHtml.includes('VUE ERROR'));

  setTimeout(() => {
    const h = (doc.getElementById('app') || {}).innerHTML || '';
    // 未按加入前不連線：「連線後才有」的元素不存在（衝突卡片 / 等待訊息 / 已連線房號列）。
    ok('未連線時無「等待 DM 訊息」等連線後 UI', !/等待 DM 訊息/.test(h));
    ok('未連線時無衝突卡片', !/存檔版本衝突/.test(h));
    ok('可見冒險生涯內容（Vue 正常渲染 dashboard）', /冒險/.test(appText));

    // 請求/衝突 UI 存在於模板（連線後才 render，靜態驗證模板已備妥）。
    const src = fs.readFileSync('v2/index.html', 'utf8');
    ok('模板含「提問」請求通道 (kind:ask)', /reqText/.test(src) && /kind: 'ask'/.test(src));
    ok('模板含「新增物品」請求表單 (kind:add)', /請求新增物品/.test(src) && /submitAddRequest/.test(src));
    ok('模板含衝突差異表（conflictDiff）', /conflictDiff/.test(src) && /DM 存檔/.test(src));
    ok('模板含採用DM / 保留本機按鈕', /resolveConflict\('adopt_dm'\)/.test(src) && /resolveConflict\('keep_local'\)/.test(src));

    ok('掛載後仍無 app 邏輯 JS 錯誤', !consoleErrors.some(e => /TypeError:|ReferenceError:/.test(e)));

    console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
    process.exit(fail ? 1 : 0);
  }, 500);
}, 3500);
