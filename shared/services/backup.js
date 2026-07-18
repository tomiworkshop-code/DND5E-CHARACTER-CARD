/* shared/services/backup.js
 * D&D 5E V2 資料備份 service（跨端共用）。
 * 從 v2/app.js 的 export/import 抽出「純資料組裝/解析」部分：
 *   - buildBackupPayload(getItem)：產生匯出用的 JSON 物件（不做檔案下載，UI 端負責 Blob/anchor）。
 *   - parseBackupPayload(text)   ：解析並驗證匯入文字，回傳標準化的 data 物件（不寫 localStorage）。
 * 行為與原 inline 版本完全一致（純重構，行為零變化）。
 * 注意：合併式匯入為 TC-04 範疇，本模組「不改匯入行為」，只抽純函式。
 * 掛在單一全域 window.DND5E_BACKUP，避免污染命名空間。
 *
 * 依賴（call-time 解析，可選）：
 *   - window.DND5E_STORE.LS：LocalStorage key 常數（缺省時退回字面 key，保持相容）。
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

  global.DND5E_BACKUP = {
    buildBackupPayload: buildBackupPayload,
    parseBackupPayload: parseBackupPayload
  };
})(typeof window !== "undefined" ? window : this);
