/* ============================================================
   敘事者之書 DM V2 — 應用主邏輯 (Step 2a：外殼重構)
   於全域作用域執行；依賴 head 載入的 Vue3 與 shared/*。
   本步：world-landing 主畫面 + 右上「換世界」切換器 +
   版本移入選單底 + 圖示按鈕系統。
   ⚠️ 不做戰役內容 CRUD / 世界規則 / v1 converter（Step 2b/2c）。
   ============================================================ */
(function () {
  "use strict";

  /* DM v2 版本字串（與玩家端獨立；Build 號遞增） */
  var APP_VERSION = "DM v2.5.4 (Build 0721.13)";

  /* ============================================================
     §6 資料隔離：前綴命名空間 storage adapter（Step 1.5，維持有效）
     ------------------------------------------------------------
     玩家版 v2/ 與 DM 版 worldbuilder-v2/ 載入同一份 shared/store.js，
     使用相同 localStorage keys；localStorage 依 origin（非路徑）共用，
     同網域同瀏覽器會攪混。這裡包裝 window.localStorage，所有 key 自動
     加前綴 "dmv2:"，讓 DM v2 寫入落在獨立命名空間（如 dmv2:dnd_worlds_v2），
     與玩家版完全隔離、互不可見。
     ⚠️ 必須在任何 STORE 讀寫前呼叫 STORE.setStorage(adapter)。
     ============================================================ */
  var DMV2_LS_PREFIX = "dmv2:";

  function makePrefixedStorage(prefix) {
    function ls() {
      try {
        if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
      } catch (e) { /* 存取被拒（如隱私模式）→ 視為無 storage */ }
      return null;
    }
    return {
      getItem: function (k) {
        var s = ls();
        if (!s) return null;
        try { return s.getItem(prefix + k); } catch (e) { return null; }
      },
      setItem: function (k, v) {
        var s = ls();
        if (!s) return;
        try { s.setItem(prefix + k, v); } catch (e) { /* no-op */ }
      },
      removeItem: function (k) {
        var s = ls();
        if (!s) return;
        try { s.removeItem(prefix + k); } catch (e) { /* no-op */ }
      }
    };
  }

  (function injectIsolatedStorage() {
    try {
      var S = window.DND5E_STORE;
      if (S && typeof S.setStorage === "function") {
        S.setStorage(makePrefixedStorage(DMV2_LS_PREFIX));
      }
    } catch (e) { /* 靜默降級：store.js 會 fallback 到防呆 storage */ }
  })();

  /* Step 4 訊息模板庫：DM 全域（非每世界），同樣落 dmv2: 命名空間 */
  var TPL_STORE = makePrefixedStorage(DMV2_LS_PREFIX);
  var TPL_KEY = "dnd_templates_v2";

  var Vue = window.Vue;
  if (!Vue) {
    document.getElementById("app").innerHTML =
      '<p style="padding:20px;color:red;">Vue 未載入，無法啟動。</p>';
    return;
  }

  var createApp = Vue.createApp;

  /* 簡易 uid（不依賴 shared，避免載入順序問題） */
  function uid() {
    return "w_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* entity / era 用 id 產生器（前綴區分） */
  function eid(prefix) {
    return (prefix || "x") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ============================================================
     §10 世界設定資料常數（entity 類型 / status 列舉 / 任務狀態）
     ============================================================ */
  var ENTITY_TYPES = {
    npc:      { icon: "👤", label: "NPC" },
    location: { icon: "📍", label: "地點" },
    quest:    { icon: "📜", label: "任務" },
    clue:     { icon: "🔍", label: "線索" },
    event:    { icon: "⚡", label: "事件" },
    encounter:{ icon: "⚔️", label: "遭遇" }
  };
  /* §10.2 status 列舉：active(存在)/changed(已質變)/destroyed(已毀)/hidden(未登場) */
  var STATUS_OPTIONS = [
    { v: "active",    label: "存在", cls: "st-active" },
    { v: "changed",   label: "已質變", cls: "st-changed" },
    { v: "destroyed", label: "已毀", cls: "st-destroyed" },
    { v: "hidden",    label: "未登場", cls: "st-hidden" }
  ];
  var QUEST_STATE_OPTIONS = ["進行中", "已完成", "已解鎖"];

  /* ============================================================
     §9.4 導覽面板元件（側欄 + 手機抽屜共用）
     - 導覽項目改用圖示按鈕（icon 對照集中在 tabs 定義一處）。
     - §9.3 版本徽章置於面板「底部」（不在 header）。
     ============================================================ */
  var MenuPanel = {
    props: { tabs: Array, current: String, version: String },
    emits: ["go"],
    template:
      '<div class="flex flex-col flex-1 min-h-0">' +
        '<nav class="flex flex-col gap-1">' +
          '<button v-for="t in tabs" :key="t.key" ' +
            'class="icon-btn icon-btn-block" style="justify-content:flex-start;" ' +
            ':class="t.key === current ? \'icon-btn-primary\' : \'icon-btn-ghost\'" ' +
            '@click="$emit(\'go\', t.key)">' +
            '<span class="ib-icon">{{ t.icon }}</span><span>{{ t.label }}</span>' +
          '</button>' +
        '</nav>' +
        /* 版本徽章：面板底部（§9.3） */
        '<div class="mt-auto pt-3">' +
          '<div class="text-center text-[11px] px-2 py-1 rounded-full" ' +
               'style="color:var(--text-muted); background:var(--bg-base);" ' +
               'data-testid="version-badge">敘事者之書 {{ version }}</div>' +
        '</div>' +
      '</div>'
  };

  /* ============================================================
     §9.4 可重用圖示按鈕元件（樣式集中在 .icon-btn，見 index.html <style>）
     主要動作以圖示 + 簡短 label 呈現；日後換皮只需改一處 CSS。
     ============================================================ */
  var IconBtn = {
    props: {
      icon: String, label: String,
      variant: { type: String, default: "" },
      title: String
    },
    emits: ["click"],
    template:
      '<button class="icon-btn" ' +
        ':class="variant ? (\'icon-btn-\' + variant) : \'\'" ' +
        ':title="title || label" ' +
        '@click="$emit(\'click\', $event)">' +
        '<span class="ib-icon" v-if="icon">{{ icon }}</span>' +
        '<span v-if="label">{{ label }}</span>' +
      '</button>'
  };

  var app = createApp({
    components: { "menu-panel": MenuPanel, "icon-btn": IconBtn },
    setup: function () {
      var ref = Vue.ref;
      var computed = Vue.computed;
      var onMounted = Vue.onMounted;
      var nextTick = Vue.nextTick;

      /* ---- 導覽分頁（landing 為主畫面；圖示對照集中此處 §9.4） ---- */
      var tabs = [
        { key: "landing", icon: "🌍", label: "世界" },
        { key: "session", icon: "🔗", label: "開團" },
        { key: "worldset", icon: "🗺️", label: "世界設定" },
        { key: "command", icon: "🎛️", label: "指令" },
        { key: "settings", icon: "⚙️", label: "設定" }
      ];
      var currentTab = ref("landing");
      var drawerOpen = ref(false);
      var switcherOpen = ref(false);   /* §9.2 右上換世界浮動選單 */
      var comingSoon = ref("");        /* landing 入口卡點擊提示 */
      var comingSoonTimer = null;

      /* §9.6 landing 入口卡（活動/紀錄導向；本次僅佔位，CRUD 留 Step 2b/3）
         ⚙️ 世界設定卡點進切到 worldset 分頁（收世界觀設定模組）。 */
      var entryCards = [
        { key: "sessionlog", icon: "📜", label: "出團記錄", sub: "Step 2b 即將推出" },
        { key: "players", icon: "👥", label: "玩家記錄", sub: "快照備份", nav: "players" },
        { key: "worldset", icon: "⚙️", label: "世界設定", sub: "進入設定模組", nav: "worldset" }
      ];

      /* 世界設定分頁內的模組（§9.6；本次佔位，Step 2b 實作 CRUD） */
      var worldsetModules = [
        { key: "npc", icon: "👤", label: "NPC" },
        { key: "quest", icon: "📜", label: "任務" },
        { key: "clue", icon: "🔍", label: "線索" },
        { key: "place", icon: "📍", label: "地點" },
        { key: "event", icon: "⚡", label: "事件" },
        { key: "encounter", icon: "⚔️", label: "遭遇" },
        { key: "rules", icon: "📏", label: "世界規則" }
      ];

      /* 當前頁標題（header 中央顯示） */
      var titleMap = {
        landing: "世界儀表板",
        session: "開團連線",
        worldset: "世界設定",
        players: "玩家記錄",
        command: "指令中心",
        settings: "設定"
      };

      /* ---- 共用腳本就緒檢查（除錯友善） ---- */
      var CHAR = window.DND5E_CHAR;
      var STORE = window.DND5E_STORE;
      var ROOM = window.DND5E_ROOM;
      var TPL = window.DND5E_TEMPLATES;
      var ready = Vue.reactive({
        char: !!CHAR,
        store: !!STORE,
        room: !!ROOM,
        templates: !!TPL
      });
      var sharedError = ref("");
      (function verifyShared() {
        var missing = [];
        if (!ready.char) missing.push("DND5E_CHAR (character-schema.js)");
        if (!ready.store) missing.push("DND5E_STORE (store.js)");
        if (!ready.room) missing.push("DND5E_ROOM (room.js)");
        if (!ready.templates) missing.push("DND5E_TEMPLATES (templates.js)");
        if (missing.length) sharedError.value = "缺少 " + missing.join("、");
      })();

      /* ---- 世界列表狀態 ---- */
      var worlds = ref([]);
      var activeWorldId = ref("");
      var showAddWorld = ref(false);
      var newWorldName = ref("");
      var newWorldNote = ref("");

      function refreshWorlds() {
        if (!STORE) { worlds.value = []; return; }
        try {
          var list = STORE.loadWorlds();
          list = Array.isArray(list) ? list : [];
          /* §6 世界來源 role 過濾：DM v2 只顯示自建世界 (role:'dm_owner')。
             因已做命名空間隔離，store 本就看不到玩家版世界；此為雙保險。 */
          worlds.value = list.filter(function (w) { return w && w.role === "dm_owner"; });
        } catch (e) {
          worlds.value = [];
          sharedError.value = "讀取世界失敗：" + (e && e.message ? e.message : e);
        }
        try {
          activeWorldId.value = STORE.getActiveWorld ? (STORE.getActiveWorld() || "") : "";
        } catch (e) { /* ignore */ }
      }

      function openAddWorld() {
        switcherOpen.value = false;
        drawerOpen.value = false;
        showAddWorld.value = true;
      }

      function addWorld() {
        var name = (newWorldName.value || "").trim();
        if (!name) return;
        if (!STORE) { sharedError.value = "STORE 未就緒，無法新增世界。"; return; }
        var id = uid();
        try {
          /* §6 role 標記：DM v2 自建世界標 role:'dm_owner'（保留既有 type 欄位不破壞）。
             沿用 STORE.upsertWorld / setActiveWorld，透過已注入的 dmv2: adapter，勿繞過隔離。 */
          STORE.upsertWorld({ id: id, name: name, note: (newWorldNote.value || "").trim(), type: "dm", role: "dm_owner" });
          if (STORE.setActiveWorld) STORE.setActiveWorld(id);
        } catch (e) {
          sharedError.value = "新增世界失敗：" + (e && e.message ? e.message : e);
          return;
        }
        newWorldName.value = "";
        newWorldNote.value = "";
        showAddWorld.value = false;
        currentTab.value = "landing";
        refreshWorlds();
      }

      function cancelAddWorld() {
        showAddWorld.value = false;
        newWorldName.value = "";
        newWorldNote.value = "";
      }

      /* §9.2 換世界：單步（DM 無角色）。沿用 setActiveWorld，走 dmv2: adapter。 */
      function switchWorld(w) {
        if (!w || !STORE || !STORE.setActiveWorld) return;
        try {
          STORE.setActiveWorld(w.id || w.worldId);
          refreshWorlds();
        } catch (e) { /* ignore */ }
        switcherOpen.value = false;
        currentTab.value = "landing";
      }

      var activeWorld = computed(function () {
        return worlds.value.find(function (x) { return x.id === activeWorldId.value; }) || null;
      });
      var activeWorldName = computed(function () {
        return activeWorld.value ? (activeWorld.value.name || "") : "";
      });
      var viewTitle = computed(function () {
        if (currentTab.value === "landing") {
          return activeWorldName.value || titleMap.landing;
        }
        return titleMap[currentTab.value] || "敘事者之書 DM";
      });

      /* ============================================================
         §10 / §9.6 世界設定：entity CRUD + 紀元節點（線性） + 世界規則
         --------------------------------------------------------
         持久化選擇：直接擴充「當前世界」物件（entities / eras /
         currentEraId / rules）。因 STORE.upsertWorld 以
         Object.assign(existing, world) 合併、saveWorlds 整份序列化，
         自訂欄位可原樣 round-trip；且寫入走已注入的 dmv2: adapter，
         全部落在 dmv2: 前綴，不污染無前綴 key、不動玩家版。
         ============================================================ */
      var worldsetView = ref("");   /* '' = 模組格；type = entity 清單；'rules' = 規則 */

      /* 取得目前 active 世界的「完整物件」（含自訂欄位；直讀 store，不受 role 過濾） */
      function getFullActiveWorld() {
        if (!STORE || !STORE.loadWorlds) return null;
        var list = STORE.loadWorlds();
        list = Array.isArray(list) ? list : [];
        var wid = activeWorldId.value;
        for (var i = 0; i < list.length; i++) {
          var w = list[i];
          if (w && (w.id === wid || w.worldId === wid)) return w;
        }
        return null;
      }

      /* 對當前世界物件進行變更並存回（確保容器欄位存在）。 */
      function mutateActiveWorld(fn) {
        var w = getFullActiveWorld();
        if (!w) { sharedError.value = "尚未選定世界，無法儲存設定。"; return false; }
        if (!Array.isArray(w.entities)) w.entities = [];
        if (!Array.isArray(w.eras)) w.eras = [];
        if (!w.rules || typeof w.rules !== "object") w.rules = { allowPactFamiliar: false };
        try {
          fn(w);
          STORE.upsertWorld(w);
        } catch (e) {
          sharedError.value = "儲存世界設定失敗：" + (e && e.message ? e.message : e);
          return false;
        }
        refreshWorlds();
        return true;
      }

      /* ---- entity 讀取（相對 activeWorld reactive） ---- */
      var worldEntities = computed(function () {
        return (activeWorld.value && Array.isArray(activeWorld.value.entities))
          ? activeWorld.value.entities : [];
      });
      /* 遭遇三軸篩選（任務/地點/時間點）— 達成「屬於…底下」的瀏覽感 */
      var encounterFilter = ref({ questId: "", locationId: "", eraId: "" });
      var currentEntities = computed(function () {
        var t = worldsetView.value;
        var list = worldEntities.value.filter(function (e) { return e && e.type === t; });
        if (t === "encounter") {
          var f = encounterFilter.value || {};
          if (f.questId) list = list.filter(function (e) { return e.questId === f.questId; });
          if (f.locationId) list = list.filter(function (e) { return e.locationId === f.locationId; });
          if (f.eraId) list = list.filter(function (e) { return e.eraId === f.eraId; });
        }
        return list;
      });
      /* 三軸下拉選項來源 */
      var questOptions = computed(function () { return worldEntities.value.filter(function (e) { return e.type === "quest"; }); });
      var locationOptions = computed(function () { return worldEntities.value.filter(function (e) { return e.type === "location"; }); });
      function entityNameById(id) { if (!id) return ""; var e = worldEntities.value.find(function (x) { return x.id === id; }); return e ? (e.name || "") : ""; }
      /* 所有遭遇的怪物攝平成可選清單（供 4.4 模板 {monsterName} 選單） */
      var encounterMonsters = computed(function () {
        var out = [];
        worldEntities.value.forEach(function (e) {
          if (e && e.type === "encounter" && Array.isArray(e.monsters)) {
            e.monsters.forEach(function (m) {
              if (m && m.name) out.push({ name: m.name, count: m.count || 1, notes: m.notes || "", encounterId: e.id, encounterName: e.name || "" });
            });
          }
        });
        return out;
      });
      var currentTypeMeta = computed(function () {
        return ENTITY_TYPES[worldsetView.value] || null;
      });

      /* ============================================================
         Step 4.1 訊息模板庫（DM 全域；dmv2:dnd_templates_v2）
         純邏輯在 shared/templates.js（DND5E_TEMPLATES）；本處只管儲存/CRUD。
         ============================================================ */
      var templates = ref([]);
      function loadTemplates() {
        if (!TPL) { templates.value = []; return; }
        var lib = TPL.parseLibrary(TPL_STORE.getItem(TPL_KEY));
        if (!lib || !lib.length) {
          lib = TPL.builtins();
          try { TPL_STORE.setItem(TPL_KEY, JSON.stringify(lib)); } catch (e) { /* no-op */ }
        }
        templates.value = lib;
      }
      function persistTemplates() {
        try { TPL_STORE.setItem(TPL_KEY, JSON.stringify(templates.value)); } catch (e) { /* no-op */ }
      }
      /* 新增/更新一筆模板（傳入工作副本；回傳落地後的 id） */
      function upsertTemplate(t) {
        if (!TPL) return "";
        var norm = TPL.normalize(t);
        if (!norm.name && !norm.text) return "";
        if (!norm.id) norm.id = eid("tpl");
        var idx = templates.value.findIndex(function (x) { return x.id === norm.id; });
        if (idx >= 0) templates.value.splice(idx, 1, norm);
        else templates.value.push(norm);
        persistTemplates();
        return norm.id;
      }
      function deleteTemplate(id) {
        templates.value = templates.value.filter(function (x) { return x.id !== id; });
        persistTemplates();
      }
      function resetTemplatesToBuiltin() {
        if (!TPL) return;
        templates.value = TPL.builtins();
        persistTemplates();
      }

      /* ---- 4.2 模板設定表單（CRUD UI） ---- */
      var showTemplateForm = ref(false);
      var editingTemplate = ref(null);   /* 工作副本：{id,name,kind,text,hints{},command{}} */
      function blankTemplateForm() {
        return { id: "", name: "", kind: "broadcast", text: "", hints: {},
                 command: { type: "", amountVar: "", targetVar: "" } };
      }
      /* 依 text 即時掃出的變數名（表單內用；響應 editingTemplate.text） */
      var editVarNames = computed(function () {
        var e = editingTemplate.value;
        if (!e || !TPL) return [];
        return TPL.scanVars(e.text);
      });
      function hintFor(name) {
        var e = editingTemplate.value; if (!e) return "free";
        if (e.hints && e.hints[name]) return e.hints[name];
        return TPL ? TPL.guessHint(name) : "free";
      }
      function setHint(name, v) {
        var e = editingTemplate.value; if (!e) return;
        if (!e.hints) e.hints = {};
        e.hints[name] = v;
      }
      function openAddTemplate() {
        editingTemplate.value = blankTemplateForm();
        showTemplateForm.value = true;
      }
      function openEditTemplate(t) {
        if (!t) return;
        var hints = {};
        (Array.isArray(t.vars) ? t.vars : []).forEach(function (v) { if (v && v.name) hints[v.name] = v.hint || "free"; });
        editingTemplate.value = {
          id: t.id || "", name: t.name || "", kind: t.kind || "broadcast", text: t.text || "",
          hints: hints,
          command: {
            type: (t.command && t.command.type) || "",
            amountVar: (t.command && t.command.amountVar) || "",
            targetVar: (t.command && t.command.targetVar) || ""
          }
        };
        showTemplateForm.value = true;
      }
      function cancelTemplateForm() { showTemplateForm.value = false; editingTemplate.value = null; }
      function submitTemplateForm() {
        var e = editingTemplate.value; if (!e || !TPL) return;
        var name = (e.name || "").trim();
        if (!name && !(e.text || "").trim()) return;
        var names = TPL.scanVars(e.text);
        var payload = {
          id: e.id, name: name, kind: e.kind, text: e.text,
          vars: names.map(function (n) { return { name: n, hint: (e.hints && e.hints[n]) || TPL.guessHint(n) }; })
        };
        if (e.kind === "command" && e.command && e.command.type) {
          payload.command = { type: e.command.type, amountVar: e.command.amountVar || "", targetVar: e.command.targetVar || "", targetIsRoster: true };
        }
        upsertTemplate(payload);
        showTemplateForm.value = false;
        editingTemplate.value = null;
      }
      function removeTemplate(t) { if (t && t.id) deleteTemplate(t.id); }
      /* 顯示用 meta 查詢 */
      function tplKindMeta(v) { var a = TPL ? TPL.KINDS : []; for (var i = 0; i < a.length; i++) if (a[i].v === v) return a[i]; return { v: v, label: v, icon: "" }; }
      function tplHintMeta(v) { var a = TPL ? TPL.HINTS : []; for (var i = 0; i < a.length; i++) if (a[i].v === v) return a[i]; return { v: v, label: v, icon: "" }; }
      function tplCmdMeta(v) { var a = TPL ? TPL.COMMAND_TYPES : []; for (var i = 0; i < a.length; i++) if (a[i].v === v) return a[i]; return { v: v, label: v, icon: "" }; }

      /* ============================================================
         Step 4.3 套用流程（揃變數 → 搜尋式選擇器 → 可編輯預覽 → 確認）
         軟過濾：依 hint 預設篩選候選池，但每個變數都可「顯示全部/自由輸入」。
         confirmApply 只「暗定」成 stagedApply（實際發送/執行留給 4.4）。
         ============================================================ */
      var showApplyForm = ref(false);
      var stagedApply = ref(null);   /* 4.3 暗定結果；4.4 接手發送 */
      var applyState = Vue.reactive({
        tplId: "", name: "", kind: "broadcast", text: "", vars: [], command: null,
        values: {}, search: {}, showAll: {}, finalText: "", edited: false,
        inboxPid: ""   /* kind='inbox' 時的收件玩家 pid */
      });
      var sendState = Vue.reactive({ busy: false, error: "", lastResult: null });
      function openApplyTemplate(t) {
        if (!t || !TPL) return;
        applyState.tplId = t.id || "";
        applyState.name = t.name || "";
        applyState.kind = t.kind || "broadcast";
        applyState.text = t.text || "";
        applyState.vars = Array.isArray(t.vars) ? t.vars : [];
        applyState.command = (t.command && t.command.type) ? t.command : null;
        applyState.values = {};
        applyState.search = {};
        applyState.showAll = {};
        applyState.finalText = t.text || "";
        applyState.edited = false;
        applyState.inboxPid = "";
        sendState.error = "";
        showApplyForm.value = true;
      }
      function cancelApply() { showApplyForm.value = false; }
      function applyVarHint(name) {
        var v = (applyState.vars || []).find(function (x) { return x && x.name === name; });
        return v && v.hint ? v.hint : (TPL ? TPL.guessHint(name) : "free");
      }
      /* 候選池：依 hint 取對應來源（需時才算） */
      function poolFor(hint) {
        var out = [];
        if (hint === "roster") {
          (rosterList.value || []).forEach(function (p) {
            out.push({ name: p.name || ("玩家" + (p.pid || "")), sub: "Lv" + (p.level || "?") + (p.hp != null ? (" HP" + p.hp) : ""), src: "roster", pid: p.pid, characterId: p.characterId });
          });
        } else if (hint === "monster") {
          (encounterMonsters.value || []).forEach(function (m) {
            out.push({ name: m.name, sub: m.encounterName || "遭遇", src: "monster" });
          });
        } else if (["npc", "location", "quest", "clue", "event"].indexOf(hint) >= 0) {
          worldEntities.value.filter(function (e) { return e.type === hint; }).forEach(function (e) {
            out.push({ name: e.name, sub: (ENTITY_TYPES[hint] ? ENTITY_TYPES[hint].label : hint), src: hint });
          });
        }
        return out;
      }
      function allPool() {
        return poolFor("roster")
          .concat(poolFor("npc")).concat(poolFor("location")).concat(poolFor("quest"))
          .concat(poolFor("clue")).concat(poolFor("event")).concat(poolFor("monster"));
      }
      /* 給定變數名 → 候選清單（軟過濾 + 搜尋，上限 30） */
      function applyCandidates(name) {
        var base = applyState.showAll[name] ? allPool() : poolFor(applyVarHint(name));
        var q = String(applyState.search[name] || "").trim().toLowerCase();
        if (q) base = base.filter(function (c) { return String(c.name || "").toLowerCase().indexOf(q) >= 0; });
        return base.slice(0, 30);
      }
      function regenApplyText() {
        applyState.finalText = TPL ? TPL.applyValues(applyState.text, applyState.values) : applyState.text;
        applyState.edited = false;
      }
      function setApplyValue(name, val) {
        applyState.values[name] = val;
        if (!applyState.edited) regenApplyText();
      }
      function onApplyTextEdit(txt) { applyState.finalText = txt; applyState.edited = true; }
      function toggleApplyShowAll(name) { applyState.showAll[name] = !applyState.showAll[name]; }
      function setApplySearch(name, q) { applyState.search[name] = q; }
      var applyMissing = computed(function () {
        if (!TPL) return [];
        var vals = applyState.values;
        /* 直接讀 vals[n]（反應性 get → 才能被追蹤；hasOwnProperty 不觸發追蹤） */
        return TPL.scanVars(applyState.text).filter(function (n) {
          var v = vals[n];
          return v == null || v === "";
        });
      });
      /* 指令預覽：解析對象(必為 roster) + 數值/物品 */
      function rosterByName(nm) {
        if (!nm) return null;
        return (rosterList.value || []).find(function (p) { return (p.name || "") === nm; }) || null;
      }
      var applyCommandPreview = computed(function () {
        var c = applyState.command;
        if (!c || applyState.kind !== "command") return null;
        var targetName = c.targetVar ? applyState.values[c.targetVar] : "";
        var amount = c.amountVar ? applyState.values[c.amountVar] : "";
        var target = rosterByName(targetName);
        return {
          type: c.type,
          amount: amount,
          targetName: targetName || "",
          targetIsRoster: !!target,
          target: target
        };
      });
      function confirmApply() {
        if (!TPL) return;
        var cp = applyCommandPreview.value;
        var inbox = null;
        if (applyState.kind === "inbox" && applyState.inboxPid) {
          var rp = (rosterList.value || []).find(function (p) { return p.pid === applyState.inboxPid; });
          inbox = { pid: applyState.inboxPid, name: rp ? (rp.name || "") : "" };
        }
        stagedApply.value = {
          tplId: applyState.tplId,
          kind: applyState.kind,
          text: applyState.finalText,
          values: JSON.parse(JSON.stringify(applyState.values)),
          inbox: inbox,
          command: cp ? { type: cp.type, amount: cp.amount, targetName: cp.targetName, targetIsRoster: cp.targetIsRoster, pid: cp.target ? cp.target.pid : "", characterId: cp.target ? cp.target.characterId : "" } : null,
          at: Date.now()
        };
        showApplyForm.value = false;
        return stagedApply.value;
      }

      /* ============================================================
         Step 4.4 對接發送 + 指令執行
         - broadcast：全體廣播。command 亦一併廣播敍事文字（桌上共見）。
         - inbox：私訊單一玩家（需 inboxPid）。
         - command：對 roster 玩家送 applyCommand（damage/heal/xp/gold/item）。
         紅線：指令對象必為連線玩家（pid + targetIsRoster）。
         deps 可注入（測試）：{ db, code, room }。
         ============================================================ */
      function buildCommandPayload(staged) {
        var c = staged && staged.command; if (!c) return null;
        if (c.type === "item") {
          return { type: "give-item", itemName: String(c.amount || "物品"), qty: 1, note: staged.text || "" };
        }
        return { type: c.type, amount: Number(c.amount) || 0, note: staged.text || "" };
      }
      function sendStaged(staged, deps) {
        deps = deps || {};
        staged = staged || stagedApply.value;
        var db = deps.db || (fb && fb.db);
        var code = deps.code || roomId.value;
        var room = deps.room || ROOM;
        sendState.error = ""; sendState.lastResult = null;
        if (!staged) { sendState.error = "沒有待發送內容。"; return Promise.resolve(false); }
        if (!db || !room || !code) { sendState.error = "尚未開房，無法發送。"; return Promise.resolve(false); }
        var jobs = [];
        var result = { kind: staged.kind, text: staged.text, message: false, command: false, target: "" };
        if (staged.kind === "inbox") {
          if (staged.inbox && staged.inbox.pid) {
            jobs.push(room.sendInbox(db, code, staged.inbox.pid, "dm", staged.text));
            result.message = true; result.target = staged.inbox.name || staged.inbox.pid;
          } else { sendState.error = "私訊未選收件玩家。"; return Promise.resolve(false); }
        } else {
          jobs.push(room.sendBroadcast(db, code, "dm", staged.text));
          result.message = true;
        }
        if (staged.kind === "command" && staged.command) {
          if (!staged.command.targetIsRoster || !staged.command.pid) {
            sendState.error = "指令對象非連線玩家，已略過指令（訊息仍送出）。";
          } else {
            jobs.push(room.sendCommand(db, code, staged.command.pid, buildCommandPayload(staged)));
            result.command = true; result.target = staged.command.targetName || staged.command.pid;
          }
        }
        sendState.busy = true;
        return Promise.all(jobs).then(function () {
          sendState.busy = false;
          sendState.lastResult = result;
          stagedApply.value = null;
          return result;
        }).catch(function (e) {
          sendState.busy = false;
          sendState.error = "發送失敗：" + (e && e.message ? e.message : e);
          return false;
        });
      }
      /* 套用 Modal 「確認發送」：守衛 + 暗定 + 發送 */
      function applyAndSend() {
        sendState.error = "";
        if (applyState.kind === "command") {
          var cp = applyCommandPreview.value;
          if (!cp || !cp.targetName) { sendState.error = "指令模板需指定對象（連線玩家）。"; return Promise.resolve(false); }
          if (!cp.targetIsRoster) { sendState.error = "指令對象「" + cp.targetName + "」不是連線玩家，無法執行指令。請改選連線玩家，或改用廣播模板。"; return Promise.resolve(false); }
        }
        if (applyState.kind === "inbox" && !applyState.inboxPid) { sendState.error = "請選私訊收件玩家。"; return Promise.resolve(false); }
        if (applyMissing.value.length) { sendState.error = "尚有未填變數：" + applyMissing.value.map(function (n) { return "{" + n + "}"; }).join("、"); return Promise.resolve(false); }
        var s = confirmApply();
        return sendStaged(s);
      }

      /* ---- entity CRUD ---- */
      var showEntityForm = ref(false);
      var editingEntity = ref(null);   /* 工作副本 */

      function blankEntity(type) {
        return {
          id: "", type: type, name: "", status: "active", story: "", notes: "",
          objective: "", reward: "", state: "進行中",   /* quest */
          region: "",                                     /* location */
          trigger: "",                                     /* event */
          questId: "", locationId: "", eraId: "", monsters: []  /* encounter 三軸 + 怪物子清單 */
        };
      }
      /* 怪物子清單編輯（作用於 editingEntity 工作副本） */
      function addMonsterRow() {
        var e = editingEntity.value; if (!e) return;
        if (!Array.isArray(e.monsters)) e.monsters = [];
        e.monsters.push({ name: "", count: 1, notes: "" });
      }
      function removeMonsterRow(i) {
        var e = editingEntity.value; if (!e || !Array.isArray(e.monsters)) return;
        e.monsters.splice(i, 1);
      }

      function openModule(m) {
        if (!m) return;
        if (m.key === "rules") { worldsetView.value = "rules"; return; }
        var typeMap = { npc: "npc", quest: "quest", clue: "clue", place: "location", event: "event", encounter: "encounter" };
        worldsetView.value = typeMap[m.key] || m.key;
      }
      function closeWorldsetView() { worldsetView.value = ""; }

      function openAddEntity(type) {
        editingEntity.value = blankEntity(type || worldsetView.value);
        showEntityForm.value = true;
      }
      function openEditEntity(e) {
        if (!e) return;
        var copy = blankEntity(e.type);
        copy.id = e.id;
        copy.name = e.name || "";
        copy.status = e.status || "active";
        copy.story = e.story || "";
        copy.notes = e.notes || "";
        copy.objective = e.objective || "";
        copy.reward = e.reward || "";
        copy.state = e.state || "進行中";
        copy.region = e.region || "";
        copy.trigger = e.trigger || "";
        copy.questId = e.questId || "";
        copy.locationId = e.locationId || "";
        copy.eraId = e.eraId || "";
        copy.monsters = Array.isArray(e.monsters) ? JSON.parse(JSON.stringify(e.monsters)) : [];
        editingEntity.value = copy;
        showEntityForm.value = true;
      }
      function cancelEntityForm() {
        showEntityForm.value = false;
        editingEntity.value = null;
      }
      function saveEntity() {
        var e = editingEntity.value;
        if (!e) return;
        var name = (e.name || "").trim();
        if (!name) return;
        mutateActiveWorld(function (w) {
          var now = Date.now();
          var rec = e.id ? w.entities.find(function (x) { return x.id === e.id; }) : null;
          if (!rec) {
            rec = { id: eid("e"), type: e.type, createdAt: now };
            w.entities.push(rec);
          }
          rec.type = e.type;
          rec.name = name;
          rec.status = e.status || "active";
          rec.story = e.story || "";
          rec.notes = e.notes || "";
          rec.updatedAt = now;
          /* 輕量專屬欄位（keep small） */
          if (e.type === "quest") {
            rec.objective = e.objective || "";
            rec.reward = e.reward || "";
            rec.state = e.state || "進行中";
          } else if (e.type === "location") {
            rec.region = e.region || "";
          } else if (e.type === "event") {
            rec.trigger = e.trigger || "";
          } else if (e.type === "encounter") {
            rec.questId = e.questId || "";
            rec.locationId = e.locationId || "";
            rec.eraId = e.eraId || "";
            rec.monsters = Array.isArray(e.monsters)
              ? e.monsters.map(function (m) {
                  return { name: (m.name || "").trim(), count: Number(m.count) || 1, notes: (m.notes || "").trim() };
                }).filter(function (m) { return m.name; })
              : [];
          }
        });
        showEntityForm.value = false;
        editingEntity.value = null;
      }
      function deleteEntity(e) {
        if (!e || !e.id) return;
        mutateActiveWorld(function (w) {
          w.entities = w.entities.filter(function (x) { return x.id !== e.id; });
        });
      }

      function statusMeta(v) {
        for (var i = 0; i < STATUS_OPTIONS.length; i++) {
          if (STATUS_OPTIONS[i].v === v) return STATUS_OPTIONS[i];
        }
        return STATUS_OPTIONS[0];
      }

      /* ============================================================
         紀元節點管理（線性；§10.6）
         world.eras: [{ id, name, parentId, summary, order, canon:true }]
         world.currentEraId；新節點 parentId = 目前 currentEra（線性往後長）。
         預留但不做：fork / diff 還原 / 紀元樹視圖。
         ============================================================ */
      var worldEras = computed(function () {
        var a = (activeWorld.value && Array.isArray(activeWorld.value.eras))
          ? activeWorld.value.eras.slice() : [];
        a.sort(function (x, y) { return (x.order || 0) - (y.order || 0); });
        return a;
      });
      var currentEraId = computed(function () {
        return activeWorld.value ? (activeWorld.value.currentEraId || "") : "";
      });
      function eraNameById(id) { if (!id) return ""; var e = worldEras.value.find(function (x) { return x.id === id; }); return e ? (e.name || "") : ""; }
      var newEraName = ref("");
      var newEraSummary = ref("");

      function addEra() {
        var name = (newEraName.value || "").trim();
        var summary = (newEraSummary.value || "").trim();
        mutateActiveWorld(function (w) {
          if (!name) name = "紀元 " + (w.eras.length + 1);
          var maxOrder = w.eras.reduce(function (m, x) { return Math.max(m, x.order || 0); }, 0);
          var parentId = w.eras.length ? (w.currentEraId || null) : null;
          var era = {
            id: eid("era"), name: name, parentId: parentId,
            summary: summary, order: maxOrder + 1, canon: true
          };
          w.eras.push(era);
          w.currentEraId = era.id;   /* 新節點成為當前（線性往後推進） */
        });
        newEraName.value = "";
        newEraSummary.value = "";
      }
      function renameEra(era) {
        if (!era) return;
        var nn = (typeof window !== "undefined" && window.prompt)
          ? window.prompt("重新命名紀元：", era.name || "") : null;
        if (nn == null) return;
        nn = String(nn).trim();
        if (!nn) return;
        mutateActiveWorld(function (w) {
          var t = w.eras.find(function (x) { return x.id === era.id; });
          if (t) t.name = nn;
        });
      }
      function setCurrentEra(era) {
        if (!era) return;
        mutateActiveWorld(function (w) { w.currentEraId = era.id; });
      }
      /* 調整順序：與相鄰節點交換 order（dir: -1 上移 / +1 下移） */
      function moveEra(era, dir) {
        if (!era) return;
        var sorted = worldEras.value;
        var idx = sorted.findIndex(function (x) { return x.id === era.id; });
        var swapIdx = idx + dir;
        if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
        var aId = sorted[idx].id, bId = sorted[swapIdx].id;
        mutateActiveWorld(function (w) {
          var a = w.eras.find(function (x) { return x.id === aId; });
          var b = w.eras.find(function (x) { return x.id === bId; });
          if (a && b) { var t = a.order; a.order = b.order; b.order = t; }
        });
      }
      function deleteEra(era) {
        if (!era) return;
        var hasChild = worldEras.value.some(function (x) { return x.parentId === era.id; });
        if (hasChild && typeof window !== "undefined" && window.confirm) {
          if (!window.confirm("此紀元有子節點，子節點將重接到上層。仍要刪除？")) return;
        }
        mutateActiveWorld(function (w) {
          var t = w.eras.find(function (x) { return x.id === era.id; });
          var newParent = t ? (t.parentId || null) : null;
          w.eras.forEach(function (x) { if (x.parentId === era.id) x.parentId = newParent; });
          w.eras = w.eras.filter(function (x) { return x.id !== era.id; });
          if (w.currentEraId === era.id) {
            w.currentEraId = newParent || (w.eras.length ? w.eras[w.eras.length - 1].id : "");
          }
        });
      }

      /* ============================================================
         世界規則開關（world.rules；首個 allowPactFamiliar 預設 false）
         ============================================================ */
      var worldRules = computed(function () {
        var r = (activeWorld.value && activeWorld.value.rules) || {};
        return { allowPactFamiliar: !!r.allowPactFamiliar };
      });
      function toggleRule(key) {
        mutateActiveWorld(function (w) {
          if (!w.rules || typeof w.rules !== "object") w.rules = {};
          w.rules[key] = !w.rules[key];
        });
      }

      /* 入口卡點擊：帶 nav 的卡導航到對應分頁（如世界設定）；
         其餘佔位卡顯示「即將推出」提示（不實作 CRUD）。 */
      function openEntry(e) {
        if (e && e.nav) { goTab(e.nav); return; }
        comingSoon.value = "「" + (e && e.label ? e.label : "此功能") + "」即將推出";
        if (comingSoonTimer) clearTimeout(comingSoonTimer);
        comingSoonTimer = setTimeout(function () { comingSoon.value = ""; }, 1800);
      }

      /* ---- 導航 ---- */
      function goTab(key) {
        currentTab.value = key;
        drawerOpen.value = false;
        if (key === "worldset") worldsetView.value = "";   /* 進入世界設定回到模組格 */
      }

      /* ---- firebase：Step 3.1 起真正 init（保留 {app,auth,db} 供開房用） ---- */
      var firebaseReady = ref(false);
      var fb = null;   /* { app, auth, db } */
      function initFirebase() {
        try {
          if (typeof firebase === "undefined" || !window.DND5E_FIREBASE || !ROOM) return;
          fb = ROOM.init(window.DND5E_FIREBASE.firebaseConfig);
          firebaseReady.value = !!(fb && fb.db);
        } catch (e) {
          fb = null;
          firebaseReady.value = false;
        }
      }
      function retryFirebase() { initFirebase(); }

      /* ============================================================
         §3 / §10.1② 開團連線（Step 3.1：createRoom + QR）
         主流程：選任務開團 → worldId 自動帶出；questId 可選；
         eraId 獨立一軸（預設 currentEraId）。roster/提案定案留 3.2+。
         ============================================================ */
      var sessionQuestId = ref("");
      var roomId = ref("");
      var roomBusy = ref(false);
      var roomError = ref("");
      var qrBox = ref(null);   /* template ref：QR 容器 */

      /* Step 3.2 Roster：onPlayers 訂閱 → 名冊；點卡開詳情抽尜。 */
      var rosterMap = ref({});     /* { pid: snapshot } 原始 */
      var rosterUnsub = null;      /* 退訂函式 */
      var selectedPlayer = ref(null);  /* 抽尜：{ pid, ...snapshot } 或 null */

      var rosterList = computed(function () {
        var m = rosterMap.value || {};
        var arr = Object.keys(m).map(function (pid) {
          return Object.assign({ pid: pid }, m[pid] || {});
        });
        arr.sort(function (a, b) { return (a.joinedAt || 0) - (b.joinedAt || 0); });
        return arr;
      });

      function subscribeRoster(code) {
        if (rosterUnsub) { try { rosterUnsub(); } catch (e) {} rosterUnsub = null; }
        if (!fb || !fb.db || !ROOM || !ROOM.onPlayers) return;
        try {
          rosterUnsub = ROOM.onPlayers(fb.db, code, function (players) {
            rosterMap.value = players || {};
            /* Step 3.4：每次名冊推播 → 落地備份到 dmv2: 命名空間（§7） */
            archiveRoster();
            /* 抽尜開著時，跟隨更新選中玩家的即時快照 */
            var sp = selectedPlayer.value;
            if (sp && sp.pid && rosterMap.value[sp.pid]) {
              selectedPlayer.value = Object.assign({ pid: sp.pid }, rosterMap.value[sp.pid]);
            }
          });
        } catch (e) { /* 訂閱失敗不阻斷開房 */ }
      }

      /* ============================================================
         §7 玩家快照落地備份（Step 3.4）
         存於當前世界物件 world.playerSaves（走已注入的 dmv2: adapter）：
           playerSaves[characterId] = { characterId, pid, name,
             latest, latestTs, history:[{ts,level,hp}], firstSeen, lastSeen }
         — 以 characterId 為鍵（跨重連穩定；pid 隨匿名局改變）。
         — latest 僅在快照實際變動時更新（避免 HP 未變也寫入）；
           舊 latest 推入 history（精簡：僅 ts/level/hp），上限 HISTORY_MAX。
         ============================================================ */
      var HISTORY_MAX = 10;
      function archiveRoster() {
        try {
          if (!STORE || !STORE.upsertWorld || !activeWorld.value) return;
          var w = getFullActiveWorld();
          if (!w) return;
          if (!w.playerSaves || typeof w.playerSaves !== "object") w.playerSaves = {};
          var now = Date.now();
          var changed = false;
          rosterList.value.forEach(function (p) {
            var cid = p.characterId;
            if (!cid) return;   /* 無 characterId 不備份（無法穩定歸檔/恢復） */
            var snap = JSON.parse(JSON.stringify(p));
            delete snap.joinedAt;   /* 排除易變欄位，避免噪訊變更 */
            var rec = w.playerSaves[cid];
            if (!rec) {
              rec = { characterId: cid, pid: p.pid || "", name: p.name || "", latest: null, latestTs: 0, history: [], firstSeen: now, lastSeen: now };
              w.playerSaves[cid] = rec;
              changed = true;
            }
            if (!Array.isArray(rec.history)) rec.history = [];
            rec.pid = p.pid || rec.pid;
            rec.name = p.name || rec.name;
            rec.lastSeen = now;
            var newJson = JSON.stringify(snap);
            if (!rec.latest || JSON.stringify(rec.latest) !== newJson) {
              if (rec.latest) {
                rec.history.push({ ts: rec.latestTs || now, level: rec.latest.level, hp: rec.latest.hp });
                if (rec.history.length > HISTORY_MAX) rec.history = rec.history.slice(-HISTORY_MAX);
              }
              rec.latest = snap;
              rec.latestTs = now;
              changed = true;
            }
          });
          if (changed) { STORE.upsertWorld(w); refreshWorlds(); }
        } catch (e) { /* 備份非關鍵：失敗不阻斷開房/名冊 */ }
      }

      /* 當前世界的玩家記錄（依 lastSeen 新→舊） */
      var playerRecords = computed(function () {
        var ps = (activeWorld.value && activeWorld.value.playerSaves) || {};
        return Object.keys(ps).map(function (cid) { return ps[cid]; })
          .sort(function (a, b) { return (b.lastSeen || 0) - (a.lastSeen || 0); });
      });
      /* 點玩家記錄 → 套用同一詳情抽尜（帶 _record 以顯示歷史） */
      function openPlayerRecord(rec) {
        if (!rec || !rec.latest) return;
        selectedPlayer.value = Object.assign({}, rec.latest, { pid: rec.pid || "", _record: rec });
      }

      /* ============================================================
         §3 提案 → 定案（Step 3.3）
         契約：玩家快照 = 「提案」；DM = 機制面 version_m 權威；未定案不動 DM 正史。
         DM 正史存於 world.charSaves[characterId]（dmv2 隱離）；未定案 = charSaves 無此角。
         ⚠️ 回送只送「最小 partial save」（僅 DM 改動的 schema 欄位 + _sync），
            因 applyZone 只套「存在的 key」，不會用摘要版覆蓋玩家完整的
            技能/背包/魔寵（避免損壞玩家資料）。
         ============================================================ */
      function charSaveFor(cid) {
        var cs = (activeWorld.value && activeWorld.value.charSaves) || {};
        return cid ? (cs[cid] || null) : null;
      }
      /* version_m/n 基準 = max(玩家提案版, DM 正史版) */
      function versionBase(player, cid) {
        var pv = (player && player.full && player.full.sync) ? player.full.sync : { version_m: 0, version_n: 0 };
        var canon = charSaveFor(cid);
        var cv = (canon && canon._sync) ? canon._sync : { version_m: 0, version_n: 0 };
        return { version_m: Math.max(pv.version_m || 0, cv.version_m || 0), version_n: Math.max(pv.version_n || 0, cv.version_n || 0) };
      }

      /* 📥 採納為世界存檔：接受玩家提案為 DM 正史（不改版本、不回送，因玩家端無需變更）。 */
      function adoptProposal(player) {
        if (!player || !player.characterId) { roomError.value = "此玩家無 characterId，無法定案。"; return false; }
        var cid = player.characterId;
        var base = versionBase(player, cid);
        return mutateActiveWorld(function (w) {
          if (!w.charSaves || typeof w.charSaves !== "object") w.charSaves = {};
          w.charSaves[cid] = {
            characterId: cid, name: player.name || "", source: "adopted",
            proposal: JSON.parse(JSON.stringify(player.full || {})),
            hp: player.hp ? { current: Number(player.hp.current) || 0, max: Number(player.hp.max) || 0, temp: Number(player.hp.temp) || 0 } : null,
            ac: (player.ac != null ? Number(player.ac) : null),
            _sync: { version_m: base.version_m, version_n: base.version_n },
            adoptedAt: Date.now(), updatedAt: Date.now()
          };
        });
      }

      /* ✒️ 就地編輯定案：只開放 HP(current/max/temp) 與 AC（快照可靠提供的欄位）。
       * 不開放 xp/技能/背包 — 快照未帶或為摘要，避免回送時誤歸零/截斷玩家資料。 */
      var editForm = ref({ open: false, characterId: "", name: "", hp: { current: 0, max: 0, temp: 0 }, ac: 10, _player: null });
      function openEditFinalize(player) {
        if (!player || !player.characterId) { roomError.value = "此玩家無 characterId，無法定案。"; return; }
        var canon = charSaveFor(player.characterId);
        var hp = (canon && canon.hp) || player.hp || { current: 0, max: 0, temp: 0 };
        var ac = (canon && canon.ac != null) ? canon.ac : (player.ac != null ? player.ac : 10);
        editForm.value = {
          open: true, characterId: player.characterId, name: player.name || "", _player: player,
          hp: { current: Number(hp.current) || 0, max: Number(hp.max) || 0, temp: Number(hp.temp) || 0 },
          ac: Number(ac) || 10
        };
      }
      function closeEditFinalize() { editForm.value = Object.assign({}, editForm.value, { open: false }); }
      function submitEditFinalize() {
        var f = editForm.value;
        if (!f.open || !f.characterId) return false;
        var cid = f.characterId;
        var base = versionBase(f._player, cid);
        var newVm = (base.version_m || 0) + 1;   /* DM 權威推進 version_m */
        var partial = {
          hp: { current: Number(f.hp.current) || 0, max: Number(f.hp.max) || 0, temp: Number(f.hp.temp) || 0 },
          ac: Number(f.ac) || 10,
          _sync: { version_m: newVm, version_n: base.version_n }
        };
        /* 1) 寫 DM 正史 canon */
        mutateActiveWorld(function (w) {
          if (!w.charSaves || typeof w.charSaves !== "object") w.charSaves = {};
          var prev = w.charSaves[cid] || { characterId: cid };
          w.charSaves[cid] = Object.assign({}, prev, {
            characterId: cid, name: f.name || prev.name || "", source: "edited",
            hp: partial.hp, ac: partial.ac, _sync: partial._sync,
            finalizedAt: Date.now(), updatedAt: Date.now()
          });
        });
        /* 2) 回送玩家（僅開房 + Firebase 可用；否則只落 DM 正史）—— 只送 partial，不損玩家完整資料 */
        var pushed = false;
        if (fb && fb.db && ROOM && ROOM.setSave && roomId.value) {
          try { ROOM.setSave(fb.db, roomId.value, cid, partial); pushed = true; }
          catch (e) { roomError.value = "回送失敗：" + (e && e.message ? e.message : e); }
        }
        editForm.value = { open: false, characterId: "", name: "", hp: { current: 0, max: 0, temp: 0 }, ac: 10, _player: null };
        return pushed;
      }
      function unsubscribeRoster() {
        if (rosterUnsub) { try { rosterUnsub(); } catch (e) {} rosterUnsub = null; }
        rosterMap.value = {};
        selectedPlayer.value = null;
      }
      function openPlayerDetail(p) {
        if (!p) return;
        selectedPlayer.value = Object.assign({}, p);
      }
      function closePlayerDetail() { selectedPlayer.value = null; }

      /* 當前世界的任務清單（entity type = quest） */
      var worldQuests = computed(function () {
        return worldEntities.value.filter(function (e) { return e && e.type === "quest"; });
      });
      var sessionQuestName = computed(function () {
        var q = worldQuests.value.find(function (x) { return x.id === sessionQuestId.value; });
        return q ? (q.name || "") : "";
      });
      var currentEraName = computed(function () {
        var id = currentEraId.value;
        var e = worldEras.value.find(function (x) { return x.id === id; });
        return e ? (e.name || "") : "";
      });

      /* 玩家版 join URL（QR 編碼）：../v2/index.html?room=CODE（玩家端已支援 ?room= 自帶入） */
      function playerJoinUrl(code) {
        try {
          var u = new URL("../v2/index.html", (typeof location !== "undefined" ? location.href : "http://localhost/"));
          u.search = "?room=" + encodeURIComponent(code);
          return u.href;
        } catch (e) { return "?room=" + code; }
      }

      function renderQr(code) {
        try {
          var box = qrBox.value;
          if (!box || typeof window === "undefined" || typeof window.QRCode === "undefined") return;
          box.innerHTML = "";
          new window.QRCode(box, {
            text: playerJoinUrl(code), width: 168, height: 168,
            correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : undefined
          });
        } catch (e) { /* QR 非關鍵：失敗仍顯示房號文字 */ }
      }

      function openRoom() {
        roomError.value = "";
        if (!activeWorld.value) { roomError.value = "請先選定世界。"; return; }
        if (!fb || !fb.db || !ROOM) { roomError.value = "firebase 未就緒，無法開房。"; return; }
        roomBusy.value = true;
        var opts = {
          worldId: activeWorldId.value,
          eraId: currentEraId.value || "",
          questId: sessionQuestId.value || ""
        };
        ROOM.signInAnon(fb.auth).then(function (dmUid) {
          opts.dmId = dmUid;
          return ROOM.createRoom(fb.db, opts);
        }).then(function (code) {
          roomId.value = code;
          roomBusy.value = false;
          subscribeRoster(code);   /* Step 3.2：開房後訂閱名冊 */
          if (nextTick) nextTick(function () { renderQr(code); });
          else renderQr(code);
        }).catch(function (e) {
          roomBusy.value = false;
          roomError.value = "開房失敗：" + (e && e.message ? e.message : e);
        });
      }

      function closeRoom() {
        roomError.value = "";
        var code = roomId.value;
        if (!code) { return; }
        roomBusy.value = true;
        var done = function () {
          roomBusy.value = false;
          roomId.value = "";
          unsubscribeRoster();   /* Step 3.2：關房退訂名冊 */
          if (qrBox.value) { try { qrBox.value.innerHTML = ""; } catch (e) {} }
        };
        if (fb && fb.db && ROOM && ROOM.setRoomStatus) {
          ROOM.setRoomStatus(fb.db, code, "closed").then(done).catch(function (e) {
            /* 關房寫失敗仍本地收尾（避免卡在開房態） */
            roomError.value = "關房回寫失敗（已本地離開）：" + (e && e.message ? e.message : e);
            done();
          });
        } else { done(); }
      }

      function copyRoomCode() {
        var code = roomId.value;
        if (!code) return;
        try {
          if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code);
          }
        } catch (e) { /* no-op */ }
      }

      onMounted(function () {
        refreshWorlds();
        loadTemplates();
        initFirebase();
      });

      return {
        APP_VERSION: APP_VERSION,
        tabs: tabs,
        currentTab: currentTab,
        drawerOpen: drawerOpen,
        switcherOpen: switcherOpen,
        comingSoon: comingSoon,
        entryCards: entryCards,
        worldsetModules: worldsetModules,
        viewTitle: viewTitle,
        goTab: goTab,
        /* §10 世界設定：entity CRUD + 紀元節點 + 規則 */
        STATUS_OPTIONS: STATUS_OPTIONS,
        QUEST_STATE_OPTIONS: QUEST_STATE_OPTIONS,
        worldsetView: worldsetView,
        openModule: openModule,
        closeWorldsetView: closeWorldsetView,
        currentTypeMeta: currentTypeMeta,
        worldEntities: worldEntities,
        currentEntities: currentEntities,
        /* Step 4.0 遭遇模組 */
        encounterFilter: encounterFilter,
        questOptions: questOptions,
        locationOptions: locationOptions,
        entityNameById: entityNameById,
        eraNameById: eraNameById,
        encounterMonsters: encounterMonsters,
        addMonsterRow: addMonsterRow,
        removeMonsterRow: removeMonsterRow,
        /* Step 4.1 訊息模板庫 */
        TPL_KINDS: TPL ? TPL.KINDS : [],
        TPL_HINTS: TPL ? TPL.HINTS : [],
        TPL_COMMAND_TYPES: TPL ? TPL.COMMAND_TYPES : [],
        templates: templates,
        loadTemplates: loadTemplates,
        upsertTemplate: upsertTemplate,
        deleteTemplate: deleteTemplate,
        resetTemplatesToBuiltin: resetTemplatesToBuiltin,
        /* 4.2 模板設定 UI */
        showTemplateForm: showTemplateForm,
        editingTemplate: editingTemplate,
        editVarNames: editVarNames,
        hintFor: hintFor,
        setHint: setHint,
        openAddTemplate: openAddTemplate,
        openEditTemplate: openEditTemplate,
        cancelTemplateForm: cancelTemplateForm,
        submitTemplateForm: submitTemplateForm,
        removeTemplate: removeTemplate,
        tplKindMeta: tplKindMeta,
        tplHintMeta: tplHintMeta,
        tplCmdMeta: tplCmdMeta,
        /* 4.3 套用流程 */
        showApplyForm: showApplyForm,
        applyState: applyState,
        stagedApply: stagedApply,
        openApplyTemplate: openApplyTemplate,
        cancelApply: cancelApply,
        applyVarHint: applyVarHint,
        applyCandidates: applyCandidates,
        setApplyValue: setApplyValue,
        onApplyTextEdit: onApplyTextEdit,
        toggleApplyShowAll: toggleApplyShowAll,
        setApplySearch: setApplySearch,
        regenApplyText: regenApplyText,
        applyMissing: applyMissing,
        applyCommandPreview: applyCommandPreview,
        confirmApply: confirmApply,
        /* 4.4 發送/執行 */
        sendState: sendState,
        buildCommandPayload: buildCommandPayload,
        sendStaged: sendStaged,
        applyAndSend: applyAndSend,
        showEntityForm: showEntityForm,
        editingEntity: editingEntity,
        openAddEntity: openAddEntity,
        openEditEntity: openEditEntity,
        cancelEntityForm: cancelEntityForm,
        saveEntity: saveEntity,
        deleteEntity: deleteEntity,
        statusMeta: statusMeta,
        worldEras: worldEras,
        currentEraId: currentEraId,
        newEraName: newEraName,
        newEraSummary: newEraSummary,
        addEra: addEra,
        renameEra: renameEra,
        setCurrentEra: setCurrentEra,
        moveEra: moveEra,
        deleteEra: deleteEra,
        worldRules: worldRules,
        toggleRule: toggleRule,
        ready: ready,
        sharedError: sharedError,
        worlds: worlds,
        activeWorldId: activeWorldId,
        activeWorld: activeWorld,
        activeWorldName: activeWorldName,
        showAddWorld: showAddWorld,
        openAddWorld: openAddWorld,
        newWorldName: newWorldName,
        newWorldNote: newWorldNote,
        addWorld: addWorld,
        cancelAddWorld: cancelAddWorld,
        switchWorld: switchWorld,
        openEntry: openEntry,
        firebaseReady: firebaseReady,
        retryFirebase: retryFirebase,
        /* Step 3.1 開團 */
        sessionQuestId: sessionQuestId,
        roomId: roomId,
        roomBusy: roomBusy,
        roomError: roomError,
        qrBox: qrBox,
        worldQuests: worldQuests,
        sessionQuestName: sessionQuestName,
        currentEraName: currentEraName,
        openRoom: openRoom,
        closeRoom: closeRoom,
        copyRoomCode: copyRoomCode,
        /* Step 3.2 Roster */
        rosterMap: rosterMap,
        rosterList: rosterList,
        selectedPlayer: selectedPlayer,
        openPlayerDetail: openPlayerDetail,
        closePlayerDetail: closePlayerDetail,
        /* Step 3.4 玩家快照備份 */
        archiveRoster: archiveRoster,
        playerRecords: playerRecords,
        openPlayerRecord: openPlayerRecord,
        /* Step 3.3 提案/定案 */
        charSaveFor: charSaveFor,
        adoptProposal: adoptProposal,
        editForm: editForm,
        openEditFinalize: openEditFinalize,
        closeEditFinalize: closeEditFinalize,
        submitEditFinalize: submitEditFinalize
      };
    }
  });

  app.config.errorHandler = function (err, vm, info) {
    console.error("DM v2 VUE ERROR:", err, info);
  };

  var vm = app.mount("#app");
  if (typeof window !== "undefined") { try { window.__vm = vm; } catch (e) {} }

  /* PWA：註冊 Service Worker */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./service-worker.js").catch(function () {});
    });
  }
})();
