/* shared/services/backup.js
 * D&D 5E V2 資料備份 service（跨端共用）。
 * 從 v2/app.js 的 export/import 抽出「純資料組裝/解析」部分：
 *   - buildBackupPayload(getItem)：產生匯出用的 JSON 物件（不做檔案下載，UI 端負責 Blob/anchor）。
 *   - parseBackupPayload(text)   ：解析並驗證匯入文字，回傳標準化的 data 物件（不寫 localStorage）。
 * 行為與原 inline 版本完全一致（純重構，行為零變化）。
 *
 * TC-04（匯入升級）新增「version-aware merge」能力：
 *   - extractCollections(d) / readLocalCollections(getItem)：把備份/本機的四大 LS 欄位
 *     （identities / instances / worlds / activeWorld）解析成結構化集合。
 *   - detectConflicts(local, imported)：找出「本機已存在且版本號有差異」的角色（供 UI 提示）。
 *   - mergeStoredInstance(localInst, importedInst)：對單一存檔槽做版本感知合併，
 *     內部委派 window.DND5E_CHAR.mergeInstance()（機制區 DM 權威、敘事區玩家權威）。
 *   - mergeBackup(local, imported, opts)：合併整份備份（不再無腦 setItem 全覆蓋）。
 *   - filterCollectionsByCharacter(cols, characterId)：單角色匯入用。
 * 匯入 JSON 一律視為「另一來源（遠端）」，依 version_m/version_n 決定覆蓋方向。
 * 掛在單一全域 window.DND5E_BACKUP，避免污染命名空間。
 *
 * 依賴（call-time 解析）：
 *   - window.DND5E_STORE.LS：LocalStorage key 常數（缺省時退回字面 key，保持相容）。
 *   - window.DND5E_CHAR   ：mergeInstance / extractZone（合併時委派；merge 系列函式需要）。
 */
(function(global){
  "use strict";

  /* 取得 LS key（優先用 store 的集中常數，缺省退回字面值以保持完全相容） */
  function _lsKeys(){
    var S = global.DND5E_STORE;
    if(S && S.LS){
      return {
        IDENTITIES: S.LS.IDENTITIES,
        INSTANCES: S.LS.INSTANCES,
        WORLDS: S.LS.WORLDS,
        ACTIVE_WORLD: S.LS.ACTIVE_WORLD
      };
    }
    return {
      IDENTITIES: "dnd_identities_v2",
      INSTANCES: "dnd_instances_v2",
      WORLDS: "dnd_worlds_v2",
      ACTIVE_WORLD: "dnd_active_world_v2"
    };
  }

  /* 產生匯出用 payload 物件。getItem: (key)=>string|null（通常為 localStorage.getItem） */
  function buildBackupPayload(getItem){
    var K = _lsKeys();
    return {
      __type: "dnd5e_character_card_backup",
      __version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        dnd_identities_v2:   getItem(K.IDENTITIES),
        dnd_instances_v2:    getItem(K.INSTANCES),
        dnd_worlds_v2:       getItem(K.WORLDS),
        dnd_active_world_v2: getItem(K.ACTIVE_WORLD)
      }
    };
  }

  /* 解析 + 驗證匯入文字，回傳標準化的 data 物件（不寫入任何 storage）。
   * 驗證失敗時 throw Error（訊息與原 inline 行為一致）。 */
  function parseBackupPayload(text){
    var obj = JSON.parse(text);
    var d = (obj && obj.data && typeof obj.data === "object") ? obj.data : obj;
    if (!d || typeof d !== "object") throw new Error("檔案格式無效");
    if (!("dnd_identities_v2" in d) && !("dnd_instances_v2" in d) && !("dnd_worlds_v2" in d)) {
      throw new Error("找不到可還原的備份欄位");
    }
    return d;
  }

  /* ===== TC-04：version-aware merge 工具 ===== */

  function _clone(v){ return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  /* 把可能是「JSON 字串 / 已是物件 / null」的值安全解析成物件；失敗回 fallback。 */
  function _parseMaybe(v, fallback){
    if(v === null || v === undefined) return fallback;
    if(typeof v === "string"){
      var t = v.trim();
      if(!t) return fallback;
      try { return JSON.parse(t); } catch(e){ return fallback; }
    }
    if(typeof v === "object") return v;
    return fallback;
  }

  /* 從 parseBackupPayload 的回傳 d 取出結構化集合。 */
  function extractCollections(d){
    d = d || {};
    return {
      identities:  _parseMaybe(d.dnd_identities_v2, []) || [],
      instances:   _parseMaybe(d.dnd_instances_v2, {}) || {},
      worlds:      _parseMaybe(d.dnd_worlds_v2, null),
      activeWorld: (typeof d.dnd_active_world_v2 === "string") ? d.dnd_active_world_v2
                    : (d.dnd_active_world_v2 || null)
    };
  }

  /* 從本機（getItem，通常為 localStorage.getItem）讀出結構化集合。 */
  function readLocalCollections(getItem){
    var K = _lsKeys();
    return {
      identities:  _parseMaybe(getItem(K.IDENTITIES), []) || [],
      instances:   _parseMaybe(getItem(K.INSTANCES), {}) || {},
      worlds:      _parseMaybe(getItem(K.WORLDS), null),
      activeWorld: getItem(K.ACTIVE_WORLD) || null
    };
  }

  /* 取角色顯示名稱（優先 identity.name，退回 name / characterId）。 */
  function _nameFromIdentity(id){
    if(!id) return null;
    return (id.identity && id.identity.name) || id.name || id.characterId || null;
  }

  /* 把「store 版存檔槽 instance」攤平成 mergeInstance 可吃的 char-like 物件：
   *   - mechanical 區欄位攤到頂層（含 familiar，符合 FIELD_ZONES.mechanical）。
   *   - narrative 存的 notes 攤到頂層（narrative 區）。
   *   - _sync = { version_m, version_n }。 */
  function _flatFromInstance(inst){
    var flat = {};
    var m = inst && inst.mechanical ? inst.mechanical : {};
    Object.keys(m).forEach(function(k){ flat[k] = _clone(m[k]); });
    var n = inst && inst.narrative ? inst.narrative : {};
    if("notes" in n) flat.notes = _clone(n.notes);
    flat._sync = {
      version_m: (inst && inst.version_m) || 0,
      version_n: (inst && inst.version_n) || 0
    };
    return flat;
  }

  /* 對單一存檔槽做版本感知合併：local 為基，imported 視為遠端來源。
   * 委派 DND5E_CHAR.mergeInstance()：機制區 remote.version_m >= local → 覆蓋；
   * 敘事區 remote.version_n > local → 覆蓋。
   * 回傳 { instance, mechChanged, narrativeChanged }。 */
  function mergeStoredInstance(localInst, importedInst){
    var C = global.DND5E_CHAR;
    if(!C || typeof C.mergeInstance !== "function"){
      throw new Error("缺少 DND5E_CHAR.mergeInstance，無法進行版本感知合併");
    }
    var out = _clone(localInst) || {};
    if(!importedInst) return { instance: out, mechChanged:false, narrativeChanged:false };

    var lm = (localInst && localInst.version_m) || 0;
    var rm = (importedInst.version_m) || 0;
    var ln = (localInst && localInst.version_n) || 0;
    var rn = (importedInst.version_n) || 0;

    var flatLocal = _flatFromInstance(localInst || {});
    var flatRemote = _flatFromInstance(importedInst);
    var merged = C.mergeInstance(flatLocal, flatRemote);

    var mechWon = rm >= lm;               // 機制區：DM 權威，含「=」支援恢復
    var narrativeWon = rn > ln;           // 敘事區：玩家權威

    // 機制區結果（含 familiar）取自 merged 的 mechanical 區
    var mech = (typeof C.extractZone === "function")
      ? C.extractZone(merged, "mechanical")
      : (mechWon ? _clone(importedInst.mechanical) : _clone(localInst.mechanical));
    out.mechanical = Object.assign({}, (localInst && localInst.mechanical) || {}, mech);

    // 敘事區（本機 instance.narrative = { notes, familiar 敘事面 }）：整塊依版本取代
    if(narrativeWon){
      out.narrative = _clone(importedInst.narrative) || {};
    }

    // worldProgress（進度存檔槽）：跟隨機制區權威（DM 進度優先）
    if(mechWon && importedInst.worldProgress !== undefined){
      out.worldProgress = _clone(importedInst.worldProgress) || {};
    }

    out.version_m = (merged._sync && merged._sync.version_m) || Math.max(lm, rm);
    out.version_n = (merged._sync && merged._sync.version_n) || Math.max(ln, rn);
    out.updatedAt = Math.max((localInst && localInst.updatedAt) || 0,
                             importedInst.updatedAt || 0) || Date.now();
    // 補回結構鍵
    out.instanceId = out.instanceId || importedInst.instanceId;
    out.characterId = out.characterId || importedInst.characterId;
    out.worldId = out.worldId || importedInst.worldId;

    return { instance: out, mechChanged: mechWon, narrativeChanged: narrativeWon };
  }

  /* 找出「本機已存在、且版本號有差異」的角色（供 UI 衝突提示）。
   * 回傳陣列：[{ characterId, name, instances:[instanceId...], identityDiff:bool }]（以角色聚合）。 */
  function detectConflicts(localCols, importedCols){
    localCols = localCols || {}; importedCols = importedCols || {};
    var li = localCols.instances || {};
    var ii = importedCols.instances || {};
    var lIdById = {};
    (localCols.identities || []).forEach(function(id){ if(id && id.characterId) lIdById[id.characterId] = id; });
    var iIdById = {};
    (importedCols.identities || []).forEach(function(id){ if(id && id.characterId) iIdById[id.characterId] = id; });
    var nameOf = function(cid){
      return _nameFromIdentity(lIdById[cid]) || _nameFromIdentity(iIdById[cid]) || cid;
    };
    var byChar = {};
    var ensure = function(cid){
      if(!byChar[cid]) byChar[cid] = { characterId: cid, name: nameOf(cid), instances: [], identityDiff: false };
      return byChar[cid];
    };

    // identity 版本差異
    Object.keys(iIdById).forEach(function(cid){
      var lid = lIdById[cid];
      if(lid && (lid.version_n || 0) !== (iIdById[cid].version_n || 0)){
        ensure(cid).identityDiff = true;
      }
    });

    // instance 版本差異
    Object.keys(ii).forEach(function(key){
      var L = li[key], R = ii[key];
      if(!L) return;
      var lm = L.version_m || 0, rm = R.version_m || 0;
      var ln = L.version_n || 0, rn = R.version_n || 0;
      if(lm !== rm || ln !== rn){
        var cid = L.characterId || R.characterId || key;
        ensure(cid).instances.push(key);
      }
    });

    return Object.keys(byChar).map(function(c){ return byChar[c]; });
  }

  /* 只保留某角色的 identity + 其所有 instance（單角色匯入）。 */
  function filterCollectionsByCharacter(cols, characterId){
    cols = cols || {};
    var identities = (cols.identities || []).filter(function(id){ return id && id.characterId === characterId; });
    var instances = {};
    Object.keys(cols.instances || {}).forEach(function(key){
      var inst = cols.instances[key];
      if(inst && inst.characterId === characterId) instances[key] = inst;
    });
    return { identities: identities, instances: instances, worlds: cols.worlds, activeWorld: cols.activeWorld };
  }

  /* 合併整份備份（version-aware，非全覆蓋）。
   * opts:
   *   - resolutions: { [characterId]: 'overwrite' | 'keep' }  使用者對衝突角色的裁決；
   *       'overwrite' = 用備份整組覆蓋本機；'keep' = 保留本機；未指定 = 依版本自動合併。
   *   - onlyCharacterId: 只匯入指定角色（單角色匯入）。
   * 回傳合併後集合 { identities, instances, worlds, activeWorld }。 */
  function mergeBackup(localCols, importedCols, opts){
    opts = opts || {};
    localCols = localCols || {}; importedCols = importedCols || {};
    if(opts.onlyCharacterId){
      importedCols = filterCollectionsByCharacter(importedCols, opts.onlyCharacterId);
    }
    var res = opts.resolutions || {};

    // ----- identities -----
    var outIdent = _clone(localCols.identities || []) || [];
    var identIndex = {};
    outIdent.forEach(function(id, i){ if(id && id.characterId) identIndex[id.characterId] = i; });
    (importedCols.identities || []).forEach(function(rid){
      var cid = rid && rid.characterId;
      if(!cid) return;
      if(!(cid in identIndex)){
        outIdent.push(_clone(rid));
        identIndex[cid] = outIdent.length - 1;
        return;
      }
      var i = identIndex[cid];
      var lid = outIdent[i];
      var r = res[cid];
      if(r === "keep") return;
      if(r === "overwrite"){ outIdent[i] = _clone(rid); return; }
      // 敘事/身份 = 玩家權威：imported.version_n > local → 覆蓋
      if((rid.version_n || 0) > (lid.version_n || 0)) outIdent[i] = _clone(rid);
    });

    // ----- instances -----
    var outInst = _clone(localCols.instances || {}) || {};
    Object.keys(importedCols.instances || {}).forEach(function(key){
      var R = importedCols.instances[key];
      var L = outInst[key];
      if(!L){ outInst[key] = _clone(R); return; }
      var cid = L.characterId || R.characterId;
      var r = res[cid];
      if(r === "keep") return;
      if(r === "overwrite"){ outInst[key] = _clone(R); return; }
      outInst[key] = mergeStoredInstance(L, R).instance;
    });

    // ----- worlds（無版本機制：新增缺少的世界；既有一律保留本機定義以防蓋掉 DM 進度）-----
    var outWorlds = localCols.worlds ? (_clone(localCols.worlds) || []) : null;
    if(importedCols.worlds && importedCols.worlds.length){
      if(!outWorlds) outWorlds = [];
      var wIdx = {};
      outWorlds.forEach(function(w, i){ if(w && w.id) wIdx[w.id] = i; });
      importedCols.worlds.forEach(function(w){
        if(!w || !w.id) return;
        if(!(w.id in wIdx)){ outWorlds.push(_clone(w)); wIdx[w.id] = outWorlds.length - 1; }
      });
    }

    // ----- activeWorld：保留本機（沒有才用備份）-----
    var activeWorld = localCols.activeWorld || importedCols.activeWorld || null;

    return { identities: outIdent, instances: outInst, worlds: outWorlds, activeWorld: activeWorld };
  }

  global.DND5E_BACKUP = {
    buildBackupPayload: buildBackupPayload,
    parseBackupPayload: parseBackupPayload,
    extractCollections: extractCollections,
    readLocalCollections: readLocalCollections,
    detectConflicts: detectConflicts,
    mergeStoredInstance: mergeStoredInstance,
    filterCollectionsByCharacter: filterCollectionsByCharacter,
    mergeBackup: mergeBackup
  };
})(typeof window !== "undefined" ? window : this);
