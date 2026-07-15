/* shared/character-schema.js
 * D&D 5E 角色存檔 schema 契約（跨端共用）。
 * 由玩家版 index.html 抽出：defaultChar / defaultFamiliar / mergeChar，
 * 邏輯與原 inline 版本完全一致（純重構，行為零變化）。
 * 掛在單一全域 window.DND5E_CHAR，避免污染命名空間。
 *
 * 呼叫時依賴（由宿主頁面全域提供，call-time 解析）：
 *   - SKILLS：技能定義陣列（defaultChar 用）
 *   - uid()：角色唯一 id 產生器（defaultChar 用）
 */
(function(global){
  /* schema 版本常數
   *   1 = Step A 起始
   *   2 = 預埋 characterId/worldId 存檔槽欄位（Phase 3 前置，§5.6）
   *   3 = 預埋 mechanical/narrative 雙區 + version_m/version_n 同步骨架（§5.10C/D） */
  const SCHEMA_VERSION = 3;

  /* 欄位分區表（§5.10C/D）— 決定同步時「誰說了算」。
   * 採「加法式骨架」：不物理地把欄位嵌進已深雙物件（避免翻改整份 UI），
   * 而是用欄位名單 + 雙 version 追蹤權威，供 Step B 上雲同步/衝突解析直接取用。 */
  const FIELD_ZONES = {
    /* DM 權威（機制/戰力/遊戲狀態）— version_m */
    mechanical: [
      "speed","languages","proficiencies",
      "profArmor","profWeapon","profTool","profSaves",
      "ac","initiative","hp","abilities","abilityBonus","classes",
      "saves","skills","spellSlots","spellsText","spellbook",
      "inventory","coins","conditions","exhaustion",
      "deathSaves","inspiration","concentration","hitDiceUsed",
      "acHelper","resources","attacks","feats","familiar"
    ],
    /* 玩家權威（敘事/身份）— version_n */
    narrative: [
      "name","race","subrace","alignment","background","notes","story","avatar"
    ],
    /* 結構鍵（不參與版本比對） */
    meta: ["id","characterId","worldId","_sync"]
  };
  /* 創角選擇：進世界後鎖為唯讀基準（權威仍屬玩家/narrative，但鎖定） */
  const CREATION_LOCKED = ["race","subrace","background","abilities"];
  /* 雙面欄位：敘事面歸玩家、機制面歸 DM（骨架階段先歸 mechanical 託管以防 OP） */
  const DUAL_FACE = ["familiar","background","abilities"];

  function defaultFamiliar(){
    return {
      name:"", type:"", speed:"", ac:10,
      hp:{ current:1, max:1 },
      abilities:{ str:10, dex:10, con:10, int:10, wis:10, cha:10 },
      attacks:"", notes:""
    };
  }

  function defaultChar(){
    const skills = {};
    SKILLS.forEach(s => { skills[s.zh] = { proficient:false, override:null }; });
    return {
      id: uid(),
      /* 存檔槽定位（Phase 3 前置，§5.6）：
       *   characterId = 角色全域身份（同一角色跨世界共用，創角資料的權威來源）
       *   worldId     = 此存檔所屬世界（"" = 尚未連上任何世界，Phase 1 預設空）
       * 一個「角色 × 世界」= 一個存檔槽 (Character-Instance)。 */
      characterId: uid(),
      worldId:"",
      name:"", race:"", subrace:"", alignment:"", background:"", speed:"30 呎",
      languages:[], proficiencies:"", notes:"",
      profArmor:[], profWeapon:[], profTool:[], profSaves:{},
      ac:10, initiative:0,
      hp:{ current:10, max:10, temp:0 },
      abilities:{ str:10, dex:10, con:10, int:10, wis:10, cha:10 },
      abilityBonus:{ str:0, dex:0, con:0, int:0, wis:0, cha:0 },
      classes:[],
      saves:{ str:false, dex:false, con:false, int:false, wis:false, cha:false },
      skills,
      spellSlots: Array.from({length:9}, (_,i)=>({ level:i+1, max:0, used:0 })),
      spellsText:"",
      spellbook:[],
      inventory:[],
      coins:{ cp:0, sp:0, gp:0, pp:0 },
      conditions:{},
      exhaustion:0,
      /* 新增：跑團輔助與角色深度欄位 */
      deathSaves:{ success:0, fail:0 },
      inspiration:false,
      concentration:{ on:false, spell:"" },
      hitDiceUsed:0,
      acHelper:{ base:10, dexCap:"", shield:0, misc:0 },
      resources:[],
      attacks:[],
      feats:[],
      story:{ appearance:"", personality:"", ideals:"", bonds:"", flaws:"", allies:"", backstory:"" },
      avatar:"",
      familiar: null,
      /* 雙版本同步骨架（§5.10C）：機制區與敘事區各自單調遞增，
       * 改敘事不會誤觸機制覆蓋。Phase 1 都為 0，Step B 上雲時才開始遞增。 */
      _sync:{ version_m:0, version_n:0 }
    };
  }

  function mergeChar(base, saved){
    const out = JSON.parse(JSON.stringify(base));
    for(const k in saved){
      if(k==="skills"){
        for(const sk in saved.skills){ if(out.skills[sk]) out.skills[sk] = Object.assign(out.skills[sk], saved.skills[sk]); }
      } else if(k==="familiar"){
        if(saved.familiar && typeof saved.familiar === "object"){
          const f = defaultFamiliar();
          for(const fk in saved.familiar){
            if(fk==="hp" || fk==="abilities"){ f[fk] = Object.assign(f[fk]||{}, saved.familiar[fk]); }
            else { f[fk] = saved.familiar[fk]; }
          }
          out.familiar = f;
        } else { out.familiar = null; }
      } else if(typeof saved[k] === "object" && saved[k] !== null && !Array.isArray(saved[k])){
        out[k] = Object.assign(out[k]||{}, saved[k]);
      } else { out[k] = saved[k]; }
    }
    /* 向後相容回填（Phase 3 前置，§5.6）：
     * 舊存檔沒有 characterId → 用既有存檔 id 派生一個「穩定」的全域身份，
     * 避免每次載入都拿到 defaultChar() 新亂數而漂移。
     * worldId 缺省維持 ""（defaultChar 已提供），代表尚未綁定世界。 */
    if(!saved.characterId){ out.characterId = saved.id || out.id; }
    if(saved.worldId == null){ out.worldId = ""; }
    /* 雙版本同步骨架回填（§5.10C）：舊存檔無 _sync → 補 {0,0}。 */
    ensureSync(out);
    return out;
  }

  /* 確保 _sync 雙版本存在且為合法數字。 */
  function ensureSync(char){
    if(!char._sync || typeof char._sync !== "object"){ char._sync = { version_m:0, version_n:0 }; }
    if(typeof char._sync.version_m !== "number"){ char._sync.version_m = 0; }
    if(typeof char._sync.version_n !== "number"){ char._sync.version_n = 0; }
    return char._sync;
  }

  /* 抽出某一區的欄位快照（供上雲/匯出）。 */
  function extractZone(char, zone){
    const keys = FIELD_ZONES[zone] || [];
    const out = {};
    keys.forEach(k => { if(char && (k in char)){ out[k] = JSON.parse(JSON.stringify(char[k])); } });
    return out;
  }

  /* 把某一區的欄位套回角色（供下雲/匯入）。 */
  function applyZone(char, zone, data){
    const keys = FIELD_ZONES[zone] || [];
    keys.forEach(k => { if(data && (k in data)){ char[k] = JSON.parse(JSON.stringify(data[k])); } });
    return char;
  }

  /* 衝突解析骨架（§5.10C 合併規則）：remote = DM 中央存檔快照；以 local 為基合併。
   *   機制區：DM 權威。remote.version_m >= local → 覆蓋（含 =，支援「恢復」情境）。
   *   敘事區：玩家權威。remote.version_n > local → 覆蓋。
   * 注：反向衝突（玩家 version_m > DM 需 DM 審核/駁回、防作弊）屬 Step B 的方向性邏輯，
   * 本函式只提供「比版本→換區」的基礎骨架。 */
  function mergeInstance(local, remote){
    const out = JSON.parse(JSON.stringify(local || {}));
    const ls = ensureSync(out);
    const rs = (remote && remote._sync) ? remote._sync : { version_m:0, version_n:0 };
    const rm = rs.version_m || 0, rn = rs.version_n || 0;
    if(remote && rm >= (ls.version_m || 0)){
      applyZone(out, "mechanical", extractZone(remote, "mechanical"));
      ls.version_m = rm;
    }
    if(remote && rn > (ls.version_n || 0)){
      applyZone(out, "narrative", extractZone(remote, "narrative"));
      ls.version_n = rn;
    }
    return out;
  }

  /* 版本遞增：改機制區 bump "mechanical"（version_m）、改敘事區 bump "narrative"（version_n）。 */
  function bumpVersion(char, zone){
    const s = ensureSync(char);
    if(zone === "mechanical"){ s.version_m = (s.version_m || 0) + 1; }
    else if(zone === "narrative"){ s.version_n = (s.version_n || 0) + 1; }
    return char;
  }

  /* instanceId = characterId + worldId（§5.10B）：兩端對齊的存檔槽 key。
   * 未綁世界（worldId 空）→ 回 null，代表「尚未實例化成世界存檔」。
   * 格式：`<characterId>@<worldId>`（`@` 分隔，這兩個 id 皆由 uid() 產生不含 `@`）。 */
  function makeInstanceId(characterId, worldId){
    if(!characterId || !worldId){ return null; }
    return characterId + "@" + worldId;
  }

  /* 從角色物件取其 instanceId（未綁世界→ null）。 */
  function instanceIdOf(char){
    if(!char){ return null; }
    return makeInstanceId(char.characterId, char.worldId);
  }

  /* 拆解 instanceId 回 {characterId, worldId}（不合法→ null）。 */
  function parseInstanceId(instanceId){
    if(typeof instanceId !== "string"){ return null; }
    const i = instanceId.indexOf("@");
    if(i <= 0 || i === instanceId.length - 1){ return null; }
    return { characterId: instanceId.slice(0, i), worldId: instanceId.slice(i + 1) };
  }

  global.DND5E_CHAR = {
    defaultChar, defaultFamiliar, mergeChar, SCHEMA_VERSION,
    FIELD_ZONES, CREATION_LOCKED, DUAL_FACE,
    ensureSync, extractZone, applyZone, mergeInstance, bumpVersion,
    makeInstanceId, instanceIdOf, parseInstanceId
  };
})(typeof window !== "undefined" ? window : this);
