/* ============================================================
   敘事者之書 DM V2 — 應用主邏輯 (Step 1 Scaffolding)
   於全域作用域執行；依賴 head 載入的 Vue3 與 shared/*。
   本步只做地基：響應式外殼 + 世界列表（最小可用）。
   Step 2-4 的真功能一律留 placeholder，勿在此擴大實作。
   ============================================================ */
(function () {
  "use strict";

  /* DM v2 版本字串（與玩家端獨立） */
  var APP_VERSION = "DM v2.0.0 (Build 0720.1)";

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

  /* 小型導航元件：側欄與抽屜共用 */
  var NavList = {
    props: { tabs: Array, current: String },
    emits: ["go"],
    template:
      '<button v-for="t in tabs" :key="t.key" ' +
      'class="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm active:opacity-70" ' +
      ':class="t.key === current ? \'font-semibold text-white\' : \'\'" ' +
      ':style="t.key === current ? \'background:var(--accent)\' : \'color:var(--text-main)\'" ' +
      '@click="$emit(\'go\', t.key)">' +
      '<span>{{ t.icon }}</span><span>{{ t.label }}</span></button>'
  };

  var app = createApp({
    components: { "nav-list": NavList },
    setup: function () {
      var ref = Vue.ref;
      var computed = Vue.computed;
      var onMounted = Vue.onMounted;

      /* ---- 分頁定義（含四個 placeholder 殼） ---- */
      var tabs = [
        { key: "worlds", icon: "🌍", label: "世界 / 劇本" },
        { key: "session", icon: "🔗", label: "開團連線" },
        { key: "campaign", icon: "📚", label: "戰役管理" },
        { key: "command", icon: "🎛️", label: "指令中心" },
        { key: "settings", icon: "⚙️", label: "設定" }
      ];
      var currentTab = ref("worlds");
      var drawerOpen = ref(false);

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
          worlds.value = Array.isArray(list) ? list : [];
        } catch (e) {
          worlds.value = [];
          sharedError.value = "讀取世界失敗：" + (e && e.message ? e.message : e);
        }
        try {
          activeWorldId.value = STORE.getActiveWorld ? (STORE.getActiveWorld() || "") : "";
        } catch (e) { /* ignore */ }
      }

      function addWorld() {
        var name = (newWorldName.value || "").trim();
        if (!name) return;
        if (!STORE) { sharedError.value = "STORE 未就緒，無法新增世界。"; return; }
        var id = uid();
        try {
          STORE.upsertWorld({ id: id, name: name, note: (newWorldNote.value || "").trim(), type: "dm" });
          if (STORE.setActiveWorld) STORE.setActiveWorld(id);
        } catch (e) {
          sharedError.value = "新增世界失敗：" + (e && e.message ? e.message : e);
          return;
        }
        newWorldName.value = "";
        newWorldNote.value = "";
        showAddWorld.value = false;
        refreshWorlds();
      }

      function cancelAddWorld() {
        showAddWorld.value = false;
        newWorldName.value = "";
        newWorldNote.value = "";
      }

      function selectWorld(w) {
        if (!w || !STORE || !STORE.setActiveWorld) return;
        try {
          STORE.setActiveWorld(w.id || w.worldId);
          refreshWorlds();
        } catch (e) { /* ignore */ }
      }

      function worldCardStyle(w) {
        var active = (w.id === activeWorldId.value);
        return {
          background: "var(--bg-surface)",
          borderColor: active ? "var(--accent)" : "var(--border)",
          boxShadow: active ? "0 0 0 1px var(--accent)" : "none"
        };
      }

      var activeWorldName = computed(function () {
        var w = worlds.value.find(function (x) { return x.id === activeWorldId.value; });
        return w ? (w.name || "") : "";
      });

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
          /* 靜默：Step 1 不需要連線，僅備妥 SDK */
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
        goTab: goTab,
        ready: ready,
        sharedError: sharedError,
        worlds: worlds,
        activeWorldId: activeWorldId,
        activeWorldName: activeWorldName,
        showAddWorld: showAddWorld,
        newWorldName: newWorldName,
        newWorldNote: newWorldNote,
        addWorld: addWorld,
        cancelAddWorld: cancelAddWorld,
        selectWorld: selectWorld,
        worldCardStyle: worldCardStyle,
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
