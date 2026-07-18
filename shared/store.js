/* shared/store.js
 * D&D 5E V2 存檔 store（跨端共用：玩家版現用、DM 版未來複用）。
 * 從 v2/app.js 抽出「純資料/存檔邏輯」：LS keys、identities/instances/worlds/active
 * 讀寫、composeC/decomposeC、migrateToV2、以及 identity/mechanical/narrative 三區欄位擷取。
 * 邏輯與原 inline 版本完全一致（純重構，行為零變化）。
 * 掛在單一全域 window.DND5E_STORE，避免污染命名空間。
 *
 * 依賴（call-time 解析，由宿主頁面全域提供）：
 *   - window.DND5E_CHAR：defaultChar / defaultFamiliar / mergeChar（合併規則一律委派，本模組不重寫）
 *   - window.uid()：角色唯一 id 產生器（migrate/failsafe 用）
 *
 * localStorage 防呆：瀏覽器直接用 window.localStorage；node 環境無 localStorage 時
 *   getItem 回 null、setItem no-op；亦可用 setStorage(adapter) 注入記憶體 storage 供單測。
 */
(function(global){
  "use strict";

  /* ===== LocalStorage keys（集中常數） ===== */
  var LS = {
    IDENTITIES:      "dnd_identities_v2",
    INSTANCES:       "dnd_instances_v2",
    WORLDS:          "dnd_worlds_v2",
    ACTIVE_WORLD:    "dnd_active_world_v2",
    ACTIVE_INSTANCE: "dnd_active_instance_v2",
    SCHEMA_VER:      "dnd_schema_ver",
    SETTINGS:        "dnd_settings",
    ACTIVE:          "dnd_active"   /* 目前選定角色 id（legacy key，仍沿用） */
  };
  var DEFAULT_WORLD_ID = "w_local_default";

  /* ===== storage 介面卡（防呆 + 可注入） ===== */
  var _injected = null;
  function setStorage(s){ _injected = s || null; }
  function getStorage(){
    if(_injected) return _injected;
    try { if(typeof localStorage !== "undefined" && localStorage) return localStorage; } catch(e){}
    return null;
  }
  function _get(k){ var s = getStorage(); return s ? s.getItem(k) : null; }
  function _set(k, v){ var s = getStorage(); if(s) s.setItem(k, v); }

  function _uid(){
    if(typeof global.uid === "function") return global.uid();
    var C = global.DND5E_CHAR;
    if(C && typeof C.defaultChar === "function") return C.defaultChar().id;
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  function _char(){ return global.DND5E_CHAR; }

  /* ===== 全域內容來源設定 ===== */
  function getInt(key){ return parseInt(_get(key)) || 0; }

  function loadSettings(){
    var s = { enabledSources:null, includeUntranslated:true, seen:[] };
    try{
      var raw = _get(LS.SETTINGS);
      if(raw){
        var o = JSON.parse(raw);
        if(o && typeof o === "object"){
          if(Array.isArray(o.enabledSources)) s.enabledSources = o.enabledSources.slice();
          if(typeof o.includeUntranslated === "boolean") s.includeUntranslated = o.includeUntranslated;
          if(Array.isArray(o.seen)) s.seen = o.seen.slice();
        }
      }
    }catch(e){}
    return s;
  }

  /* ===== 三區欄位擷取（純函式） ===== */
  function pickIdentityFields(ch){
    return {
      name: ch.name || "",
      race: ch.race || "",
      subrace: ch.subrace || "",
      alignment: ch.alignment || "",
      background: ch.background || "",
      baseAbilities: JSON.parse(JSON.stringify(ch.abilities || {str:10,dex:10,con:10,int:10,wis:10,cha:10})),
      story: JSON.parse(JSON.stringify(ch.story || {appearance:"",personality:"",ideals:"",bonds:"",flaws:"",allies:"",backstory:""})),
      avatar: ch.avatar || ""
    };
  }

  function pickMechanicalFields(ch){
    return {
      speed: ch.speed || "30 呎",
      languages: JSON.parse(JSON.stringify(ch.languages || [])),
      proficiencies: ch.proficiencies || "",
      grantedProficiencies: [],
      profArmor: JSON.parse(JSON.stringify(ch.profArmor || [])),
      profWeapon: JSON.parse(JSON.stringify(ch.profWeapon || [])),
      profTool: JSON.parse(JSON.stringify(ch.profTool || [])),
      profSaves: JSON.parse(JSON.stringify(ch.profSaves || {})),
      ac: ch.ac || 10,
      initiative: ch.initiative || 0,
      hp: JSON.parse(JSON.stringify(ch.hp || {current:10,max:10,temp:0})),
      abilities: JSON.parse(JSON.stringify(ch.abilities || {str:10,dex:10,con:10,int:10,wis:10,cha:10})),
      abilityBonus: JSON.parse(JSON.stringify(ch.abilityBonus || {str:0,dex:0,con:0,int:0,wis:0,cha:0})),
      classes: JSON.parse(JSON.stringify(ch.classes || [])),
      saves: JSON.parse(JSON.stringify(ch.saves || {str:false,dex:false,con:false,int:false,wis:false,cha:false})),
      skills: JSON.parse(JSON.stringify(ch.skills || {})),
      spellSlots: JSON.parse(JSON.stringify(ch.spellSlots || [])),
      spellsText: ch.spellsText || "",
      spellbook: JSON.parse(JSON.stringify(ch.spellbook || [])),
      inventory: JSON.parse(JSON.stringify(ch.inventory || [])),
      coins: JSON.parse(JSON.stringify(ch.coins || {cp:0,sp:0,gp:0,pp:0})),
      conditions: JSON.parse(JSON.stringify(ch.conditions || {})),
      exhaustion: ch.exhaustion || 0,
      deathSaves: JSON.parse(JSON.stringify(ch.deathSaves || {success:0,fail:0})),
      inspiration: ch.inspiration || false,
      concentration: JSON.parse(JSON.stringify(ch.concentration || {on:false,spell:""})),
      hitDiceUsed: ch.hitDiceUsed || 0,
      acHelper: JSON.parse(JSON.stringify(ch.acHelper || {base:10,dexCap:"",shield:0,misc:0})),
      resources: JSON.parse(JSON.stringify(ch.resources || [])),
      attacks: JSON.parse(JSON.stringify(ch.attacks || [])),
      feats: JSON.parse(JSON.stringify(ch.feats || [])),
      familiar: ch.familiar ? {
        speed: ch.familiar.speed,
        ac: ch.familiar.ac,
        hp: ch.familiar.hp,
        abilities: ch.familiar.abilities,
        attacks: ch.familiar.attacks
      } : null
    };
  }

  function pickInstanceNarrative(ch){
    return {
      notes: ch.notes || "",
      familiar: ch.familiar ? {
        name: ch.familiar.name,
        type: ch.familiar.type,
        notes: ch.familiar.notes
      } : null
    };
  }

  /* ===== compose / decompose（純函式，合併委派 schema） ===== */
  function composeC(identity, instance){
    var C = _char();
    var c = C.defaultChar();
    c.id = identity.characterId;
    c = C.mergeChar(c, identity.identity);
    c = C.mergeChar(c, instance.mechanical);
    c = C.mergeChar(c, instance.narrative);
    if (identity.identity.familiar || instance.mechanical.familiar || instance.narrative.familiar) {
      c.familiar = C.defaultFamiliar();
      if (instance.narrative.familiar) c.familiar = C.mergeChar(c.familiar, instance.narrative.familiar);
      if (instance.mechanical.familiar) c.familiar = C.mergeChar(c.familiar, instance.mechanical.familiar);
    }
    // 進度屬於「角色在該世界的存檔槽」，改為每個角色獨立保存，避免同世界串檔
    c.worldProgress = instance.worldProgress ? JSON.parse(JSON.stringify(instance.worldProgress)) : {};
    return c;
  }

  function decomposeC(c, identity, instance){
    var oldMech = JSON.stringify(instance.mechanical);
    var oldNarI = JSON.stringify(instance.narrative);
    var oldNarId = JSON.stringify(identity.identity);

    var newMech = pickMechanicalFields(c);
    var newNarI = pickInstanceNarrative(c);
    var newNarId = pickIdentityFields(c);

    // worldProgress（角色各世界的進度存檔槽）也要偵測變更並持久化
    var oldWP = JSON.stringify(instance.worldProgress || {});
    var newWP = JSON.parse(JSON.stringify(c.worldProgress || {}));

    var mChanged = oldMech !== JSON.stringify(newMech);
    var nIChanged = oldNarI !== JSON.stringify(newNarI);
    var nIdChanged = oldNarId !== JSON.stringify(newNarId);
    var wpChanged = oldWP !== JSON.stringify(newWP);

    if (mChanged) instance.version_m++;
    if (nIChanged) instance.version_n++;
    if (nIdChanged) identity.version_n++;

    if (mChanged || nIChanged || nIdChanged || wpChanged) {
      instance.updatedAt = Date.now();
      instance.mechanical = newMech;
      instance.narrative = newNarI;
      identity.identity = newNarId;
      instance.worldProgress = newWP;
      return true;
    }
    return false;
  }

  /* ===== 遷移（V1 → V2 存檔槽結構） ===== */
  function migrateToV2(){
    var C = _char();
    if (getInt(LS.SCHEMA_VER) >= 2) return;
    var oldChars = [];
    var raw = _get("dnd_chars");
    if (raw) {
      try {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          oldChars = arr.map(function(x){ return C.mergeChar(C.defaultChar(), x); });
        }
      } catch(e) {}
    }
    if (!oldChars.length) {
      var legacy = _get("parchment_dnd5e_char_v1");
      if (legacy) {
        try { oldChars = [ C.mergeChar(C.defaultChar(), JSON.parse(legacy)) ]; } catch(e) {}
      }
    }
    if (!oldChars.length) {
      var dc = C.defaultChar();
      dc.id = _uid();
      oldChars = [ dc ];
    }

    var worlds = JSON.parse(_get(LS.WORLDS) || "null") || [{id: DEFAULT_WORLD_ID, name: "本地世界", note: "未連線 DM 前的預設世界", type: "local"}];
    if (!worlds.find(function(w){ return w.id === DEFAULT_WORLD_ID; })) worlds.push({id: DEFAULT_WORLD_ID, name: "本地世界", note: "未連線 DM 前的預設世界", type: "local"});

    var identities = [];
    var instances = {};
    for (var i = 0; i < oldChars.length; i++) {
      var ch = oldChars[i];
      var cid = ch.id || _uid();
      identities.push({ characterId: cid, identity: pickIdentityFields(ch), version_n: 1 });
      var iid = cid + "@" + DEFAULT_WORLD_ID;
      instances[iid] = {
        instanceId: iid, characterId: cid, worldId: DEFAULT_WORLD_ID,
        mechanical: pickMechanicalFields(ch),
        narrative: pickInstanceNarrative(ch),
        version_m: 1, version_n: 1, updatedAt: Date.now()
      };
    }

    _set(LS.IDENTITIES, JSON.stringify(identities));
    _set(LS.INSTANCES, JSON.stringify(instances));
    _set(LS.WORLDS, JSON.stringify(worlds));

    var activeCid = (_get("dnd_active") && identities.find(function(x){ return x.characterId === _get("dnd_active"); }))
      ? _get("dnd_active")
      : identities[0].characterId;

    _set(LS.ACTIVE, activeCid);
    _set(LS.ACTIVE_WORLD, DEFAULT_WORLD_ID);
    _set(LS.ACTIVE_INSTANCE, activeCid + "@" + DEFAULT_WORLD_ID);
    _set(LS.SCHEMA_VER, "2");
  }

  /* ===== identities / instances / worlds / active 讀寫 ===== */
  function loadIdentities(){ return JSON.parse(_get(LS.IDENTITIES) || "[]"); }
  function saveIdentities(arr){ _set(LS.IDENTITIES, JSON.stringify(arr)); }
  function loadInstances(){ return JSON.parse(_get(LS.INSTANCES) || "{}"); }
  function saveInstances(obj){ _set(LS.INSTANCES, JSON.stringify(obj)); }
  function loadWorlds(){ return JSON.parse(_get(LS.WORLDS) || "null"); }
  function saveWorlds(arr){ _set(LS.WORLDS, JSON.stringify(arr)); }
  function getActiveCharId(){ return _get(LS.ACTIVE); }
  function setActiveCharId(id){ _set(LS.ACTIVE, id); }
  function getActiveWorld(){ return _get(LS.ACTIVE_WORLD); }
  function setActiveWorld(id){ _set(LS.ACTIVE_WORLD, id); }
  function getActiveInstance(){ return _get(LS.ACTIVE_INSTANCE); }
  function setActiveInstance(id){ _set(LS.ACTIVE_INSTANCE, id); }

  global.DND5E_STORE = {
    LS: LS,
    DEFAULT_WORLD_ID: DEFAULT_WORLD_ID,
    setStorage: setStorage,
    getStorage: getStorage,
    getInt: getInt,
    loadSettings: loadSettings,
    pickIdentityFields: pickIdentityFields,
    pickMechanicalFields: pickMechanicalFields,
    pickInstanceNarrative: pickInstanceNarrative,
    composeC: composeC,
    decomposeC: decomposeC,
    migrateToV2: migrateToV2,
    loadIdentities: loadIdentities,
    saveIdentities: saveIdentities,
    loadInstances: loadInstances,
    saveInstances: saveInstances,
    loadWorlds: loadWorlds,
    saveWorlds: saveWorlds,
    getActiveCharId: getActiveCharId,
    setActiveCharId: setActiveCharId,
    getActiveWorld: getActiveWorld,
    setActiveWorld: setActiveWorld,
    getActiveInstance: getActiveInstance,
    setActiveInstance: setActiveInstance
  };
})(typeof window !== "undefined" ? window : this);
