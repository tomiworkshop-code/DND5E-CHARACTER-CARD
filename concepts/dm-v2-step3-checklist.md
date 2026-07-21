# DM v2 — Step 3 開團連線 + Roster 施工清單

> 目標：DM v2 第一次真正接上 Firebase。開房 → 玩家 join → roster 收「完整快照」→
> 提案/定案流程 → 玩家快照落地備份。依 dm-v2-spec §3 / §7。
> 原則：玩家=提案、DM=權威；未定案不動 DM 正史。每步語法檢查 + 測試全綠 + commit push。

## 現況盤點（已就緒 / 待補）
- ✅ `shared/room.js` API 完整：`createRoom / joinRoom / onPlayers / sendBroadcast /
  setSave / getSave / onSave / sendCommand / onCommand / sendRequest / onRequests`。
- ✅ DM v2 `initFirebase()` 已「備妥不開團」、`firebaseReady` flag 已在。
- ✅ 分頁佔位：「🔗 開團」「👥 玩家記錄（Step 3 即將推出）」。
- ⚠️ 玩家端 `buildPlayerSnapshot`（v2/app.js:836）目前**只送 Tier1**（name/level/hp/ac/characterId）
  → Step 3 需擴充送「完整 mechanical + narrative」或走 saves proposal 通道（§3 依賴項）。
- ⚠️ DM v2 尚無 roster / 提案定案 / 快照備份 的 UI 與邏輯（本步主體）。

## 施工項目

### 3.1 DM 開房（createRoom + QR）— ✅ 完成 (DM v2.3.0 / Build 0721.4)
- [x] 「開團」分頁：DM 匿名登入（`signInAnon`）→ `createRoom(db, opts)`。
- [x] **主流程 = 選任務開團**（Tommy 2026-07-21 定案）：DM 從當前世界選一個任務(quest)開團 →
      `worldId` 由該任務自動帶出（不必手選世界）。
- [x] `questId` **設為可選**：允許「不綁任務的自由團 / session zero / 開場團」也能開房。
- [x] `eraId` **獨立保留**（不由任務推導）：預設 = 該世界 `currentEraId`（canon tip），DM 可覆寫錨到別的節點。
      原因：同一任務可在不同 era 分支跑（§10 平行線哲學），quest 與 era 是正交兩軸。
- [x] room.meta 資料契約：`{ worldId, questId?, eraId, dmId, createdAt, status }`（room.js createRoom 已擴充）。
- [x] 顯示 5 碼房號（大字、可複製）+ QR（qrcodejs，編碼 `../v2/index.html?room=CODE`）。
- [x] 房間狀態：關房按鈕 → `setRoomStatus(db,roomId,'closed')`（room.js 新增 helper）。
- 測試：`test_dmv2_step3_room.js`(18) + `test_dmv2_step3_ui.js`(15 jsdom 冒煙) 全綠；既有 worldset(71)/scaffold(19)/isolation(15) 無回歸。

### 3.2 Roster 名冊（收完整快照）— ✅ 完成 (DM v2.3.1 / Build 0721.6)
實作：onPlayers 訂閱 → rosterList（名/等/HP/AC、依 joinedAt 排序）；點卡開詳情抽尜（屬性/豁免熟練高亮/技能●★/被動察覺/魔寵/背包重點/敘事，唯讀）；舊版無 full 降級顯示；即時同步；關房退訂清空。測試 `test_dmv2_step3_ui.js` 共 23 項全綠。(以下原規劃項均已實作)
- [ ] `onPlayers(db, roomId, cb)` 訂閱 → 名冊卡片列（頭像/名/等級/HP/AC 即時）。
- [ ] 點卡片開「玩家詳情」抽屜：技能/豁免/被動察覺/魔寵(陣列)/背包重點（唯讀檢視）。
- [ ] **依賴**：玩家端 `buildPlayerSnapshot` 擴充完整欄位（見 3.5）；DM 端解析一律走 `DND5E_CHAR`。

### 3.3 提案 → 定案流程（§3 核心）
- [ ] 玩家送來 = 「提案」，roster 標示「未定案」。
- [ ] 「📥 採納為世界存檔」：直接套用提案到 DM 世界存檔（實作/沿用 `adoptWorldSave` 雛形）。
- [ ] 「✏️ 就地編輯後定案」：DM 改數值 → 存 DM 權威版（`version_m` 前進）→
      `setSave(db,roomId,characterId,save)` 回送 → 玩家端 `handleRemoteSave` 做版本裁決/衝突 UI。
- [ ] 未定案前**不影響** DM 世界正史（隔離）。

### 3.4 玩家快照落地備份（§7 基礎）— ✅ 完成 (DM v2.3.2 / Build 0721.7)
實作：onPlayers 推播時 archiveRoster() → 寫入 world.playerSaves[characterId]={latest,latestTs,history[],firstSeen,lastSeen}（走 dmv2: adapter，不污染玩家版）；latest 僅變動時寫入、舊版進 history（精簡 ts/level/hp，上限 10）；characterId 為鍵；無 cid 不備份。「👥 玩家記錄」分頁列本世界快照 → 點入詳情抽尜+歷史；關房後備份仍保留。回送恢復 UI 順延 3.3/§7。測試 test_dmv2_step3_ui.js 共 32 項全綠。(以下原規劃項均已實作)
- [ ] DM 收快照後寫入 DM 命名空間（`dmv2:`）：按 `世界 → 玩家(pid/characterId) → 快照` 歸檔。
- [ ] 保留最新一份 + 精簡歷史（時間戳 + version_m/version_n）。
- [ ] 「👥 玩家記錄」分頁：列此世界曾出現的玩家 → 點入看快照/歷程（恢復 UI 可挪 Step 3 尾或 Step 4）。

### 3.5 玩家端配合（v2/app.js，跨端小改）— ✅ 完成 (玩家版 v2.2.4 / Build 0721.5)
- [x] 擴充 `buildPlayerSnapshot`：Tier1 頂層不變，新增巢狀 `full` 區：
      abilities(6)/profBonus/initiative/saves(6+prof)/skills(18+熟練專精)/passivePerception/
      familiars(陣列)/inventory(已裝備優先、上限40)/narrative(截斷)/classes/race…。
- [x] 相容性：舊單一 `c.familiar` → familiars 陣列；字串背包 → 正規化物件。
- [x] 安全：full 整段 try/catch，建構丟例外→退回純 Tier1（絕不中斷 join/上傳）。
- [x] Tier1 頂層欄位原樣保留 → 玩家版 roster/現有顯示不受影響。
- 測試：`test_dmv2_step3_snapshot.js`(25，逐字擷取真碼)；玩家版回歸全綠
      (p2b_onsave 49 / p2b_jsdom 10 / skills_saves 24 / familiars 2 / migration / jsdom)。
- 後續：「proposal/saves 通道定案」仍依§3 於 3.3 處理；本步先讓 players 快照帶完整資料供 3.2 roster 收。

### 3.6 測試 & 收尾
- [ ] 新增 `test_dmv2_step3_*.js`：mock db（記憶體）驗 createRoom/onPlayers/setSave 契約 + 快照備份寫入 `dmv2:` key。
- [ ] `node --check` 全綠 + 既有測試(含 71 項 worldset)不回歸。
- [ ] 手機/平板響應式檢查（roster 卡片、QR、抽屜）。
- [ ] 版本徽章 bump → commit + `git push origin main`。

## 風險/注意
- Firebase Spark 免費方案：注意併發/流量；先只做 room 通道，勿灌大 payload。
- 安全靠 Realtime DB 規則（FIREBASE-SETUP.md 第 5 步），非前端 config。
- 提案/定案務必保持「未定案不動正史」的隔離，避免污染 DM 世界存檔。
- 跨端改動（3.5）要同時顧玩家版回歸測試，避免動到別人正在用的野團流程。

## 建議施作順序（可獨立驗證的小段）
1. 3.1 開房 + QR（先能開房、看到房號）
2. 3.5 玩家端完整快照（讓 roster 有料可收）
3. 3.2 Roster 檢視（唯讀）
4. 3.4 快照落地備份
5. 3.3 提案/定案（最需謹慎，最後做）
6. 3.6 測試 + push
