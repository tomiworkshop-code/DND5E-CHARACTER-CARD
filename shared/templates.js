/* shared/templates.js — 敘事者之書 DM v2 · Step 4 訊息模板系統（純邏輯層）
 *
 * 設計（Tommy 2026-07-21 定案）：
 *  - 具名變數：模板文字內寫 {變數名}，套用時每變數 → 獨立輸入/選擇器。
 *  - 軟過濾（不鎖死）：每個變數帶一個 hint 預設來源（roster/npc/location/quest/
 *    clue/event/monster/free），套用時預設用該來源過濾候選，但永遠可切「全部/自由輸入」。
 *  - 可選綁指令：kind='command' 時可帶 command{type,amountVar,targetVar}；
 *    damage/heal/xp/gold/item 對接玩家端 applyCommand；
 *    【紅線】指令對象 targetVar 必須是 roster 玩家（只有玩家有裝置）。
 *
 * 本檔只有純函式（無 DOM / 無 storage），供 DM 端 app.js 與單元測試共用。
 * 全域掛載 window.DND5E_TEMPLATES；Node 下 module.exports。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.DND5E_TEMPLATES = api;
  else if (typeof root !== "undefined") root.DND5E_TEMPLATES = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var KINDS = [
    { v: "broadcast", label: "廣播（全體可見）", icon: "📢" },
    { v: "inbox", label: "私訊（單一玩家）", icon: "✉️" },
    { v: "command", label: "指令（扣血／給獎…）", icon: "⚙️" }
  ];

  /* 變數提示來源（軟過濾；free = 純自由輸入） */
  var HINTS = [
    { v: "free", label: "自由輸入", icon: "✍️" },
    { v: "roster", label: "連線玩家", icon: "🧑" },
    { v: "npc", label: "NPC", icon: "👤" },
    { v: "location", label: "地點", icon: "📍" },
    { v: "quest", label: "任務", icon: "📜" },
    { v: "clue", label: "線索", icon: "🔍" },
    { v: "event", label: "事件", icon: "⚡" },
    { v: "monster", label: "遭遇怪物", icon: "🐉" }
  ];

  /* 指令型別（num=是否為數值型；item 為給物品，值是物品名） */
  var COMMAND_TYPES = [
    { v: "damage", label: "扣血", num: true, icon: "💥" },
    { v: "heal", label: "治療", num: true, icon: "💚" },
    { v: "xp", label: "經驗值", num: true, icon: "⭐" },
    { v: "gold", label: "金幣", num: true, icon: "🪙" },
    { v: "item", label: "給物品", num: false, icon: "🎁" }
  ];

  /* 允許的變數名：英數底線 + 中日韓字 */
  var VAR_RE = /\{\s*([A-Za-z0-9_\u4e00-\u9fff]+)\s*\}/g;

  function isKind(v) { return KINDS.some(function (k) { return k.v === v; }); }
  function isHint(v) { return HINTS.some(function (h) { return h.v === v; }); }
  function isCommandType(v) { return COMMAND_TYPES.some(function (c) { return c.v === v; }); }
  function commandMeta(v) { for (var i = 0; i < COMMAND_TYPES.length; i++) if (COMMAND_TYPES[i].v === v) return COMMAND_TYPES[i]; return null; }

  /* 掃出文字中的具名變數（依出現順序、去重） */
  function scanVars(text) {
    var out = [], seen = {};
    if (!text) return out;
    var m; VAR_RE.lastIndex = 0;
    while ((m = VAR_RE.exec(text))) {
      var name = m[1];
      if (!Object.prototype.hasOwnProperty.call(seen, name)) { seen[name] = true; out.push(name); }
    }
    return out;
  }

  /* 依變數名猜預設 hint（僅提示，使用者可改） */
  function guessHint(name) {
    var n = String(name || "").toLowerCase();
    /* 先判專一類別（npc/monster），避免 'npc' 內的 'pc' 被 roster 規則誤中 */
    if (/npc|人物/.test(n)) return "npc";
    if (/monster|enemy|mob|怪|敵|魔/.test(n)) return "monster";
    if (/player|\bpc\b|char|role|target|\bwho\b|玩家|角色|對象|目標|誰/.test(n)) return "roster";
    if (/loc|place|scene|地點|場景|位置/.test(n)) return "location";
    if (/quest|mission|任務/.test(n)) return "quest";
    if (/clue|線索/.test(n)) return "clue";
    if (/event|事件/.test(n)) return "event";
    return "free";
  }

  /* 正規化模板：把 vars[] 與文字掃描結果對齊（保留既有 hint），校驗 kind/command */
  function normalize(t) {
    t = t || {};
    var kind = isKind(t.kind) ? t.kind : "broadcast";
    var text = typeof t.text === "string" ? t.text : "";
    var names = scanVars(text);
    var prev = {};
    (Array.isArray(t.vars) ? t.vars : []).forEach(function (v) { if (v && v.name) prev[v.name] = v; });
    var vars = names.map(function (n) {
      var p = prev[n] || {};
      return { name: n, hint: isHint(p.hint) ? p.hint : guessHint(n) };
    });
    var out = {
      id: t.id || "",
      name: t.name || "",
      kind: kind,
      text: text,
      vars: vars
    };
    if (t.command && isCommandType(t.command.type)) {
      var c = t.command;
      out.command = {
        type: c.type,
        amountVar: names.indexOf(c.amountVar) >= 0 ? c.amountVar : "",  // 承載數值/物品名的變數
        targetVar: names.indexOf(c.targetVar) >= 0 ? c.targetVar : "",  // 指令對象（必為 roster）
        targetIsRoster: true
      };
    }
    return out;
  }

  /* 用 values 代入文字；缺值的變數保留 {name} 原樣（方便 DM 看出漏填） */
  function applyValues(text, values) {
    if (!text) return "";
    values = values || {};
    return String(text).replace(VAR_RE, function (whole, name) {
      var has = Object.prototype.hasOwnProperty.call(values, name) && values[name] != null && values[name] !== "";
      return has ? String(values[name]) : whole;
    });
  }

  /* 是否所有變數都已填值 */
  function missingVars(text, values) {
    values = values || {};
    return scanVars(text).filter(function (n) {
      return !(Object.prototype.hasOwnProperty.call(values, n) && values[n] != null && values[n] !== "");
    });
  }

  /* 內建範例模板（首次載入且模板庫為空時 seed） */
  function builtins() {
    return [
      { id: "tpl_hit", name: "攻擊命中", kind: "broadcast",
        text: "{playerName} 對 {monsterName} 造成 {damage} 點 {damageType} 傷害！" },
      { id: "tpl_bite", name: "敵人反擊", kind: "command",
        text: "{monsterName} 反擊 {playerName}，造成 {damage} 點傷害！",
        command: { type: "damage", amountVar: "damage", targetVar: "playerName", targetIsRoster: true } },
      { id: "tpl_trap", name: "陷阱觸發", kind: "command",
        text: "{playerName} 踩到了 {trapName}！受到 {damage} 點傷害。",
        command: { type: "damage", amountVar: "damage", targetVar: "playerName", targetIsRoster: true } },
      { id: "tpl_chest", name: "寶箱奇遇", kind: "command",
        text: "{playerName} 打開了寶箱，獲得 {gold} 枚金幣！",
        command: { type: "gold", amountVar: "gold", targetVar: "playerName", targetIsRoster: true } },
      { id: "tpl_check", name: "技能檢定結果", kind: "broadcast",
        text: "{playerName} 的 {skillName} 檢定：{outcome}。" }
    ].map(normalize);
  }

  /* 反序列化整份模板庫（容錯 → 一律 normalize） */
  function parseLibrary(raw) {
    var arr;
    try { arr = JSON.parse(raw); } catch (e) { arr = null; }
    if (!Array.isArray(arr)) return null;
    return arr.map(normalize).filter(function (t) { return t.name || t.text; });
  }

  return {
    KINDS: KINDS, HINTS: HINTS, COMMAND_TYPES: COMMAND_TYPES,
    isKind: isKind, isHint: isHint, isCommandType: isCommandType, commandMeta: commandMeta,
    scanVars: scanVars, guessHint: guessHint, normalize: normalize,
    applyValues: applyValues, missingVars: missingVars,
    builtins: builtins, parseLibrary: parseLibrary
  };
});
