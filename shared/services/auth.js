/* shared/services/auth.js
 * D&D 5E — Google 登入模組（TC-A2）。全域 window.DND5E_AUTH。
 * 框架無關；瀏覽器端沿用既有 firebase compat SDK（firebase-app / -auth）+ DND5E_ROOM.init。
 * auth/db 一律以「initAuth 拿到的閉包」持有，不放進 Vue ref（Proxy 包 firebase 物件會壞）。
 * 為可單元測試：initAuth 接受 deps 注入（init / GoogleAuthProvider），全程可 mock、滴水不觸網。
 *
 * 登入策略（見 dnd-google-auth-cloud-backup-plan §2）：
 *   1) 匿名玩家 → currentUser.linkWithPopup(googleProvider)：把匿名 uid「升級」成 Google，uid 不變。
 *   2) 該 Google 已被綁過（auth/credential-already-in-use）→ signInWithCredential(err.credential) 切既有帳號。
 *   3) popup 被行動/PWA 擋（popup-blocked 等）→ fallback signInWithRedirect，並於 initAuth 以 getRedirectResult 收尾。
 * 安全鐵律 R3：本模組只做「登入」，不觸碰 / 覆蓋任何本地 identities/instances/worlds 資料。
 */
(function(global){
  /* ===== 閉包狀態（仿 fbApp：純閉包變數，不放 Vue ref） ===== */
  let _app = null;
  let _auth = null;
  let _db = null;
  let _provider = null;
  let _inited = false;

  /* 取得 GoogleAuthProvider 實例：可由 deps 注入（測試），否則用全域 firebase compat。 */
  function makeGoogleProvider(deps){
    if(deps && deps.googleProvider){ return deps.googleProvider; }
    const GP = (deps && deps.GoogleAuthProvider)
      || (global.firebase && global.firebase.auth && global.firebase.auth.GoogleAuthProvider);
    if(typeof GP !== "function"){ throw new Error("GoogleAuthProvider 未載入"); }
    return new GP();
  }

  /* popup 被瀏覽器/PWA 擋 → 需 fallback redirect 的錯誤碼集合。
   * 註：popup-closed-by-user（使用者主動關閉）不自動轉導，避免誤觸。 */
  function isPopupBlocked(code){
    return code === "auth/popup-blocked"
        || code === "auth/cancelled-popup-request"
        || code === "auth/operation-not-supported-in-this-environment"
        || code === "auth/web-storage-unsupported";
  }

  /* 初始化：沿用既有 firebase app 拿 {app,auth,db}，建立 GoogleAuthProvider，並收尾 redirect 登入。
   * config：firebaseConfig（同 room.js）。deps：{ init?, GoogleAuthProvider?, googleProvider? } 供單測注入。
   * 回傳 Promise<{app,auth,db,redirectResult}>。redirectResult 為 fallback redirect 回來的結果或 null。 */
  function initAuth(config, deps){
    deps = deps || {};
    const initFn = deps.init || (global.DND5E_ROOM && global.DND5E_ROOM.init);
    if(typeof initFn !== "function"){ throw new Error("initAuth 需要 DND5E_ROOM.init 或 deps.init"); }
    const fb = initFn(config);
    _app = fb.app; _auth = fb.auth; _db = fb.db;
    _provider = makeGoogleProvider(deps);
    _inited = true;
    /* redirect fallback 收尾：行動/PWA 用 signInWithRedirect 後，回頁時在此接住結果。 */
    const p = (_auth && typeof _auth.getRedirectResult === "function")
      ? Promise.resolve(_auth.getRedirectResult()).catch(function(){ return null; })
      : Promise.resolve(null);
    return p.then(function(res){
      return { app: _app, auth: _auth, db: _db, redirectResult: res || null };
    });
  }

  /* Google 登入（三情境自動處理）。回傳 Promise<{mode, user}>。
   * mode: "link"（匿名升級）｜"popup"（一般登入）｜"switch-account"（切既有帳號）｜"redirect"（已轉導，user=null）。 */
  function signInGoogle(){
    if(!_auth){ return Promise.reject(new Error("尚未 initAuth")); }
    const provider = _provider;
    const user = _auth.currentUser;
    const isAnon = !!(user && user.isAnonymous);
    /* 匿名 → 優先 link（uid 不變）；非匿名/無使用者 → 一般 popup 登入。 */
    const attempt = (isAnon && typeof user.linkWithPopup === "function")
      ? user.linkWithPopup(provider)
      : _auth.signInWithPopup(provider);
    return Promise.resolve(attempt).then(function(cred){
      return { mode: isAnon ? "link" : "popup", user: (cred && cred.user) ? cred.user : _auth.currentUser };
    }).catch(function(err){
      const code = err && err.code;
      /* 該 Google 已被別的帳號綁過 → 切到既有帳號（本步不動本地資料，A3 才做 merge）。 */
      if(code === "auth/credential-already-in-use"){
        const cred = err && err.credential;
        return Promise.resolve(_auth.signInWithCredential(cred)).then(function(c){
          return { mode: "switch-account", user: (c && c.user) ? c.user : _auth.currentUser };
        });
      }
      /* popup 被行動/PWA 擋 → fallback redirect（回頁由 initAuth 的 getRedirectResult 收尾）。 */
      if(isPopupBlocked(code)){
        return Promise.resolve(_auth.signInWithRedirect(provider)).then(function(){
          return { mode: "redirect", user: null };
        });
      }
      throw err;
    });
  }

  /* 登出（本地資料保留，回到「未登入」；跑團仍可匿名）。 */
  function signOut(){
    if(!_auth){ return Promise.reject(new Error("尚未 initAuth")); }
    return Promise.resolve(_auth.signOut());
  }

  /* 訂閱登入狀態變化。cb 收到 firebase user 或 null。回傳退訂函式。 */
  function onAuthChanged(cb){
    if(!_auth){ throw new Error("尚未 initAuth"); }
    const unsub = _auth.onAuthStateChanged(cb);
    return (typeof unsub === "function") ? unsub : function(){};
  }

  /* 目前 uid（未登入→null）。 */
  function currentUid(){
    return (_auth && _auth.currentUser) ? _auth.currentUser.uid : null;
  }

  /* 目前 firebase user 物件（未登入→null）。UI 顯示請自行取純欄位，勿放進 Vue ref。 */
  function currentUser(){
    return (_auth && _auth.currentUser) ? _auth.currentUser : null;
  }

  /* 供 A3 雲備份沿用同一 db（讀 users/{uid}）。本步不使用。 */
  function getDb(){ return _db; }
  function isInited(){ return _inited; }

  global.DND5E_AUTH = {
    initAuth,
    signInGoogle,
    signOut,
    onAuthChanged,
    currentUid,
    currentUser,
    /* 輔助（非 TC-A2 六大介面）：供 A3 / debug */
    getDb, isInited
  };
})(typeof window !== "undefined" ? window : this);
