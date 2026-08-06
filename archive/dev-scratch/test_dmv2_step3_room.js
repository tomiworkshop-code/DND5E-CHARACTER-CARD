/* test_dmv2_step3_room.js
 * 敘事者之書 DM v2 — Step 3.1 開房契約驗證（room.js 單元，記憶體 mock db）：
 *  §10.1② 開團 meta = worldId(必) + questId(可選) + eraId(獨立一軸) + dmId/createdAt/status。
 *  - createRoom：寫入 meta 帶 eraId；有 questId 才落鍵；自由團(無 questId) 不落空鍵。
 *  - setRoomStatus：只改 meta/status（關房），不動其餘欄位。
 *  - genRoomId/normRoomId：房號格式與正規化。
 * 純 room.js，不進瀏覽器；db 以最小 mock 提供 ref().set()/get()。
 */
const path = require('path');
const mod = require('./shared/room.js');
const ROOM = mod.DND5E_ROOM || global.DND5E_ROOM;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  \u2713', name); } else { fail++; console.log('  \u2717', name); } }

/* 最小 mock：以路徑為 key 的樹狀 store；ref(p).set(v)/get()。 */
function makeMockDb() {
  const store = {};
  return {
    _store: store,
    ref: function (p) {
      return {
        set: function (v) { store[p] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); },
        get: function () {
          const val = store[p];
          return Promise.resolve({ exists: function () { return val !== undefined; }, val: function () { return val === undefined ? null : val; } });
        }
      };
    }
  };
}

(async function () {
  console.log('DM v2 Step 3.1 開房契約：');
  ok('ROOM 已載入', !!ROOM && typeof ROOM.createRoom === 'function');
  ok('setRoomStatus 已匯出', typeof ROOM.setRoomStatus === 'function');

  /* 房號格式 */
  const rid = ROOM.genRoomId();
  ok('genRoomId 預設 5 碼', typeof rid === 'string' && rid.length === 5);
  ok('genRoomId 不含易混淆字元 I/L/O/0/1', !/[ILO01]/.test(rid));
  ok('normRoomId 轉大寫去空白', ROOM.normRoomId('  ab c 2 ') === 'ABC2');

  /* A. 綁任務開房：meta 帶 worldId + questId + eraId */
  {
    const db = makeMockDb();
    const code = await ROOM.createRoom(db, { dmId: 'dm1', worldId: 'w_x', questId: 'q_9', eraId: 'era_3', roomId: 'ROOM1', worldName: '三國演義', questName: '討伐黃巾賊', eraName: '黃巾之亂' });
    ok('createRoom 回傳指定房號', code === 'ROOM1');
    const meta = db._store['rooms/ROOM1/meta'];
    ok('meta.worldId 正確', meta && meta.worldId === 'w_x');
    ok('meta.questId 有落（綁任務）', meta && meta.questId === 'q_9');
    ok('meta.eraId 有落（獨立一軸）', meta && meta.eraId === 'era_3');
    ok('meta.worldName 有落（顯示用名字）', meta && meta.worldName === '三國演義');
    ok('meta.questName 有落', meta && meta.questName === '討伐黃巾賊');
    ok('meta.eraName 有落', meta && meta.eraName === '黃巾之亂');
    ok('meta.dmId 正確', meta && meta.dmId === 'dm1');
    ok('meta.status 初始 open', meta && meta.status === 'open');
    ok('meta.createdAt 為數字', meta && typeof meta.createdAt === 'number');
  }

  /* B. 自由團（無 questId）：不落空 questId 鍵，但 eraId 仍在 */
  {
    const db = makeMockDb();
    await ROOM.createRoom(db, { dmId: 'dm2', worldId: 'w_y', eraId: 'era_1', roomId: 'ROOM2' });
    const meta = db._store['rooms/ROOM2/meta'];
    ok('自由團 meta 無 questId 鍵', meta && !('questId' in meta));
    ok('自由團 eraId 仍在', meta && meta.eraId === 'era_1');
    ok('自由團無 worldName 鍵（未提供不落空）', meta && !('worldName' in meta));
  }

  /* C. 無 eraId（世界尚無紀元）：eraId 落空字串、不炸 */
  {
    const db = makeMockDb();
    await ROOM.createRoom(db, { dmId: 'dm3', worldId: 'w_z', roomId: 'ROOM3' });
    const meta = db._store['rooms/ROOM3/meta'];
    ok('無紀元世界 eraId 為空字串', meta && meta.eraId === '');
  }

  /* D. setRoomStatus 關房：只改 status */
  {
    const db = makeMockDb();
    await ROOM.createRoom(db, { dmId: 'dm4', worldId: 'w_a', questId: 'q_1', eraId: 'era_2', roomId: 'ROOM4' });
    await ROOM.setRoomStatus(db, 'ROOM4', 'closed');
    ok('setRoomStatus 寫入 meta/status = closed', db._store['rooms/ROOM4/meta/status'] === 'closed');
    const meta = db._store['rooms/ROOM4/meta'];
    ok('原 meta 其餘欄位未被動', meta && meta.worldId === 'w_a' && meta.questId === 'q_1' && meta.eraId === 'era_2');
  }

  /* E. roomMeta 讀回 */
  {
    const db = makeMockDb();
    await ROOM.createRoom(db, { dmId: 'dm5', worldId: 'w_b', eraId: 'era_x', roomId: 'ROOM5' });
    const meta = await ROOM.roomMeta(db, 'room5');   /* 小寫應正規化 */
    ok('roomMeta 讀回（房號正規化）', meta && meta.worldId === 'w_b' && meta.eraId === 'era_x');
  }

  console.log('\n結果：' + pass + ' 通過, ' + fail + ' 失敗');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('測試異常：', e); process.exit(1); });
