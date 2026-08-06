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
  const handlers = {};   /* path -> { event -> [cb] } */
  const db = {
    _store: store,
    /* 對外：模擬 RTDB 推播（觸發某 path 的某事件 handler） */
    _emit: function (p, event, val) {
      const h = handlers[p] && handlers[p][event];
      if (h) h.forEach(function (cb) { cb({ val: function () { return val; }, exists: function () { return val !== undefined && val !== null; }, key: 'k' }); });
    },
    ref: function (p) {
      return {
        set: function (v) { store[p] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); },
        get: function () {
          const val = store[p];
          return Promise.resolve({ exists: function () { return val !== undefined; }, val: function () { return val === undefined ? null : val; } });
        },
        push: function (v) { store[p] = (store[p] || []); store[p].push(v); return Promise.resolve({ key: 'k' + store[p].length }); },
        on: function (event, cb) { handlers[p] = handlers[p] || {}; (handlers[p][event] = handlers[p][event] || []).push(cb); return cb; },
        off: function (event, cb) { if (handlers[p] && handlers[p][event]) handlers[p][event] = handlers[p][event].filter(function (x) { return x !== cb; }); },
        remove: function () { return Promise.resolve(); }
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

  /* ---- Step 3.2 Roster：模擬玩家入座推播 ---- */
  vm.sessionQuestId = questId;
  await vm.openRoom();
  await delay(50);
  const playersPath = 'rooms/' + vm.roomId + '/players';
  fbMock.db._emit(playersPath, 'value', {
    pidA: { name: '阿強', level: 3, characterId: 'cA', joinedAt: 100, hp: { current: 20, max: 24 }, ac: 16,
      full: { race: '矮人', alignment: '中立', profBonus: 2, abilities: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 9 },
        passivePerception: 12, saves: [{ key: 'str', zh: '力量', value: 5, prof: true }],
        skills: [{ zh: '運動', attr: 'str', value: 5, proficient: true, expertise: false }],
        familiars: [{ name: '熊', type: '野獸', ac: 11, hp: { current: 10, max: 10 }, notes: '' }],
        inventory: [{ name: '戰锨', qty: 1, equipped: true }], narrative: { appearance: '高大', backstory: '' } } },
    pidB: { name: '小美', level: 2, characterId: 'cB', joinedAt: 200, hp: { current: 8, max: 8 }, ac: 12 }  /* 無 full（舊版） */
  });
  await delay(30);
  ok('rosterList 收到 2 人', vm.rosterList.length === 2);
  ok('roster 依 joinedAt 排序（阿強在前）', vm.rosterList[0].name === '阿強');
  ok('roster 卡帶 pid', !!vm.rosterList[0].pid);

  /* ---- Step 3.4 落地備份 ---- */
  ok('playerRecords 落地 2 筆', vm.playerRecords.length === 2);
  ok('備份以 characterId 為鍵', vm.playerRecords.every(function (r) { return !!r.characterId; }));
  ok('備份落在 dmv2: 命名空間 (playerSaves)', /playerSaves/.test(shared['dmv2:dnd_worlds_v2'] || ''));
  ok('玩家版世界 key 未被污染', !('dnd_worlds_v2' in shared));

  vm.openPlayerDetail(vm.rosterList[0]);
  await delay(10);
  ok('點卡開詳情抽尜', !!vm.selectedPlayer && vm.selectedPlayer.name === '阿強');
  ok('詳情帶 full（完整資料）', !!vm.selectedPlayer.full && vm.selectedPlayer.full.passivePerception === 12);

  /* 即時更新：玩家 HP 變動 → 選中快照跟隨 */
  fbMock.db._emit(playersPath, 'value', {
    pidA: { name: '阿強', level: 3, characterId: 'cA', joinedAt: 100, hp: { current: 5, max: 24 }, ac: 16, full: { passivePerception: 12 } },
    pidB: { name: '小美', level: 2, characterId: 'cB', joinedAt: 200, hp: { current: 8, max: 8 }, ac: 12 }
  });
  await delay(20);
  ok('抽尜跟隨即時 HP（20→5）', vm.selectedPlayer && vm.selectedPlayer.hp.current === 5);

  /* HP 變動 → 備份 latest 更新 + 舊版進 history */
  const recA = vm.playerRecords.find(function (r) { return r.characterId === 'cA'; });
  ok('cA latest 更新為 HP5', recA && recA.latest && recA.latest.hp.current === 5);
  ok('cA history 記下前一版 (>=1)', recA && recA.history && recA.history.length >= 1);
  ok('history 欄位精簡 (ts/level/hp)', recA && recA.history[0] && typeof recA.history[0].ts === 'number' && 'level' in recA.history[0] && 'hp' in recA.history[0]);

  /* ---- Step 3.3 提案 → 定案（房間仍開著） ---- */
  ok('初始未定案 charSaveFor(cA)=null', vm.charSaveFor('cA') === null);
  vm.adoptProposal(vm.rosterList[0]);   /* 阿強 cA */
  await delay(20);
  const csA = vm.charSaveFor('cA');
  ok('採納後 charSaves 有 cA (adopted)', !!csA && csA.source === 'adopted');
  ok('採納落 dmv2 (charSaves)', /charSaves/.test(shared['dmv2:dnd_worlds_v2'] || ''));
  ok('採納不回送（saves/cA 未寫）', !fbMock.db._store['rooms/' + vm.roomId + '/saves/cA']);

  vm.openEditFinalize(vm.rosterList[0]);
  await delay(10);
  ok('編輯表單開啟并帶入 cA', vm.editForm.open === true && vm.editForm.characterId === 'cA');
  vm.editForm.hp.current = 12; vm.editForm.hp.max = 30; vm.editForm.ac = 18;
  const pushed = vm.submitEditFinalize();
  await delay(20);
  const savePath = 'rooms/' + vm.roomId + '/saves/cA';
  const sentSave = fbMock.db._store[savePath];
  ok('定案回送 setSave 到 saves/cA', !!sentSave);
  ok('回送為最小 partial（僅 hp/ac/_sync，無 skills/inventory）',
    sentSave && sentSave.hp && sentSave.ac === 18 && sentSave._sync && !('skills' in sentSave) && !('inventory' in sentSave) && !('familiars' in sentSave));
  ok('partial hp 含 temp（不掉 temp）', sentSave && 'temp' in sentSave.hp);
  ok('version_m 前進 (>=1)', sentSave._sync.version_m >= 1);
  ok('表單送出後關閉', vm.editForm.open === false);
  const csA2 = vm.charSaveFor('cA');
  ok('canon 更新為 edited + AC18', csA2 && csA2.source === 'edited' && csA2.ac === 18);
  ok('roster 徒變已定案後 charSaveFor 非空', !!vm.charSaveFor('cA'));

  /* 玩家記錄分頁 → 開備份詳情（帶 _record + 歷史） */
  vm.goTab('players');
  vm.openPlayerRecord(recA);
  await delay(10);
  ok('玩家記錄開抽尜帶 _record', vm.selectedPlayer && vm.selectedPlayer._record && vm.selectedPlayer._record.characterId === 'cA');

  vm.closePlayerDetail();
  await delay(10);
  ok('關抽尜 selectedPlayer = null', vm.selectedPlayer === null);

  /* 關房 → roster 清空、退訂；但備份應持久化保留（供恢復） */
  await vm.closeRoom();
  await delay(30);
  ok('關房後 rosterList 清空', vm.rosterList.length === 0);
  ok('關房後 playerRecords 仍保留（備份不消失）', vm.playerRecords.length === 2);

  /* 自由團（不綁任務） */
  vm.sessionQuestId = '';
  await vm.openRoom();
  await delay(50);
  const meta2 = fbMock.db._store['rooms/' + vm.roomId + '/meta'];
  ok('自由團 meta 無 questId 鍵', meta2 && !('questId' in meta2));

  console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('測試異常：', e); process.exit(1); });
