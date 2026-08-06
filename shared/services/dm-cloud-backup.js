/* shared/services/dm-cloud-backup.js
 * 敘事者之書 DM V2 — DM 個人雲備份/還原 service。全域 window.DND5E_DM_CLOUD。
 * 框架無關；沿用既有 firebase compat db（DND5E_AUTH.getDb 拿到的閉包）。
 *
 * ⚠️ 與玩家版不同構：DM 資料模型豐富（世界/條目/NPC/怪物/任務/模板…），且全部落在
 *   localStorage 的 "dmv2:" 前綴命名空間內（見 worldbuilder-v2/app.js §6）。故本 service
 *   不重用玩家版 DND5E_BACKUP 的角色打包格式，改採【整個 dmv2: 命名空間快照】確保不漏。
 *
 * 節點（見 dnd-google-auth-cloud-backup-plan §3；規則 §5 users/{uid} 已就緒）：
 *   users/{uid}/dm_backup/payload : buildDmPayload() 整包 {__type,__version,exportedAt,appVersion,device,data}
 *   users/{uid}/dm_backup/meta    : {__version, exportedAt, appVersion, device, counts:{worlds,entries,...}}
 *
 * 安全鐵律：
 *   - uid 一律取自 DND5E_AUTH.currentUid()；未登入不可呼叫（saveToCloud/loadFromCloud 直接 reject）。
 *   - R4 防誤救回：本 service 提供 applyPayloadToLocal（覆蓋式還原）與 buildDmPayload（保險快照），
 *     但「還原前先做本地保險快照 + 下載 + 確認」的流程由 UI 負責串接。loadFromCloud 只回傳解析結果，不落地。
 *
 * 為可單元測試：db / uid / storage / getItem 皆可由參數注入（可 mock，全程不觸網）。
 */
(function (global) {
  "use strict";

  var DEFAULT_PREFIX = "dmv2:";

  /* 解析 storage：優先參數注入（測試），否則用瀏覽器 localStorage。 */
  function _resolveStorage(opts) {
    if (opts && opts.storage) return opts.storage;
    try {
      if (typeof global !== "undefined" && global.localStorage) return global.localStorage;
    } catch (e) { /* 隱私模式存取被拒 */ }
    return null;
  }

  /* 解析 db：優先參數注入（測試），否則沿用 DND5E_AUTH 持有的閉包 db。 */
  function _resolveDb(opts) {
    if (opts && opts.db) return opts.db;
    if (global.DND5E_AUTH && typeof global.DND5E_AUTH.getDb === "function") { return global.DND5E_AUTH.getDb(); }
    return null;
  }

  /* 解析 uid：優先參數注入（測試），否則一律取自 DND5E_AUTH.currentUid()。 */
  function _resolveUid(opts) {
    if (opts && opts.uid) return opts.uid;
    if (global.DND5E_AUTH && typeof global.DND5E_AUTH.currentUid === "function") { return global.DND5E_AUTH.currentUid(); }
    return null;
  }

  function _prefix(opts) { return (opts && opts.prefix) || DEFAULT_PREFIX; }

  /* 列舉 storage 內所有 key（相容真實 localStorage 的 length/key(i) 與 mock 純物件）。 */
  function _enumKeys(storage) {
    if (!storage) return [];
    var keys = [];
    try {
      if (typeof storage.length === "number" && typeof storage.key === "function") {
        for (var i = 0; i < storage.length; i++) {
          var k = storage.key(i);
          if (k !== null && k !== undefined) keys.push(k);
        }
        return keys;
      }
    } catch (e) { /* fallthrough */ }
    /* mock / 純物件：優先自訂列舉，否則 Object.keys。 */
    try {
      if (typeof storage.keys === "function") { return storage.keys(); }
      return Object.keys(storage);
    } catch (e2) { return []; }
  }

  /* 裝置識別（僅供 meta 顯示/除錯，截斷避免過長）。 */
  function _device() {
    try {
      var ua = (global.navigator && global.navigator.userAgent) ? String(global.navigator.userAgent) : "unknown";
      return ua.length > 160 ? ua.slice(0, 160) : ua;
    } catch (e) { return "unknown"; }
  }

  /* 把 snapshot（compat）或原值安全取出 value。 */
  function _snapVal(snap) {
    if (snap && typeof snap.val === "function") { return snap.val(); }
    return snap;
  }

  /* users/{uid}/dm_backup 節點路徑。 */
  function _base(uid) { return "users/" + uid + "/dm_backup"; }

  /* 掃描 storage 所有以 prefix（預設 "dmv2:"）開頭的 key，整包打成 payload。
   * data 的 key 為【完整 dmv2: key】→ value 原字串（不做二次 JSON.parse，保原樣）。
   * opts: { storage?, prefix?, appVersion?, device? }。 */
  function buildDmPayload(opts) {
    opts = opts || {};
    var storage = _resolveStorage(opts);
    var prefix = _prefix(opts);
    var data = {};
    if (storage) {
      var keys = _enumKeys(storage);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (typeof k === "string" && k.indexOf(prefix) === 0) {
          var v = null;
          try { v = storage.getItem(k); } catch (e) { v = null; }
          if (v !== null && v !== undefined) { data[k] = v; }
        }
      }
    }
    return {
      __type: "dnd5e-dm-backup",
      __version: 1,
      exportedAt: new Date().toISOString(),
      appVersion: opts.appVersion || (global.APP_VERSION || ""),
      device: opts.device || _device(),
      data: data
    };
  }

  /* 由 payload.data（完整 dmv2: key→原字串）粗估數量，供 meta / UI 對照顯示。 */
  function countData(data, prefix) {
    prefix = prefix || DEFAULT_PREFIX;
    var counts = { worlds: 0, entries: 0, templates: 0, keys: 0 };
    if (!data || typeof data !== "object") return counts;
    try { counts.keys = Object.keys(data).length; } catch (e) {}
    /* 世界與其內嵌條目（NPC/任務/線索/地點/事件/遭遇…皆存於世界物件 entities）。 */
    try {
      var worldsRaw = data[prefix + "dnd_worlds_v2"];
      var worlds = worldsRaw ? JSON.parse(worldsRaw) : [];
      if (Array.isArray(worlds)) {
        counts.worlds = worlds.length;
        for (var i = 0; i < worlds.length; i++) {
          var w = worlds[i];
          if (w && Array.isArray(w.entities)) counts.entries += w.entities.length;
        }
      }
    } catch (e) { /* 粗估失敗不阻斷 */ }
    /* 訊息模板庫。 */
    try {
      var tplRaw = data[prefix + "dnd_templates_v2"];
      var tpl = tplRaw ? JSON.parse(tplRaw) : null;
      if (Array.isArray(tpl)) counts.templates = tpl.length;
      else if (tpl && Array.isArray(tpl.templates)) counts.templates = tpl.templates.length;
    } catch (e) {}
    return counts;
  }

  /* 備份到雲端：buildDmPayload → 寫 payload + meta。
   * opts: { db?, uid?, storage?, prefix?, appVersion?, device? }
   * 回傳 Promise<{ ok, uid, meta, payload }>。 */
  function saveToCloud(opts) {
    opts = opts || {};
    var uid = _resolveUid(opts);
    if (!uid) { return Promise.reject(new Error("尚未登入，無法備份到雲端")); }
    var db = _resolveDb(opts);
    if (!db || typeof db.ref !== "function") { return Promise.reject(new Error("雲端連線未就緒（請先登入並連線）")); }

    var prefix = _prefix(opts);
    var payload = buildDmPayload(opts);
    var meta = {
      __version: payload.__version,
      exportedAt: payload.exportedAt,
      appVersion: payload.appVersion,
      device: payload.device,
      counts: countData(payload.data, prefix)
    };
    var base = _base(uid);
    return Promise.resolve(db.ref(base + "/payload").set(payload)).then(function () {
      return Promise.resolve(db.ref(base + "/meta").set(meta));
    }).then(function () {
      return { ok: true, uid: uid, meta: meta, payload: payload };
    });
  }

  /* 讀雲端 meta（供設定頁顯示「最後雲端同步」）。回傳 Promise<meta|null>。 */
  function loadMeta(opts) {
    opts = opts || {};
    var uid = _resolveUid(opts);
    if (!uid) { return Promise.resolve(null); }
    var db = _resolveDb(opts);
    if (!db || typeof db.ref !== "function") { return Promise.resolve(null); }
    return Promise.resolve(db.ref(_base(uid) + "/meta").get()).then(function (snap) {
      return _snapVal(snap) || null;
    }).catch(function () { return null; });
  }

  /* 從雲端讀回 payload，【只回傳解析結果，不落地】—— 由 UI 決策（含保險快照/確認）後才寫入。
   * opts: { db?, uid?, storage?, prefix? }
   * 回傳 Promise<{ found, payload?, cloud?, local? }>；
   *   cloud/local = { exportedAt, counts } 供 UI 對照顯示。found=false 表雲端尚無備份。 */
  function loadFromCloud(opts) {
    opts = opts || {};
    var uid = _resolveUid(opts);
    if (!uid) { return Promise.reject(new Error("尚未登入，無法從雲端還原")); }
    var db = _resolveDb(opts);
    if (!db || typeof db.ref !== "function") { return Promise.reject(new Error("雲端連線未就緒（請先登入並連線）")); }

    var prefix = _prefix(opts);
    var base = _base(uid);
    return Promise.resolve(db.ref(base + "/payload").get()).then(function (snap) {
      var raw = _snapVal(snap);
      if (raw === null || raw === undefined || raw === "") {
        return { found: false };
      }
      /* payload 可能是物件（RTDB 存物件）或 JSON 字串 → 統一成物件。 */
      var payload = (typeof raw === "string") ? JSON.parse(raw) : raw;
      var cloudData = (payload && payload.data) ? payload.data : {};
      var localPayload = buildDmPayload({ storage: _resolveStorage(opts), prefix: prefix });
      return {
        found: true,
        payload: payload,
        cloud: { exportedAt: payload && payload.exportedAt, appVersion: payload && payload.appVersion, counts: countData(cloudData, prefix) },
        local: { exportedAt: localPayload.exportedAt, appVersion: localPayload.appVersion, counts: countData(localPayload.data, prefix) }
      };
    });
  }

  /* 覆蓋式還原：以 payload.data 寫回 dmv2: 命名空間。
   *   ① 先移除「不在雲端 payload 內」的既有 dmv2: key（確保狀態一致，無殘留）；
   *   ② 再逐 key 寫入雲端內容。
   * ⚠️ 呼叫前 UI 務必已做本地保險快照（R4）。opts: { storage?, prefix? }。
   * 回傳 { ok, applied, removed }。 */
  function applyPayloadToLocal(payload, opts) {
    opts = opts || {};
    var storage = _resolveStorage(opts);
    var prefix = _prefix(opts);
    if (!storage) { throw new Error("無可用 storage，無法還原"); }
    var data = (payload && payload.data) ? payload.data : {};

    var existing = _enumKeys(storage).filter(function (k) {
      return typeof k === "string" && k.indexOf(prefix) === 0;
    });
    var removed = 0;
    for (var i = 0; i < existing.length; i++) {
      var ek = existing[i];
      if (!Object.prototype.hasOwnProperty.call(data, ek)) {
        try { storage.removeItem(ek); removed++; } catch (e) {}
      }
    }
    var applied = 0;
    var dkeys = Object.keys(data);
    for (var j = 0; j < dkeys.length; j++) {
      var dk = dkeys[j];
      /* 安全：只寫回 dmv2: 前綴 key，避免污染其他命名空間。 */
      if (dk.indexOf(prefix) !== 0) continue;
      try { storage.setItem(dk, data[dk]); applied++; } catch (e) {}
    }
    return { ok: true, applied: applied, removed: removed };
  }

  global.DND5E_DM_CLOUD = {
    buildDmPayload: buildDmPayload,
    countData: countData,
    saveToCloud: saveToCloud,
    loadMeta: loadMeta,
    loadFromCloud: loadFromCloud,
    applyPayloadToLocal: applyPayloadToLocal,
    /* 輔助（debug/測試） */
    _device: _device,
    _enumKeys: _enumKeys
  };
})(typeof window !== "undefined" ? window : this);
