# 敘事者之書 DM v2 規格 (dm-v2-spec)

> 目標：把 DM 端（現 `worldbuilder/`，單檔 1733 行、自製 CSS 版型、Tier1 快照）
> 重寫為 `worldbuilder-v2/`，與玩家端 `v2/` 對齊：Vue3 + Tailwind、共用 `shared/*`、
> 手機/平板響應式。舊版保留服役，新版並行開發，穩定後再切換。

## 0. 硬需求（Tommy 2026-07-20 定案）
1. **響應式**：手機與平板都好用（Tailwind、觸控友善、卡片式版面；roster 橫向捲動或格狀）。
2. **完整快照 + DM 定案流程**：玩家 joinRoom 傳「最全面」的角色資料；DM 端檢視後決定
   - (a) 直接採納套用到他的世界存檔；或
   - (b) 在 DM 版就地修改數值後再定案。
   → 玩家傳的是「提案」，DM 是「權威」，未定案前不影響 DM 世界正史。
3. **DM 發佈訊息模板化**：常用訊息/指令做成 template（尤其「按骰子結果給不同訊息」），
   減少臨場逐字輸入，避免打斷遊戲節奏。

## 1. 架構原則
- 目錄 `worldbuilder-v2/index.html`（+ 自己的 manifest/service-worker，icons 可沿用）。
- **一律引入根 `shared/`**（不再用 `worldbuilder/shared/` 舊複本）：
  `character-schema.js` / `store.js` / `firebase-config.js` / `room.js`（+ 視需要 services/backup.js）。
- 資料解析一律走 `DND5E_CHAR`（composeC/decomposeC/mergeChar/mergeFam/mergeInstance）
  與玩家端 100% 同源，杜絕「欄位對不上 / mergeChar vs mergeFam 不對稱」類 bug。
- 版型/元件沿用玩家端 v2 觀感（Tailwind、圓角卡片、頂部列 + 抽屜選單）。

## 2. 開發藍圖（分步交付，每步可獨立驗證）
- **Step 1（本次）：地基 Scaffolding**
  - 建 `worldbuilder-v2/index.html`：Vue3 + Tailwind + 全 shared 腳本 + firebase。
  - 響應式外殼：頂部標題列、手機抽屜 / 平板側欄的導航（世界列表、開團、設定）。
  - 「世界/劇本列表」讀 `STORE.loadWorlds()`，可新增/選取/切換（最小可用）。
  - 版本徽章（DM v2 版本字串，與玩家端各自獨立）。
  - 佔位分頁：戰役管理、開團連線、指令中心（先留空殼 + TODO 註記）。
  - **不接**真正 firebase 開團（Step 3 再做），但要把 `room.js` 載好、firebase init 備妥。
- **Step 2：戰役管理**：NPC / 任務 / 線索 / 地點 CRUD（新版面）＋ 規則設定區
  （首個開關 `world.rules.allowPactFamiliar`，預設 false）。
- **Step 3：開團連線 + Roster**：createRoom + QR；roster 吃「完整快照」；
  點開玩家看 技能/豁免/被動察覺/魔寵(陣列)/背包重點。實作「提案 vs 定案」流程（見 §3）。
- **Step 4：指令中心 + 模板**：扣血/治療/XP/金幣/給物品/情報，即時血條回饋；
  訊息模板系統（見 §4）。

## 3. 完整快照 + 提案/定案流程（Step 3 詳規，先記錄方向）
- **玩家端**（未來配合改 `buildPlayerSnapshot`）：除現有 Tier1(name/level/hp/ac)，
  增送「完整 mechanical + narrative 摘要」或直接寫入 `rooms/{id}/saves/{characterId}`
  的 proposal 欄位（沿用現有 `players[pid].proposal.m/n` + saves 通道，不新造平行結構）。
- **DM 端**：
  - roster 顯示完整資訊（唯讀檢視）。
  - 「📥 採納為世界存檔」＝直接套用玩家提案到 DM 世界存檔（已有雛形 `adoptWorldSave`）。
  - **新增**：DM 就地編輯數值 → 存為 DM 權威版（version_m 前進）→ 透過 saves 通道
    回送玩家（玩家端 handleRemoteSave 已支援版本裁決/衝突 UI）。
- 契約：玩家改動一律「提案」；DM 是機制面 version_m 權威；未定案不動 DM 正史。

## 4. 訊息模板系統（Step 4 詳規，先記錄方向）
- 動機：DM 臨場不必逐字打；尤其「擲骰結果 → 對應訊息/效果」。
- 模板資料形狀（草案，存 localStorage，之後可雲端化）：
  ```
  {
    id, name,                       // 模板名，如「陷阱：毒針」
    kind: 'broadcast'|'inbox'|'command',
    // 純訊息模板：
    text: "你踩到了機關…",           // 可含變數 {roll} {player} {dmg}
    // 擲骰驅動（roll table）：
    dice: "1d20",                   // 可選；擲一次
    outcomes: [                      // 依 roll 落在區間給不同訊息/指令
      { min:1, max:9,  text:"你及時閃開，毫髮無傷。" },
      { min:10,max:19, text:"你被劃傷，受 {dmg} 傷害。", command:{type:'damage', amount:"1d4"} },
      { min:20,max:20, text:"大成功！你完美迴避並發現暗格。" }
    ]
  }
  ```
- UI：模板清單 + 一鍵套用（可先擲骰、顯示結果、預覽將發送的訊息/指令，DM 確認後送出）。
- 骰子解析：需一個小的 dice roller（`XdY+Z`），可獨立成 `shared/dice.js` 供雙端重用。
- 內建幾個範例模板（陷阱、隨機遭遇、技能檢定結果、寶箱）。

## 5. 不破壞現況
- 舊 `worldbuilder/` 不動，持續可用。
- 新版逐步接手；切換前雙版並存。
- 每步：語法檢查 + 既有測試全綠 + 新增對應測試；commit 後 **git push origin main**。
