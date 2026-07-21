/* test_dmv2_step3_ui.js
 * 敘事者之書 DM v2 — Step 3.1 開房 UI 冒煙（jsdom 真載 index.html + app.js）：
 *  - 注入 mock firebase（initializeApp/auth/database）+ mock QRCode，讓 initFirebase 真的 ready。
 *  - 建一個 dm_owner 世界 + 一個 quest + 一個紀元 → 切到「開團」分頁。
 *  - 呼叫 vm.openRoom() → roomId 產生、mock db 寫入 meta（worldId/questId/eraId）、QR 有渲染。
 *  - 呼叫 vm.closeRoom() → roomId 清空、meta/status = closed。
 * 驗證 UI 層與 room.js 串接（不連真 firebase）。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('worldbuilder-v2/index.html', 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713', name); } else { fail++; console.log('  \u2717', name); } }

/* ---- mock firebase（compat 形狀）：以路徑樹狀 store 記錄寫入 ---- */
function makeFirebaseMock() {
  const store = {};
  const db = {
    _store: store,
    ref: function (p) {
      return {
        set: function (v) { store[p] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); },
        get: function () {
          const val = store[p];
          return Promise.resolve({ exists: function () { return val !== undefined; }, val: function () { return val === undefined ? null : val; } });
        },
        push: function (v) { store[p] = (store[p] || []); store[p].push(v); return Promise.resolve({ key: 'k' + store[p].length }); },
        on: function () {}, off: function () {}, remove: function () { return Promise.resolve(); }
      };
    }
  };
  const auth = { signInAnonymously: function () { return Promise.resolve({ user: { uid: 'dm_test_uid' } }); } };
  const firebase = {
    apps: [],
    initializeApp: function (cfg) { firebase.apps.push({ cfg: cfg }); return { name: '[DEFAULT]' }; },
    app: function () { return { name: '[DEFAULT]' }; },
    auth: function () { return auth; },
    database: function () { return db; }
  };
  return { firebase, db };
}

/* mock QRCode：記錄被呼叫過（渲染到容器） */
function makeQRCodeMock(calls) {
  return function QRCode(el, opts) { calls.push({ el: el, opts: opts }); if (el) el.setAttribute('data-qr-rendered', '1'); };
}

function boot(sharedStore, fbMock, qrCalls) {
  return new Promise((resolve, reject) => {
    const jsErrors = [];
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      resources: 'usable',
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
      if (Date.now() - t0 > 8000) return reject(new Error('vm 未就緒；errors: ' + jsErrors.join(' | ')));
      setTimeout(wait, 30);
    })();
  });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  console.log('DM v2 Step 3.1 開房 UI 冒煙：');
  const shared = {};
  const fbMock = makeFirebaseMock();
  const qrCalls = [];
  const { dom, vm, jsErrors } = await boot(shared, fbMock, qrCalls);

  /* 以 mock 取代真 firebase/QRCode，並重新 init（fb 重新指向 mock 的 auth/db） */
  dom.window.firebase = fbMock.firebase;
  dom.window.QRCode = makeQRCodeMock(qrCalls);
  vm.retryFirebase();
  await delay(20);

  ok('firebase 已就緒 (firebaseReady, mock)', vm.firebaseReady === true);

  /* 建世界 + quest + 紀元（走 dmv2: adapter） */
  vm.newWorldName = '測試邊境';
  vm.addWorld();
  await delay(30);
  ok('世界已建立並選定', !!vm.activeWorld && vm.activeWorld.name === '測試邊境');

  /* 建一個紀元（成為 currentEra） */
  vm.newEraName = '第一紀元';
  vm.addEra();
  await delay(30);
  ok('currentEraId 已設定', !!vm.currentEraId);
  const eraId = vm.currentEraId;

  /* 建一個 quest entity */
  vm.worldsetView = 'quest';
  vm.openAddEntity('quest');
  vm.editingEntity.name = '尋找失落神殿';
  vm.saveEntity();
  await delay(30);
  ok('quest 出現在 worldQuests', vm.worldQuests.length === 1);
  const questId = vm.worldQuests[0].id;

  /* 切到開團分頁，選任務，開房 */
  vm.goTab('session');
  vm.sessionQuestId = questId;
  await delay(20);
  await vm.openRoom();
  await delay(50);

  ok('roomId 已產生 (5碼)', typeof vm.roomId === 'string' && vm.roomId.length === 5);
  const metaKey = 'rooms/' + vm.roomId + '/meta';
  const meta = fbMock.db._store[metaKey];
  ok('mock db 寫入 meta', !!meta);
  ok('meta.worldId = 當前世界', meta && meta.worldId === vm.activeWorldId);
  ok('meta.questId = 選定任務', meta && meta.questId === questId);
  ok('meta.eraId = currentEra（獨立一軸）', meta && meta.eraId === eraId);
  ok('meta.dmId = 匿名登入 uid', meta && meta.dmId === 'dm_test_uid');
  ok('QR 已渲染（QRCode 被呼叫）', qrCalls.length >= 1);
  ok('QR 內容為玩家 join URL 帶 ?room=', qrCalls.length >= 1 && /\?room=/.test(qrCalls[qrCalls.length - 1].opts.text));

  /* 關房 */
  await vm.closeRoom();
  await delay(50);
  ok('關房後 roomId 清空', vm.roomId === '');
  ok('meta/status = closed', fbMock.db._store[metaKey + '/status'] === 'closed');

  /* 自由團（不綁任務） */
  vm.sessionQuestId = '';
  await vm.openRoom();
  await delay(50);
  const meta2 = fbMock.db._store['rooms/' + vm.roomId + '/meta'];
  ok('自由團 meta 無 questId 鍵', meta2 && !('questId' in meta2));

  console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('測試異常：', e); process.exit(1); });
