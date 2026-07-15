/* shared/room.js
 * D&D 5E — Firebase Realtime「牌桌 (room)」連線核心（Step B / §3.1 資料契約）。
 * 框架無關；瀏覽器端依賴全域 firebase compat SDK（firebase-app / -auth / -database）。
 * db 一律以參數傳入（firebase.database() 或相容 mock），方便單元測試。
 * 掛在單一全域 window.DND5E_ROOM，避免污染命名空間。
 *
 * §3.1 通道：
 *   rooms/{roomId}/meta                 : {dmId, worldId, createdAt, status}
 *   rooms/{roomId}/broadcast/[]         : {from, text, ts}      DM 寫、全體讀
 *   rooms/{roomId}/inbox/{pid}/[]       : {from, text, ts}      DM 寫、該玩家+DM 讀
 *   rooms/{roomId}/commands/{pid}/[]    : {type, ..., ts}       DM 寫、該玩家讀
 *   rooms/{roomId}/fx/[]                : {type, target, ts}    DM 寫、依 target 讀
 *   rooms/{roomId}/players/{pid}        : {Tier1 快照}           玩家本人寫
 *   rooms/{roomId}/requests/{pid}/[]    : {kind, ..., ts}        玩家 push、DM 讀/刪（請求通道）
 */
(function(global){
  /* 房號字母表：去除易混淆字元 I L O 0 1，5 碼 ≈ 28.6M 組合，口述/手打友善。 */
  const ROOM_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  function genRoomId(len){
    len = len || 5;
    let s = "";
    for(let i = 0; i < len; i++){
      s += ROOM_ID_ALPHABET.charAt(Math.floor(Math.random() * ROOM_ID_ALPHABET.length));
    }
    return s;
  }

  /* 房號正規化：轉大寫、去空白，並把使用者可能誤打的 0/1 對映回 O→(無)/... 這裡採嚴格：只轉大寫去空白。 */
  function normRoomId(s){
    return String(s == null ? "" : s).trim().toUpperCase().replace(/\s+/g, "");
  }

  /* 瀏覽器端初始化（compat SDK）。回傳 {app, auth, db}。 */
  function init(config){
    if(typeof firebase === "undefined"){ throw new Error("Firebase SDK 未載入"); }
    const app = (firebase.apps && firebase.apps.length) ? firebase.app() : firebase.initializeApp(config);
    return { app: app, auth: firebase.auth(), db: firebase.database() };
  }

  /* 匿名登入 → 解析出 uid（= playerId / dmId）。 */
  function signInAnon(auth){
    return auth.signInAnonymously().then(function(cred){ return cred.user.uid; });
  }

  /* DM 開房：寫 meta，回傳 roomId。roomId 省略則自動產生。 */
  function createRoom(db, opts){
    opts = opts || {};
    const roomId = normRoomId(opts.roomId) || genRoomId();
    const meta = {
      dmId: opts.dmId || null,
      worldId: opts.worldId || "",
      createdAt: Date.now(),
      status: "open"
    };
    return db.ref("rooms/" + roomId + "/meta").set(meta).then(function(){ return roomId; });
  }

  /* 讀房間 meta（玩家加入前確認房間存在）。回傳 meta 物件或 null。 */
  function roomMeta(db, roomId){
    return db.ref("rooms/" + normRoomId(roomId) + "/meta").get().then(function(snap){
      return snap && snap.exists && snap.exists() ? snap.val() : (snap ? snap.val() : null);
    });
  }

  /* 遞迴清除 undefined：Firebase RTDB set/push 對任何 undefined 值都會整包拒絕。
   * 物件→刪掉值為 undefined 的鍵；陣列→把 undefined 元素轉 null（保留索引）。 */
  function pruneUndef(v){
    if(Array.isArray(v)){ return v.map(function(x){ return x === undefined ? null : pruneUndef(x); }); }
    if(v && typeof v === "object"){
      const o = {};
      for(const k in v){
        if(Object.prototype.hasOwnProperty.call(v, k)){
          const val = pruneUndef(v[k]);
          if(val !== undefined){ o[k] = val; }
        }
      }
      return o;
    }
    return v;
  }

  /* 玩家加入：寫自己的 players/{pid} 快照（Tier1）。 */
  function joinRoom(db, roomId, playerId, snapshot){
    const data = pruneUndef(Object.assign({ joinedAt: Date.now() }, snapshot || {}));
    return db.ref("rooms/" + normRoomId(roomId) + "/players/" + playerId).set(data).then(function(){ return true; });
  }

  /* DM 廣播訊息（全體）。 */
  function sendBroadcast(db, roomId, from, text){
    return db.ref("rooms/" + normRoomId(roomId) + "/broadcast").push({
      from: from || "dm", text: String(text == null ? "" : text), ts: Date.now()
    });
  }

  /* 訂閱廣播（child_added）。cb 收到 {_key, from, text, ts}。回傳退訂函式。 */
  function onBroadcast(db, roomId, cb){
    const ref = db.ref("rooms/" + normRoomId(roomId) + "/broadcast");
    const handler = ref.on("child_added", function(snap){
      cb(Object.assign({ _key: snap.key }, snap.val()));
    });
    return function(){ ref.off("child_added", handler); };
  }

  /* DM 對單一玩家私訊（inbox）。 */
  function sendInbox(db, roomId, playerId, from, text){
    return db.ref("rooms/" + normRoomId(roomId) + "/inbox/" + playerId).push({
      from: from || "dm", text: String(text == null ? "" : text), ts: Date.now()
    });
  }

  /* 訂閱自己的 inbox。回傳退訂函式。 */
  function onInbox(db, roomId, playerId, cb){
    const ref = db.ref("rooms/" + normRoomId(roomId) + "/inbox/" + playerId);
    const handler = ref.on("child_added", function(snap){
      cb(Object.assign({ _key: snap.key }, snap.val()));
    });
    return function(){ ref.off("child_added", handler); };
  }

  /* DM 對單一玩家送出「指令」（commands/{pid}）。cmd 形如 {type:'damage'|'heal'|'gold'|'xp', amount, note}。 */
  function sendCommand(db, roomId, playerId, cmd){
    const payload = pruneUndef(Object.assign({}, cmd, { ts: Date.now() }));
    return db.ref("rooms/" + normRoomId(roomId) + "/commands/" + playerId).push(payload);
  }

  /* 玩家訂閱自己的指令佇列（child_added）。cb 收到 {_key, type, amount, note, ts}。回傳退訂函式。 */
  function onCommand(db, roomId, playerId, cb){
    const ref = db.ref("rooms/" + normRoomId(roomId) + "/commands/" + playerId);
    const handler = ref.on("child_added", function(snap){
      cb(Object.assign({ _key: snap.key }, snap.val()));
    });
    return function(){ ref.off("child_added", handler); };
  }

  /* 訂閱隊伍名單 players/*（DM 用，即時總覽）。回傳退訂函式。 */
  function onPlayers(db, roomId, cb){
    const ref = db.ref("rooms/" + normRoomId(roomId) + "/players");
    const handler = ref.on("value", function(snap){ cb(snap.val() || {}); });
    return function(){ ref.off("value", handler); };
  }

  /* 世界存檔通道 rooms/{id}/saves/{characterId}（DM 權威中央存檔，§M3-2）。
   * 節點本身即可當 mergeInstance 的 remote：機制欄位攤在頂層 + _sync:{version_m,version_n}。 */
  /* DM 寫入/覆蓋某角色的世界存檔。 */
  function setSave(db, roomId, characterId, save){
    return db.ref("rooms/" + normRoomId(roomId) + "/saves/" + characterId).set(pruneUndef(save));
  }

  /* 讀取某角色的世界存檔（不存在→ null）。 */
  function getSave(db, roomId, characterId){
    return db.ref("rooms/" + normRoomId(roomId) + "/saves/" + characterId).get().then(function(snap){
      return snap && snap.exists && snap.exists() ? snap.val() : null;
    });
  }

  /* 訂閱某角色的世界存檔變動（value）。cb 收到 save 物件或 null。回傳退訂函式。 */
  function onSave(db, roomId, characterId, cb){
    const ref = db.ref("rooms/" + normRoomId(roomId) + "/saves/" + characterId);
    const handler = ref.on("value", function(snap){ cb(snap && snap.exists && snap.exists() ? snap.val() : null); });
    return function(){ ref.off("value", handler); };
  }

  /* 請求通道 rooms/{id}/requests/{pid}（玩家→DM，加法式）：玩家 push 請求，DM 讀/刪。
   * req 形如 {kind:'ask'|'add', itemName?, name?, qty?, reason?}。 */
  /* 玩家送出一筆請求（自動附 ts）。 */
  function sendRequest(db, roomId, playerId, req){
    return db.ref("rooms/" + normRoomId(roomId) + "/requests/" + playerId).push(pruneUndef(Object.assign({}, req, { ts: Date.now() })));
  }

  /* 訂閱全房請求 requests/*（DM 用，即時總覽）。cb 收到 {pid:{key:req}} 物件。回傳退訂函式。 */
  function onRequests(db, roomId, cb){
    const ref = db.ref("rooms/" + normRoomId(roomId) + "/requests");
    const handler = ref.on("value", function(snap){ cb(snap.val() || {}); });
    return function(){ ref.off("value", handler); };
  }

  /* DM 處理完一筆請求後刪除（requests/{pid}/{reqKey}）。 */
  function resolveRequest(db, roomId, playerId, reqKey){
    return db.ref("rooms/" + normRoomId(roomId) + "/requests/" + playerId + "/" + reqKey).remove();
  }

  global.DND5E_ROOM = {
    ROOM_ID_ALPHABET, genRoomId, normRoomId,
    init, signInAnon,
    createRoom, roomMeta, joinRoom,
    sendBroadcast, onBroadcast,
    sendInbox, onInbox, onPlayers,
    sendCommand, onCommand,
    setSave, getSave, onSave,
    sendRequest, onRequests, resolveRequest
  };
})(typeof window !== "undefined" ? window : this);
