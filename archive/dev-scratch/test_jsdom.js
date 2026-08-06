const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('v2/index.html', 'utf8');

const consoleErrors = [];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + __dirname + '/v2/index.html',
  beforeParse(window) {
    // jsdom 在 file:// (opaque origin) 下不提供 localStorage，需自行 polyfill
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
    // 攔截 console.error 以捕捉 Vue / JS 執行期錯誤
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

setTimeout(() => {
  const appEl = dom.window.document.getElementById('app');
  const appText = (appEl && appEl.textContent) || '';
  const appHtml = (appEl && appEl.innerHTML) || '';
  const joined = consoleErrors.join('\n');

  const hasTypeError = /TypeError:/.test(joined);
  const hasRefError = /ReferenceError:/.test(joined);
  // 確認 Vue 有正常掛載（#app 應渲染出「冒險生涯摘要」等文字，而非錯誤畫面）
  const mounted = appText.includes('冒險') && !appHtml.includes('VUE ERROR');

  console.log('--- jsdom 測試結果 ---');
  console.log('TypeError:', hasTypeError ? '有 ✗' : '無 ✓');
  console.log('ReferenceError:', hasRefError ? '有 ✗' : '無 ✓');
  console.log('Vue 掛載:', mounted ? '成功 ✓' : '失敗 ✗');
  if (consoleErrors.length) {
    console.log('--- console.error 內容 ---');
    consoleErrors.forEach(e => console.log(e.split('\n')[0]));
  }
  process.exit((hasTypeError || hasRefError || !mounted) ? 1 : 0);
}, 3500);
