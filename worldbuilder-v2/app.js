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
  var APP_VERSION = "DM v2.1.0 (Build 0721.2)";

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
        { key: "players", icon: "👥", label: "玩家記錄", sub: "Step 3 即將推出" },
        { key: "worldset", icon: "⚙️", label: "世界設定", sub: "進入設定模組", nav: "worldset" }
      ];

      /* 世界設定分頁內的模組（§9.6；本次佔位，Step 2b 實作 CRUD） */
      var worldsetModules = [
        { key: "npc", icon: "👤", label: "NPC" },
        { key: "quest", icon: "📜", label: "任務" },
        { key: "clue", icon: "🔍", label: "線索" },
        { key: "place", icon: "📍", label: "地點" },
        { key: "event", icon: "⚡", label: "事件" },
        { key: "rules", icon: "📏", label: "世界規則" }
      ];

      /* 當前頁標題（header 中央顯示） */
      var titleMap = {
        landing: "世界儀表板",
        session: "開團連線",
        worldset: "世界設定",
        command: "指令中心",
        settings: "設定"
      };

      /* ---- 共用腳本就緒檢查（除錯友善） ---- */
      var CHAR = window.DND5E_CHAR;
      var STORE = window.DND5E_STORE;
      var ROOM = window.DND5E_ROOM;
      var ready = Vue.reactive({
        char: !!CHAR,
        store: !!STORE,
        room: !!ROOM
      });
      var sharedError = ref("");
      (function verifyShared() {
        var missing = [];
        if (!ready.char) missing.push("DND5E_CHAR (character-schema.js)");
        if (!ready.store) missing.push("DND5E_STORE (store.js)");
        if (!ready.room) missing.push("DND5E_ROOM (room.js)");
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
      }

      /* ---- firebase：只「備妥」不開團（Step 3 才 createRoom） ---- */
      var firebaseReady = ref(false);
      function initFirebase() {
        try {
          if (typeof firebase === "undefined" || !window.DND5E_FIREBASE || !ROOM) return;
          ROOM.init(window.DND5E_FIREBASE.firebaseConfig);
          firebaseReady.value = true;
        } catch (e) {
          /* 靜默：Step 2a 不需要連線，僅備妥 SDK */
          firebaseReady.value = false;
        }
      }

      onMounted(function () {
        refreshWorlds();
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
        firebaseReady: firebaseReady
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
