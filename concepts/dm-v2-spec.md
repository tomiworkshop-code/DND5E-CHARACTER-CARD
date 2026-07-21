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

## 6. 資料隔離（Step 1.5，Tommy 2026-07-21 定案）
> 情境：同一人可能「在 DM 版當 DM」又「在玩家版打野團」。若同網域同瀏覽器，
> 兩 App 共用 `../shared/store.js` → **同一組 localStorage key**（origin 級共用，非路徑），會攪混。

- **做法**：DM v2 於啟動時以 `STORE.setStorage(adapter)` 注入「加前綴」storage adapter，
  key 全部前綴 `dmv2:`（如 `dmv2:dnd_worlds_v2`），與玩家版 `v2/` 完全不同命名空間。
- **不影響程式碼共用**：composeC/decomposeC/mergeChar 解析的是「網路收到的玩家快照」，
  與 localStorage 無關，隔離後照常重用。
- **世界來源標記釐清**：需區分「我當 DM 開的世界 (role:'dm_owner')」vs「我以玩家 join 的野團 (role:'guest')」；
  目前兩者都被標 `type:'dm'` 難分。DM v2 只顯示 dm_owner；玩家版只顯示 guest/local。
- 驗證：冒煙測試確認 DM v2 寫入不落在玩家版 key、兩邊 key 不打架。

## 7. 玩家快照存檔與恢復（DM 側記錄 + 玩家還原，Tommy 2026-07-21 定案）
> 隔離 ≠ 不存玩家資料。DM 收到玩家 join/更新的完整快照後，**必須落地保存為記錄**，
> 供 (a) DM 觀測與定案；(b) 玩家日後資料遺失時「從 DM 端恢復」。

- **存哪**：DM 命名空間內，按 `世界 → 玩家(pid/characterId) → 快照` 歸檔；保留最新一份 + 精簡歷史
  （含時間戳/版本 version_m/version_n），非只存記憶體。雲端側沿用 firebase
  `rooms/{roomId}/saves/{characterId}`（權威存檔）與 players 快照，本地側在 DM v2 storage 另存鏡像備份（離線可查）。
- **恢復流程**：玩家資料遺失 → 重新 join 同房間 → DM 端將保存的該角色快照透過 saves/inbox 通道
  **回送**玩家（玩家端 handleRemoteSave 已支援版本裁決/衝突 UI）；或 DM 匯出該玩家快照 JSON 交還玩家匯入。
- **與提案/定案流程整合（§3）**：玩家送來的是提案；DM 保存記錄後再決定採納或就地改值定案。
  即使 DM 不採納進正史，記錄仍保留（備份用途）。
- **隱私/歸屬**：這些是「玩家的資料由 DM 代管備份」，不與 DM 個人角色卡混放；
  刪除世界/房間時提示是否一併清除該世界的玩家快照備份。
- 排期：基礎存檔隨 Step 3（開團連線 + Roster + 收快照）落地；恢復 UI 可 Step 3 尾或 Step 4。

## 8. v1 → v2 匯入器（Converter，Tommy 2026-07-21 定案；排入 Step 2）
> 背景：舊版 DM v1（worldbuilder/）未用 shared/store.js，自帶獨立 key，與玩家版/DM v2 皆不撞：
> - `dm_worldbuilder_v1`（總表）、`dm_worldbuilder_worlds_v1`（世界）、`dm_worldbuilder_active_v1`（當前世界）、
>   `dm_worldbuilder_quests_v1`（任務）、`dm_worldbuilder_encounters_v1`（遭遇/戰鬥）、
>   `dnd_narrator_dmflags`（DM 旗標）、`dm_theme`（主題）。
> 因此 v1 天生已隔離；**不需**、也**不應**改 v1 的 prefix（改了會讓 v1 現有存檔瞬間失聯，且動到欲凍結的舊 App）。

- **原則**：v1 保持原樣凍結；轉換能力做在 **DM v2 端**（讀 v1 舊 key → 轉格式 → 寫入 `dmv2:` 命名空間）。
- **來源 → 目標對映（草案）**：
  - `dm_worldbuilder_worlds_v1` → `dmv2:dnd_worlds_v2`（每筆補 `role:'dm_owner'`、`type:'dm'`；保留 name/note；產生新 id 或沿用）
  - `dm_worldbuilder_quests_v1` / `dm_worldbuilder_encounters_v1` → 掛入對應世界的戰役內容（Step 2 的 quest/encounter 結構）
  - `dm_worldbuilder_active_v1` → `dmv2:dnd_active_world_v2`（若該世界有被匯入）
  - `dnd_narrator_dmflags` → 世界層 `rules`（如日後對映 allowPactFamiliar 等旗標）
  - `dm_theme` → DM v2 設定（可選）
- **UI**：DM v2「設定」分頁放「📥 從舊版 (v1) 匯入」按鈕；執行前顯示預覽（將匯入幾個世界/任務），
  匯入採「合併不覆蓋」（同名/同 id 詢問或跳過），完成後回報結果。**絕不刪 v1 原始資料**（v1 keys 原封不動）。
- **安全**：匯入為冪等/可重跑；同一世界不重複灌入（以來源 id 或名稱去重）。
- **排期**：實作排入 **Step 2**（戰役管理落地、v2 世界/任務結構定形後即可對映搬遷）。
- **驗證**：測試以記憶體 storage 塞入模擬 v1 keys → 執行 converter → 斷言 `dmv2:` 目標 key 內容正確、v1 keys 未被更動。

## 9. Step 2 UI 架構決策（Tommy 2026-07-21 定案）
> 參考冒險者 v2 的「world landing + 右上角切換」體驗；world-centric（世界為頂層容器）。

### 9.1 世界為頂層 + Landing
- 採「世界 landing」：進 App 後主畫面 = 當前選定世界的儀表板（landing），
  其下才是該世界的戰役內容（NPC/任務/線索/地點/事件）與世界設定/規則。
- 等同分層(B)但以 landing 呈現：一個世界 = 一個容器，內含戰役內容。日後可支援一世界多戰役。

### 9.2 右上角「換世界」切換器（比照玩家版 global switcher）
- 頂部 sticky header：左=☰選單、中=當前頁標題、右=「換世界」膠囊按鈕
  （顯示當前世界名 + ▼；點擊開右上浮動選單列出所有 role:'dm_owner' 世界，可切換 / 新增世界）。
- 玩家版切換器是「角色→世界」兩步；DM 版無角色，簡化為「世界」單步清單。
- 參考 v2/index.html header(行81) 與 global switcher(行110+) 樣式（膠囊、浮動選單、遮罩）。

### 9.3 版本號位置
- 版本徽章從 header 移到「☰ 選單抽屜的底部」（比照玩家版 About 區塊底部呈現版本）。
- header 不再放版本字串，保持乾淨。

### 9.4 圖示按鈕系統（為換皮鋪路）
- 全面「多用圖示按鈕」而非純文字按鈕：主要動作用 icon（可加簡短 label），
  方便日後換皮/主題化（skinning）。
- 建議：集中一組 icon 元件/對照（emoji 或 inline SVG），按鈕樣式抽成可重用 class/元件，
  之後改主題只需改一處。避免把樣式散寫在各按鈕。

### 9.5 排期
- Step 2a（本階段先做）：外殼重構為 world-landing + 右上換世界 + 版本移入選單底 + 圖示按鈕系統。
- Step 2b：戰役內容 CRUD（NPC/任務/線索/地點/事件）+ 世界設定/規則(allowPactFamiliar)。
- Step 2c：v1→v2 匯入器（§8）。

## 9.6 Landing 內容重整（Tommy 2026-07-21 追加）
> 修正 §9.1：landing 不要堆所有模組。landing 以「活動/紀錄」為主；世界觀設定模組收進「世界設定」。

- **Landing（世界首頁）呈現**：
  - 世界名 / note 摘要。
  - **出團記錄（Session / Adventure Log）**：這個世界歷次開團的紀錄（日期、參與玩家、摘要、重要事件），可新增/檢視。
  - **玩家記錄（Player Records）**：曾在此世界出現的玩家與其角色快照備份（呼應 §7 快照存檔與恢復；此處為入口，點入看某玩家在此世界的角色/存檔/歷程，並可回送恢復）。
- **世界設定（World > 世界設定，收設定相關模組）**：
  - NPC、任務(quests)、線索(clues)、地點(locations)、事件(events) 等「世界觀/劇本設定」模組。
  - 世界規則（allowPactFamiliar 等）。
  - 這些不放 landing，改為 landing 上一個「⚙️ 世界設定」入口 → 進去才是這些模組的分區/CRUD。
- **導覽關係**：世界(landing：出團記錄+玩家記錄) → 世界設定(NPC/任務/線索/地點/事件/規則)。
- 排期：landing 的出團記錄/玩家記錄「入口與空狀態」可在 Step 2a 外殼一併擺好（佔位）；
  實際 CRUD 與快照恢復連動排 Step 2b / Step 3。

## 10. 世界紀元樹（World Era Tree，Tommy 2026-07-21 定案：樹狀 / git-like，分階段落地）
> 命名：DM 端稱「世界紀元 / 世界狀態」，避免與玩家端 worldProgress（角色存檔進度）混淆。
> 核心哲學（Tommy）：**角色永遠活在當下**（活在它所在的節點）；地點/NPC/勢力各自帶著經歷往前演進。
> 重要重框：這裡的「回到過去」不是把同一條時間線倒帶（會有智識穿越悖論），而是**分支導航**——
> 世界是一棵可無限展開的樹，切到哪個節點就繼續那個分支；**每條分支＝一個自己的現實/平行世界**。
> 死亡回溯 / 穿越 / 平行世界 = 從某節點 **fork 一條新分支**，不是倒帶。

### 10.1 三層架構（借用 Git 心智模型）
- **① 世界紀元樹（World Era Tree）— DM 的正史/分支**
  - `eras: [{ id, name, parentId, summary, label?, canon?, date?, changes? }]`
    - `parentId`：指向上一個節點 → 這就構成一棵樹（線性玩＝每節點 parent 為前一個，退化成一條線）。
    - 分支＝新節點指向較早的 parent，自然長出平行線。
    - `canon`：標記主線/正史；其餘分支用 `label`（如「平行線：北城未陷」）。
  - **節點只存 diff（相對 parent 的變化）**：某城鎮毀、某 NPC 死…；從根走到該節點套用 diff
    即可還原「該分支世界的當前樣貌」（分支正確、不需整份快照、超省）。
  - `currentEraId`：世界「正史」目前推進到哪個節點（樹可有多個 tip，但 canon 有一個當前指標）。
- **② 團（Campaign Run / 房間）— 錨定在某個紀元節點**
  - 開團 meta 記 `worldId + eraId`（停在樹上哪個節點）；出團過程推進 / 長出新節點。
  - 不同團玩同一世界 → 自然停在不同節點/分支。
- **③ 玩家角色進度 — 沿用玩家端 worldProgress（角色自己的存檔）**
  - 玩家經歷「餵養」團所在節點的推進；玩家角色狀態與世界紀元是不同層，不混放。

### 10.2 entity 狀態（活在當下，狀態隨節點解析）
- entity（NPC / 地點 / 勢力）具 `status`（active/destroyed/changed/hidden）+ `story/notes`（自己的經歷）。
- 線性階段：entity 直接持有「當前 status」（單一主線，簡單）。
- 樹狀階段：entity 的某次 status 變更登記為「所在節點的 changes(diff)」；
  「某分支的世界現在」＝從根到該節點累積套用 diff 的結果（git-like 還原）。

### 10.3 分支與否 = DM 決定
- 某團結果若與正史衝突：DM 選「**併入主線**（推進 canon 的 currentEraId）」或「**開新分支**（fork 平行線）」。
- 預設單一主線；分支是 DM 主動的進階動作，不強迫。

### 10.4 可管理性（Tommy 點名要顧）
- 標一條 `canon` 主線；其餘節點掛 `label`；預設 UI 走線性，分支收在「進階：開分支」。
- 「紀元樹」視覺化檢視；每個團顯示停在哪個節點；死枝可封存/剪除。
- 導入分支前先解「時間線/多分支好不好讀」的 UX；避免玩家/DM 迷路。

### 10.5 出團連動（Step 3）
- 出團（開房）：選 世界 + 紀元節點（預設沿用 canon 的 currentEraId；DM 可開團前推進/新增節點）。
- 與 landing「出團記錄」串接：一次出團結果 → DM 據此推進節點（併主線）或 fork（開分支）。

### 10.6 分階段落地（務實，避免一次吃太撐）
- **資料模型現在就鎖成樹狀**：`eras` 用 `id` + `parentId`（+ 預留 `changes` diff 欄位、`canon`/`label`），
  路留好，未來加分支不必重寫。
- **Step 2b（先做線性）**：entity CRUD（含 status + story）＋ 紀元節點管理（新增/排序/設 currentEra，
  先只長主線 parentId=前一節點）＋ 世界規則開關（allowPactFamiliar 預設 off）。
- **進階步驟（另排，Step 2.5 或 Step 5）**：fork 分支、diff 還原引擎、紀元樹視圖、canon 切換、封存剪枝。
- **Step 3**：出團 meta 帶 eraId；出團記錄 → 推進/分支入口。
