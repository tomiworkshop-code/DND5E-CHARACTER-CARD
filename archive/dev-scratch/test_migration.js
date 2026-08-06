// 驗證舊版 dnd_chars 資料能被 v2 的 migrateToV2 正確遷移
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('v2/index.html', 'utf8');

// 舊版格式：dnd_chars = 陣列 of char；dnd_active = characterId
const oldChars = [
  { id: 'c_test_1', name: '測試戰士阿強', race: '半獸人', avatar: 'https://x/a.png',
    classes: [{ name: '戰士', level: 5 }], abilities: { str: 16 } },
  { id: 'c_test_2', name: '測試法師小美', race: '精靈',
    classes: [{ name: '法師', level: 3 }] }
];

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable',
  url: 'file://' + __dirname + '/v2/index.html',
  beforeParse(window) {
    const _store = {
      'dnd_chars': JSON.stringify(oldChars),
      'dnd_active': 'c_test_2'
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (k) => (k in _store ? _store[k] : null),
      setItem: (k, v) => { _store[k] = String(v); },
      removeItem: (k) => { delete _store[k]; },
      clear: () => { for (const k in _store) delete _store[k]; }
    }});
    window.fetch = async () => ({ ok: true, json: async () => [], text: async () => '[]' });
  }
});

setTimeout(() => {
  const w = dom.window;
  const ident = JSON.parse(w.localStorage.getItem('dnd_identities_v2') || '[]');
  const names = ident.map(i => i.name || (i.identity && i.identity.name)).filter(Boolean);
  console.log('遷移後 identities 數量:', ident.length);
  console.log('遷移後角色名稱:', JSON.stringify(names));
  const ok = ident.length >= 2 && JSON.stringify(names).includes('阿強') && JSON.stringify(names).includes('小美');
  console.log(ok ? '✅ 舊角色資料遷移成功' : '❌ 遷移失敗，資料可能遺失');
  process.exit(ok ? 0 : 1);
}, 1500);
