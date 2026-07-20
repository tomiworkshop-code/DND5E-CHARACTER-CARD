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
      xp: Number(ch.xp) || 0,
      deathSaves: JSON.parse(JSON.stringify(ch.deathSaves || {success:0,fail:0})),
      inspiration: ch.inspiration || false,
      concentration: JSON.parse(JSON.stringify(ch.concentration || {on:false,spell:""})),
      hitDiceUsed: ch.hitDiceUsed || 0,
      acHelper: JSON.parse(JSON.stringify(ch.acHelper || {base:10,dexCap:"",shield:0,misc:0})),
      resources: JSON.parse(JSON.stringify(ch.resources || [])),
      attacks: JSON.parse(JSON.stringify(ch.attacks || [])),
      feats: JSON.parse(JSON.stringify(ch.feats || [])),
      familiars: (ch.familiars || []).map(function(f) { return { speed: f.speed, ac: f.ac, hp: f.hp, abilities: f.abilities, attacks: f.attacks, senses: f.senses, resistances: f.resistances, skills: f.skills }; })
    };
  }

  function pickInstanceNarrative(ch){
    return {
      notes: ch.notes || "",
      familiars: (ch.familiars || []).map(function(f) { return { name: f.name, type: f.type, notes: f.notes, story: f.story }; })
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
    c.familiars = [];
    var maxLen = Math.max((identity.identity.familiars || []).length, (instance.mechanical.familiars || []).length, (instance.narrative.familiars || []).length);
    for (var i=0; i<maxLen; i++) {
       var f = C.defaultFamiliar();
       if (instance.narrative.familiars && instance.narrative.familiars[i]) f = C.mergeChar(f, instance.narrative.familiars[i]);
       if (instance.mechanical.familiars && instance.mechanical.familiars[i]) f = C.mergeChar(f, instance.mechanical.familiars[i]);
       c.familiars.push(f);
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

  /* ===== onSave 合流形狀轉換（P2-B 修復） =====
   * store 的 instance 是「巢狀」形狀：{mechanical:{...}, narrative:{notes,familiar}, version_m, version_n}。
   * schema 的 mergeInstance/extractZone/applyZone 期望「攤平」的 char 形狀：
   *   機制/敘事欄位在頂層 + _sync:{version_m,version_n}。
   * 下列兩個 helper 提供雙向轉換，讓 onSave 合流一律委派 DND5E_CHAR.mergeInstance，
   * 不自寫合併規則（硬約束）。
   */

  /* 巢狀 store instance → 攤平 char 形狀（供 mergeInstance 當 local）。
   * 機制區欄位攤到頂層；narrative.notes 攤到頂層；_sync 取自頂層 version_m/version_n。 */
  function instanceToFlat(inst){
    var flat = {};
    var m = (inst && inst.mechanical) || {};
    for(var k in m){ if(Object.prototype.hasOwnProperty.call(m, k)) flat[k] = JSON.parse(JSON.stringify(m[k])); }
    var n = (inst && inst.narrative) || {};
    if(n && Object.prototype.hasOwnProperty.call(n, "notes")) flat.notes = JSON.parse(JSON.stringify(n.notes));
    flat._sync = {
      version_m: (inst && inst.version_m) || 0,
      version_n: (inst && inst.version_n) || 0
    };
    return flat;
  }

  /* 把一個 live char 的機制/敘事欄位寫回其 store instance（指定世界），
   * 並「明確設定」version_m/version_n（不做自動遞增）。
   * 用於 DM 權威採用路徑（onSave / 衝突「採用 DM」/ DM 指令落帳），
   * 這些路徑不得觸發玩家端 version_m 假性遞增（紅線 R4）。
   * versions 省略時保留既有 instance 版本（無 instance 則為 0）。 */
  function writeInstanceFromChar(char, worldId, versions){
    if(!char || !char.id || !worldId) return null;
    var instances = loadInstances();
    var iid = char.id + "@" + worldId;
    var inst = instances[iid];
    if(!inst){
      inst = {
        instanceId: iid, characterId: char.id, worldId: worldId,
        worldProgress: JSON.parse(JSON.stringify(char.worldProgress || {})),
        version_m: 0, version_n: 0
      };
      instances[iid] = inst;
    }
    inst.mechanical = pickMechanicalFields(char);
    inst.narrative = pickInstanceNarrative(char);
    if(versions){
      if(typeof versions.version_m === "number") inst.version_m = versions.version_m;
      if(typeof versions.version_n === "number") inst.version_n = versions.version_n;
    }
    inst.updatedAt = Date.now();
    saveInstances(instances);
    return inst;
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

  /* ===== 刪除（純函式，TC-04.5） =====
   * instanceId 慣例 = characterId + "@" + worldId。以最後一個 "@" 切分，
   * 兼容 characterId 內含 "@" 的極端情況。
   */
  function parseInstanceId(instanceId){
    var s = String(instanceId || "");
    var at = s.lastIndexOf("@");
    if(at < 0) return { characterId: s, worldId: null };
    return { characterId: s.slice(0, at), worldId: s.slice(at + 1) };
  }

  /* 刪除單一存檔槽（某角色在某世界的紀錄）。
   * 只影響 characterId@worldId：
   *   1) 移除 instances[instanceId]（若未來有真正 per-world instance）。
   *   2) 清掉該角色任何 instance 內的 worldProgress[worldId]（目前實作 per-world
   *      進度存於此，見 app.js activeWorldProgress）。
   * 絕不動同世界其他角色的存檔（各 instance / 各 worldProgress 桶獨立）。
   * 刪後修正 active world / active instance 指標，避免空指標。
   * 回傳 { removed, activeWorld, activeInstance }。
   */
  function deleteInstance(instanceId){
    var parsed = parseInstanceId(instanceId);
    var cid = parsed.characterId, wid = parsed.worldId;
    var instances = loadInstances();
    var removed = false;

    if(instances[instanceId]){ delete instances[instanceId]; removed = true; }

    if(wid){
      Object.keys(instances).forEach(function(key){
        var inst = instances[key];
        if(inst && inst.characterId === cid && inst.worldProgress &&
           Object.prototype.hasOwnProperty.call(inst.worldProgress, wid)){
          delete inst.worldProgress[wid];
          removed = true;
        }
      });
    }
    saveInstances(instances);

    /* 修正 active 指標：刪掉目前選定的世界／存檔槽時 fallback 到安全狀態 */
    if(wid && getActiveWorld() === wid){ setActiveWorld(DEFAULT_WORLD_ID); }
    if(getActiveInstance() === instanceId){
      var fallbackIid = cid + "@" + DEFAULT_WORLD_ID;
      setActiveInstance(instances[fallbackIid] ? fallbackIid : "");
    }
    return { removed: removed, activeWorld: getActiveWorld(), activeInstance: getActiveInstance() };
  }

  /* 刪除整個角色（Identity）+ 連帶清掉它在所有世界的 instances。
   * 刪後修正 active 角色／世界／存檔槽指標：fallback 到剩餘第一個角色，
   * 若已無角色則清為未選定的安全狀態（避免空指標）。
   * 回傳 { removed, remaining, activeCharId, activeWorld, activeInstance }。
   */
  function deleteIdentity(characterId){
    var identities = loadIdentities();
    var kept = identities.filter(function(x){ return x.characterId !== characterId; });
    var removed = kept.length !== identities.length;
    saveIdentities(kept);

    var instances = loadInstances();
    Object.keys(instances).forEach(function(key){
      var inst = instances[key];
      if(inst && inst.characterId === characterId){ delete instances[key]; removed = true; }
    });
    saveInstances(instances);

    if(getActiveCharId() === characterId){
      var fallbackCid = kept.length ? kept[0].characterId : "";
      setActiveCharId(fallbackCid);
      if(fallbackCid){
        setActiveWorld(DEFAULT_WORLD_ID);
        setActiveInstance(fallbackCid + "@" + DEFAULT_WORLD_ID);
      } else {
        setActiveWorld("");
        setActiveInstance("");
      }
    }
    return {
      removed: removed, remaining: kept.length,
      activeCharId: getActiveCharId(), activeWorld: getActiveWorld(), activeInstance: getActiveInstance()
    };
  }

  /* ===== 房間世界綁定（P2-A §5.6，純函式） =====
   * 玩家首入座某 DM 房間時，於本機 dnd_worlds_v2 建立/更新一個 DM 世界條目，
   * 並把當前角色的 active instance 綁到該 worldId。全程「不覆蓋既有本地世界資料」：
   *   - upsertWorld 只更新符合 id/worldId 的那一筆或 append 新的一筆，其他世界原封不動。
   *   - bindActiveWorld 若該角色在該世界尚無 instance 才建立（以既有 instance 為模板複製，
   *     不動任何既有 instance），最後只改 active 指標。
   */

  /* 建立/更新單一世界條目（依 id 或 worldId 比對）。回傳更新後的 worlds 陣列。 */
  function upsertWorld(world){
    var worlds = loadWorlds();
    if(!Array.isArray(worlds)) worlds = [];
    if(!world) return worlds;
    var wid = world.worldId || world.id;
    if(!wid) return worlds;
    var idx = -1;
    for(var i = 0; i < worlds.length; i++){
      var w = worlds[i];
      if(w && (w.worldId === wid || w.id === wid)){ idx = i; break; }
    }
    var merged = Object.assign({}, idx >= 0 ? worlds[idx] : {}, pruneUndef(world));
    /* id 與 worldId 對齊：既有 UI 以 id 尋找世界，§5.6 以 worldId 記錄 */
    if(!merged.id) merged.id = wid;
    if(!merged.worldId) merged.worldId = wid;
    if(idx >= 0) worlds[idx] = merged; else worlds.push(merged);
    saveWorlds(worlds);
    return worlds;
  }

  /* 把某角色的 active instance 綁到指定 worldId。
   * 若該角色在該世界尚無 instance，則以角色任一既有 instance 為模板複製一份（不覆蓋既有），
   * 再把 ACTIVE_WORLD / ACTIVE_INSTANCE 指向它。回傳 instanceId 或 null。 */
  function bindActiveWorld(characterId, worldId){
    if(!characterId || !worldId) return null;
    var instances = loadInstances();
    var iid = characterId + "@" + worldId;
    if(!instances[iid]){
      var base = null;
      for(var k in instances){
        if(instances[k] && instances[k].characterId === characterId){ base = instances[k]; break; }
      }
      instances[iid] = {
        instanceId: iid, characterId: characterId, worldId: worldId,
        mechanical: base ? JSON.parse(JSON.stringify(base.mechanical || {})) : {},
        narrative:  base ? JSON.parse(JSON.stringify(base.narrative  || {})) : {},
        worldProgress: {},
        version_m: 1, version_n: 1, updatedAt: Date.now()
      };
      saveInstances(instances);
    }
    setActiveWorld(worldId);
    setActiveInstance(iid);
    return iid;
  }

  /* pruneUndef 供 upsertWorld 使用（避免把 undefined 欄位寫進世界物件） */
  function pruneUndef(v){
    if(v && typeof v === "object" && !Array.isArray(v)){
      var o = {};
      for(var k in v){ if(Object.prototype.hasOwnProperty.call(v,k) && v[k] !== undefined) o[k] = v[k]; }
      return o;
    }
    return v;
  }

  global.DND5E_STORE = {
    LS: LS,
    DEFAULT_WORLD_ID: DEFAULT_WORLD_ID,
    upsertWorld: upsertWorld,
    bindActiveWorld: bindActiveWorld,
    setStorage: setStorage,
    getStorage: getStorage,
    getInt: getInt,
    loadSettings: loadSettings,
    pickIdentityFields: pickIdentityFields,
    pickMechanicalFields: pickMechanicalFields,
    pickInstanceNarrative: pickInstanceNarrative,
    instanceToFlat: instanceToFlat,
    writeInstanceFromChar: writeInstanceFromChar,
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
    setActiveInstance: setActiveInstance,
    parseInstanceId: parseInstanceId,
    deleteInstance: deleteInstance,
    deleteIdentity: deleteIdentity
  };
})(typeof window !== "undefined" ? window : this);
