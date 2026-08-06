/* shared/services/cloud-backup.js
 * D&D 5E V2 — 個人雲備份/還原 service（TC-A3，手動 MVP）。全域 window.DND5E_CLOUD。
 * 框架無關；沿用既有 firebase compat db（DND5E_AUTH.getDb 拿到的閉包）+ DND5E_BACKUP 的
 * build/parse/merge，不另造格式（見 dnd-google-auth-cloud-backup-plan §3 資料模型、§4.1）。
 *
 * 節點（§3.1）：
 *   users/{uid}/backup/payload : buildBackupPayload() 產出的整包 {__type,__version,exportedAt,data}
 *   users/{uid}/backup/meta    : {schemaVer, __version, exportedAt, device, appVersion}
 *
 * 安全鐵律：
 *   - uid 一律取自 DND5E_AUTH.currentUid()；未登入不可呼叫（saveToCloud/loadFromCloud 直接 reject）。
 *   - R4 防誤救回：本 service 只「計算合併結果」，實際「還原前自動保險備份 + 落地寫入」由 UI 負責。
 *   - R3：mergeBackup 一律走 version-aware 合併（機制區 version_m、敘事區 version_n），不無腦覆蓋。
 *
 * 為可單元測試：db / uid / getItem / backup 皆可由參數注入（可 mock，全程不觸網）。
 */
(function(global){
  "use strict";

  /* 解析 db：優先參數注入（測試），否則沿用 DND5E_AUTH 持有的閉包 db。 */
  function _resolveDb(opts){
    if(opts && opts.db) return opts.db;
    if(global.DND5E_AUTH && typeof global.DND5E_AUTH.getDb === "function"){ return global.DND5E_AUTH.getDb(); }
    return null;
  }

  /* 解析 uid：優先參數注入（測試），否則一律取自 DND5E_AUTH.currentUid()。 */
  function _resolveUid(opts){
    if(opts && opts.uid) return opts.uid;
    if(global.DND5E_AUTH && typeof global.DND5E_AUTH.currentUid === "function"){ return global.DND5E_AUTH.currentUid(); }
    return null;
  }

  /* 解析 backup service（可注入 mock）。 */
  function _resolveBackup(opts){
    return (opts && opts.backup) || global.DND5E_BACKUP;
  }

  /* 預設 getItem：瀏覽器端用 localStorage；無則回 null（測試務必注入）。 */
  function _resolveGetItem(opts){
    if(opts && typeof opts.getItem === "function"){ return opts.getItem; }
    return function(k){ return (global.localStorage && global.localStorage.getItem) ? global.localStorage.getItem(k) : null; };
  }

  /* schemaVer LS key（沿用 store 集中常數，缺省退回字面值）。 */
  function _schemaVerKey(){
    var S = global.DND5E_STORE;
    return (S && S.LS && S.LS.SCHEMA_VER) || "dnd_schema_ver";
  }

  /* 裝置識別（僅供 meta 顯示/除錯，截斷避免過長）。 */
  function _device(){
    try {
      var ua = (global.navigator && global.navigator.userAgent) ? String(global.navigator.userAgent) : "unknown";
      return ua.length > 160 ? ua.slice(0, 160) : ua;
    } catch(e){ return "unknown"; }
  }

  /* 把 snapshot（compat）或原值安全取出 value。 */
  function _snapVal(snap){
    if(snap && typeof snap.val === "function"){ return snap.val(); }
    return snap;
  }

  /* users/{uid}/backup 節點路徑。 */
  function _base(uid){ return "users/" + uid + "/backup"; }

  /* 備份到雲端：buildBackupPayload → 寫 payload + meta。
   * opts: { db?, uid?, getItem?, backup?, appVersion?, device? }
   * 回傳 Promise<{ ok, uid, meta, payload }>。 */
  function saveToCloud(opts){
    opts = opts || {};
    var uid = _resolveUid(opts);
    if(!uid){ return Promise.reject(new Error("尚未登入，無法備份到雲端")); }
    var db = _resolveDb(opts);
    if(!db || typeof db.ref !== "function"){ return Promise.reject(new Error("雲端連線未就緒（請先登入並連線）")); }
    var BK = _resolveBackup(opts);
    if(!BK || typeof BK.buildBackupPayload !== "function"){ return Promise.reject(new Error("缺少 DND5E_BACKUP，無法組裝備份")); }

    var getItem = _resolveGetItem(opts);
    var payload = BK.buildBackupPayload(getItem);
    var meta = {
      schemaVer: getItem(_schemaVerKey()) || null,
      __version: payload.__version,
      exportedAt: payload.exportedAt,
      device: opts.device || _device(),
      appVersion: opts.appVersion || (global.APP_VERSION || "")
    };
    var base = _base(uid);
    return Promise.resolve(db.ref(base + "/payload").set(payload)).then(function(){
      return Promise.resolve(db.ref(base + "/meta").set(meta));
    }).then(function(){
      return { ok: true, uid: uid, meta: meta, payload: payload };
    });
  }

  /* 從雲端讀回並「計算」合併結果（不落地寫入 localStorage — 由 UI 負責保險備份後再寫）。
   * opts: { db?, uid?, getItem?, backup?, mergeOpts? }
   * 回傳 Promise<{ found, payload?, imported?, local?, merged?, conflicts? }>。
   *   found=false 表示雲端尚無備份。 */
  function loadFromCloud(opts){
    opts = opts || {};
    var uid = _resolveUid(opts);
    if(!uid){ return Promise.reject(new Error("尚未登入，無法從雲端還原")); }
    var db = _resolveDb(opts);
    if(!db || typeof db.ref !== "function"){ return Promise.reject(new Error("雲端連線未就緒（請先登入並連線）")); }
    var BK = _resolveBackup(opts);
    if(!BK || typeof BK.parseBackupPayload !== "function"){ return Promise.reject(new Error("缺少 DND5E_BACKUP，無法解析備份")); }

    var getItem = _resolveGetItem(opts);
    var base = _base(uid);
    return Promise.resolve(db.ref(base + "/payload").get()).then(function(snap){
      var payload = _snapVal(snap);
      if(payload === null || payload === undefined || payload === ""){
        return { found: false };
      }
      /* payload 可能是物件（RTDB 存物件）或 JSON 字串 → 統一給 parseBackupPayload（吃 text）。 */
      var text = (typeof payload === "string") ? payload : JSON.stringify(payload);
      var d = BK.parseBackupPayload(text);
      var imported = BK.extractCollections(d);
      var local = BK.readLocalCollections(getItem);
      var conflicts = (typeof BK.detectConflicts === "function") ? BK.detectConflicts(local, imported) : [];
      /* 預設自動合併（無使用者裁決）；UI 可改以 resolutions 重算。R3：merge 不無腦覆蓋。 */
      var merged = BK.mergeBackup(local, imported, (opts.mergeOpts || {}));
      return { found: true, payload: payload, imported: imported, local: local, conflicts: conflicts, merged: merged };
    });
  }

  /* 讀雲端 meta（供設定頁顯示「最後雲端同步」）。回傳 Promise<meta|null>。 */
  function loadMeta(opts){
    opts = opts || {};
    var uid = _resolveUid(opts);
    if(!uid){ return Promise.resolve(null); }
    var db = _resolveDb(opts);
    if(!db || typeof db.ref !== "function"){ return Promise.resolve(null); }
    return Promise.resolve(db.ref(_base(uid) + "/meta").get()).then(function(snap){
      return _snapVal(snap) || null;
    }).catch(function(){ return null; });
  }

  global.DND5E_CLOUD = {
    saveToCloud: saveToCloud,
    loadFromCloud: loadFromCloud,
    loadMeta: loadMeta,
    /* 輔助（debug/測試） */
    _device: _device
  };
})(typeof window !== "undefined" ? window : this);
