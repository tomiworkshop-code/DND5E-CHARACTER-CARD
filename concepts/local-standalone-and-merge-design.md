# 本地單機跑團模式 + 離線異動可追溯合併 設計 (local-standalone-and-merge-design)

> 目標：讓「冒險者之書（用戶版 `v2/`）」在**無 DM、無房間**下自給自足跑團（需求 1），
> 並能把本地跑出的進度**上傳提案**給「敘事者之書（DM 版 `worldbuilder-v2/`）」由 DM 決定採納（需求 2），
> 且離線異動全程帶**版本戳記／異動來源標記**，供 DM **差異比對 + 採納/部分採納**（需求 3）。
> 需求來源：Tommy 2026-08-09 定案（見 `memory/projects/projects_tracker.md`「DND5E-CHARACTER-CARD」段）。
> 觸發背景：2026-08-08 實戰跑團 DM 未用 DM 版，暴露用戶版被強耦合在「連線房間」流程上。

## 0. 硬需求（Tommy 2026-08-09 定案）
1. **完全獨立單機跑團（Local Standalone）**：用戶版本地擲骰、本地落帳、本地暫存角色與戰役進度；
   本地模式對自己資料具**完整權威**（不需等 DM `version_m` 校驗）；作為「DM 缺席／純紙本口述」fallback。
2. **本地進度上傳 DM 版，採納權在 DM**：本地跑出的進度／升級／狀態變更可上傳「提案」；
   DM 端自行決定採納落帳（延伸既有「提案 → DM 校驗 → DM 落帳 → 回推」到「離線先跑、之後補提案」）。
3. **離線異動可追溯合併（Traceable Merge）**：本地進度從一開始就帶版本戳記／異動來源標記
   （哪些欄位在離線期間變更、變更時間與來源）；DM 上傳提案時能差異比對、支援「採納或部分採納」，
   避免撞車或無腦覆蓋；沿用 `version_m`/`version_n` 骨架 + 補「離線異動 changelog」。

## 1. 現況分析（為何強耦合房間、目前 local 存檔結構、缺口在哪）

### 1.1 既有存檔資料模型（`shared/store.js`）
- **LS keys**（`STORE.LS`）：`dnd_identities_v2` / `dnd_instances_v2` / `dnd_worlds_v2` /
  `dnd_active_world_v2` / `dnd_active_instance_v2` / `dnd_schema_ver` / `dnd_active`。
- **三段拆解**：
  - `identity`（身份/敘事，`version_n` 權威在玩家）：`pickIdentityFields`（store.js:70-81）。
  - `instance`（機制，`version_m` 權威在 DM）：`pickMechanicalFields`（store.js:83-118），
    key = `characterId + "@" + worldId`。
  - `narrative`（instance 內敘事：notes/familiar 敘事欄）：`pickInstanceNarrative`。
  - `worldProgress`（角色在各世界的進度存檔槽：location/time/quest/records）掛在 instance。
- **compose/decompose**：`composeC`（store.js:121-141）把三段組回 live char；
  `decomposeC`（store.js:143-179）偵測差異並 **bump `version_m`/`version_n`**、寫回 instance。
- **雙版本骨架**（`shared/character-schema.js`）：`FIELD_ZONES.mechanical/narrative`（schema:28-45）、
  `_sync:{version_m,version_n}`、`mergeInstance`（schema:238-253，版本閘：remote.version_m ≥ local 才套機制區）、
  `extractZone/applyZone/bumpVersion`。

### 1.2 目前「本地」其實已可寫檔（需求 1 半成品）
- `v2/app.js` `worlds` 預設含 `{ id:'__solo__', name:'單人漫遊', type:'local' }`（app.js setup 內）；
  `selectedWorldKey` 預設 `'__solo__'`；`isDMWorld = selectedWorldKey !== '__solo__'`。
- **關鍵**：`chars` 的 deep `watch`（app.js「watch(chars…)」段）呼叫 `decomposeC` 直接把玩家編輯落帳到
  instance 並 bump `version_m` —— 亦即**本地直接編輯 = 本地即時落帳、本地即權威**，此路徑**不需房間**。
- 因此「需求 1」的資料落帳骨幹**已存在**；缺的是「模式化的 UI/狀態機、本地擲骰、本地戰報落帳體驗」。

### 1.3 房間強耦合點（真正的缺口所在）
- **提案唯一通道 = 即時房間**：目前玩家把進度交給 DM，**只有**在 `joinRoom`（app.js:1230+ 一段）
  連上 Firebase 後，經 `onSave`/`onCommand`/`sendRoomRequest` 才會發生。離線時**無任何提案出口**。
- `sendRoomRequest`（app.js）與 `room.js` 的 `sendRequest/onRequests/resolveRequest` 只送**純文字**
  （`resolveConflict('keep_local')` 送的 `{kind:'ask', text:'【存檔提案】…'}`）——**沒有結構化提案封包**，
  DM 無法據以做欄位級差異比對／部分採納。
- `sendRoomRequest` 前置條件 `room.status !== 'connected'` 直接 return（app.js），**離線完全不能提案**。
- `worldbuilder-v2` DM 端目前**只**從即時 roster（`onPlayers` 快照）走 `adoptProposal`（wb-v2/app.js:1299）
  / `submitEditFinalize`（wb-v2/app.js:1316）；**尚未訂閱 `onRequests`**（grep 無命中），
  也**沒有**「收離線快照提案」的入口。
- `worldId` 一致性由 `_syncWid`（app.js watch）決定：連線時跟 `room.meta.worldId`，否則 `DEFAULT_WORLD_ID`。

### 1.4 具體缺口清單
| # | 缺口 | 位置 | 影響需求 |
|---|------|------|----------|
| G1 | 無本地擲骰器（全 repo grep `roll/d20/擲骰` 無命中） | v2 全體 | 需求 1 |
| G2 | 無「本地/連線」明確模式狀態機與進入點；solo 只是一個世界 id | app.js `selectedWorldKey`/`isDMWorld` | 需求 1 |
| G3 | `worlds` 預設 `'__solo__'` 與 `STORE.DEFAULT_WORLD_ID='w_local_default'` **不一致**：機制欄位落帳到 `@w_local_default`，worldProgress 卻掛 `__solo__` | store.js:31 vs app.js worlds 預設 | 需求 1（隱性 bug） |
| G4 | 離線無提案出口（`sendRoomRequest` 要求 connected） | app.js `sendRoomRequest` | 需求 2 |
| G5 | 提案封包非結構化（純文字），DM 無法欄位級比對 | app.js/room.js requests | 需求 2/3 |
| G6 | DM 端未訂閱 `onRequests`、無「離線提案收件匣」 | worldbuilder-v2/app.js | 需求 2 |
| G7 | `decomposeC` 只 bump 版本，**無欄位級 changelog**（誰/何時/從何值→何值/來源） | store.js:143-179 | 需求 3 |
| G8 | `mergeInstance` 只有「整區覆蓋 + 版本閘」，無「部分採納（逐欄挑選）」能力 | schema.js:238-253 | 需求 3 |

## 2. 需求 1 設計：本地單機模式（Local Standalone）

### 2.1 設計原則
- **零破壞加法**：不動既有連線流程；本地模式是既有「solo 世界直接落帳」路徑的**正規化 + 補全**。
- **本地即權威**：本地世界內玩家編輯直接落帳、`version_m` 由玩家自己遞增（維持既有 `decomposeC` 行為）。
- 不引入骰子引擎爭議：DM 版刻意「不做骰子引擎」（dm-v2-spec §4），但**用戶版單機無 DM**，
  故用戶版**需要**一個本地擲骰器作為 fallback（此為兩 App 的合理差異，非矛盾）。

### 2.2 模式狀態機（本地 / 連線）
新增顯式 `sessionMode` 衍生狀態（computed，不新增平行真相；由既有狀態推導）：

```
sessionMode =
  room.status === 'connected'                 -> 'connected'   // 連線 DM 房間，機制面 DM 權威
  selectedWorldObj.type === 'local'|'solo'    -> 'local'       // 本地單機，玩家完整權威
  selectedWorldObj.type === 'dm' && !connected -> 'offline-dm'  // 曾連過的 DM 世界但目前離線（可離線先跑、之後補提案）
```

- `local`：完整本地權威；所有編輯/擲骰/戰報即時落帳；無提案概念（自己就是 DM）。
- `offline-dm`：對「DM 世界的本地副本」離線跑團，異動寫入 **離線 changelog（§4）**，待重新連線或匯出時**補提案**。
- `connected`：維持現況（DM `version_m` 權威、`onSave`/`onCommand`/衝突 UI）。
- **狀態顯示**：header 或世界卡加一枚模式徽章（🏠本地 / 📡連線 / 🕳️離線待提案），讓玩家一眼分辨權威歸屬。

### 2.3 UI 進入點
- 沿用既有「右上角 global switcher（角色→世界）」：本地模式 = 選 `type:'local'` 世界即進入，無需任何連線動作。
- **首次啟動 fallback**：無任何世界時，預設落在「🏠 單人漫遊（本地）」，可立即建角開跑（zero-config）。
- 「加入 DM 房間」保持獨立按鈕；本地與連線**互斥切換**（切到連線世界才 `joinRoom`）。
- 「離線先跑」入口：`offline-dm` 世界卡上放「🕳️ 離線續跑」按鈕，不連 Firebase 直接進場。

### 2.4 本地擲骰 + 本地落帳流程（補 G1）
新增輕量 `shared/services/dice.js`（純函式、可單測、框架無關；不動既有 shared）：
- `roll(expr)`：解析 `NdM(+/-K)`（如 `1d20+5`、`2d6`、`4d6kh3` 進階可延後），回 `{ total, rolls[], expr, ts }`。
- **不自動改數值**：擲骰結果進「本地戰報（worldProgress.records.log）」，玩家決定是否套用到 HP/資源等。
- **可選一鍵套用**：傷害/治療擲骰 → 一鍵寫入 `char.hp`（走既有 reactive → `decomposeC` 落帳，玩家 `version_m` 遞增）。
- 落帳一律經既有 `chars` deep watch → `decomposeC`，**不新開落帳路徑**（維持單一真相）。

### 2.5 資料存放位置與鍵名（含修 G3）
- **沿用既有 LS keys**，不新增頂層 key。本地世界統一用 `STORE.DEFAULT_WORLD_ID`。
- **修 G3（決策點 D1，✅ 已定案）**：統一本地世界 id。**定案採 `STORE.DEFAULT_WORLD_ID`（`'w_local_default'`）為準**：
  把 UI 預設世界物件的 `id` 從 `'__solo__'` 改為 `STORE.DEFAULT_WORLD_ID`（`selectedWorldKey` 預設、template 比對同步改）；
  並提供一次性 `migrateSoloWorldId()` 把 `worldProgress['__solo__']` 併入 `worldProgress['w_local_default']`（冪等、不覆蓋）。
  → 此為既有隱性 bug 修復（已於 PR-Local-1 實作）。
- 離線 changelog 存於 instance 內新欄位 `offlineLog`（§4.1），隨 `dnd_instances_v2` 一起持久化，無新增 key。

### 2.6 隔離：不破壞既有連線流程
- `sessionMode==='local'` 時**完全不 init Firebase**（沿用 app.js 既有「延遲初始化」鐵律）。
- 本地落帳不寫 `_sync` 以外的 DM 專屬欄位；連線世界與本地世界是不同 `worldId` instance，天然隔離。
- `applyCommand`/`handleRemoteSave`/`onSave` 僅在 `connected` 生效，本地模式不觸及。

## 3. 需求 2 設計：本地→DM 提案上傳（採納權在 DM）

### 3.1 提案封包格式（Proposal Packet，補 G5）
在既有「完整快照 `buildPlayerSnapshot`」之上，新增一層「提案」（快照 + 離線 changelog + 版本基準）：

```
Proposal = {
  kind: 'save-proposal',            // requests 通道新 kind（與既有 ask/add 並存）
  proposalId,                        // uid，幂等去重用
  characterId, name,
  baseSync: { version_m, version_n },// 這份離線進度「從哪個版本分叉而來」（合併基準）
  proposedSync: { version_m, version_n },
  snapshot: <buildPlayerSnapshot().full 形狀，已截斷>,  // 全量快照（供 DM 逐欄取值）
  changelog: [ <FieldChange> ],       // §4.1：離線期間改了哪些欄、何時、來源
  origin: { mode:'local'|'offline-dm', worldId, deviceHint, exportedAt },
  ts
}
```

- **不破壞快照契約**：`snapshot` 沿用 `buildPlayerSnapshot().full`（app.js），仍帶 `full.sync`；
  `changelog`/`baseSync` 為**新增包層**，舊 DM 版本只讀得懂 snapshot 部分（降級相容）。

### 3.2 傳輸管道（雙軌）
兩種都支援，依情境選（決策點 D2）：
1. **Firebase requests 通道（重連後自動補提案）** — 主路徑：
   - 沿用 `room.js` `sendRequest(db,roomId,pid,req)`，`req` = 上述 Proposal（`pruneUndef` 已處理）。
   - 解除 `sendRoomRequest` 的 `connected` 硬限：離線時先把 Proposal 排入**本地待發佇列**
     （LS `dnd_pending_proposals`），下次 `joinRoom` 同房間成功後自動 flush 送出→ 成功後才清除。
   - DM 端新增 `onRequests` 訂閱（補 G6）→ 「📬 提案收件匣」。
2. **離線快照匯出/匯入（無網也能交）** — fallback：
   - 玩家「📤 匯出提案 JSON」（沿用 `exportData` Blob/anchor 手法）→ 給 DM；
   - DM 端「📥 匯入離線提案」→ 進同一個提案收件匣（與管道 1 共用採納/部分採納 UI）。
   - 好處：純紙本口述場景也能補帳，不依賴 Firebase。

### 3.3 DM 端採納 / 部分採納 / 駁回 UI 與落帳
- 延伸既有 `adoptProposal`（wb-v2/app.js:1299）、`submitEditFinalize`（wb-v2/app.js:1316）。
- 新增「提案收件匣」分頁：列待處理 Proposal（roster 離線也可見），點入顯示§4.2 差異表。
- 三個動作：
  - **全採納**：同現行 `adoptProposal` → 寫 `world.charSaves[cid]`（dmv2 隔離）；需回推則 `setSave` 回送。
  - **部分採納**（新，補 G8）：勾選 changelog 中部分欄位 → 只將這些欄位套用（見§4.3 合併演算）。
  - **駁回**：`resolveRequest` 刪除提案（或標 rejected），不動正史；可附駁回原因 inbox 回玩家。
- **回推**：採納/部分採納後 `version_m` 前進 → `setSave(db,roomId,cid,partial)` 回送（最小 partial）；
  玩家端 `handleRemoteSave/adoptRemoteSave`（app.js）已支援版本裁決。離線提案的回推需玩家**下次重連**才生效（可接受）。

### 3.4 安全紅線（沿用 dm-v2-spec）
- 玩家送的永遠是「提案」，DM 未採納前不動正史（`charSaves`）。
- 回推只帶 DM 實際採納的 schema 欄位；`applyZone` 只套「存在的 key」，
  玩家的技能/背包/魔寠/敘事不被快照摘要版覆蓋損壞（紅線沿用）。

## 4. 需求 3 設計：離線異動可追溯合併（Traceable Merge）

### 4.1 離線異動 changelog 資料結構（補 G7）
在 store instance 新增加法欄位 `offlineLog`（預設 `[]`），每筆 FieldChange：

```
FieldChange = {
  path,        // 欄位路徑，如 'hp.current' / 'coins.gp' / 'classes' / 'inventory'
  zone,        // 'mechanical' | 'narrative'（取自 FIELD_ZONES）
  from, to,    // 變更前/後值（已 JSON 快照；大陣列可只存摘要+長度）
  at,          // 變更時間戳
  source,      // 'local-edit' | 'local-dice' | 'local-command'（本地落帳來源）
  baseVm       // 變更發生時的 version_m 基準（合併判斷用）
}
```

- **產生點**：擴充 `decomposeC`（store.js:143-179）— 目前它已用 `JSON.stringify` 做新舊比對；
  在偵測到差異並 bump 版本時，同步逐欄算出 diff 推進 `offlineLog`。
  → **只在 `sessionMode !== 'connected'`（本地/離線）時記錄**；連線時維持現況不寫 log。
- **採集粒度**（決策點 D3）：建議頂層欄位粒度（如 `hp`/`coins`/`inventory`/`classes`），
  避免陣列內逐元素 diff 過於複雜；陣列型欄位存「前/後快照 + 簡要摘要」即可。
- **版本戳記策略**：`baseSync`（分叉起點）+ `proposedSync`（目前）+ 每筆 `baseVm`；
  沿用單調遞增 `version_m`/`version_n`（不改現況語意）。`offlineLog` 在提案被 DM 採納後可標 flushed/清理。

### 4.2 DM 端差異比對
DM 提案收件匣點入後，以三方對照表呈現（比現有 `conflictDiff` app.js 更详）：
| 欄位 | DM 正史（charSaves）| 提案基準（baseSync）| 提案新值 | 來源/時間 | ☑ 採納 |
只列出 `changelog` 有變動的欄位（避免满屏）；支援「全選/全不選/逐欄勾選」。
- **撞車偵測**：若 DM 正史 `version_m` > 提案 `baseSync.version_m`（表示離線期間 DM 那邊也改了同欄）
  → 標記為「⚠️ 衝突欄位」，需 DM 逐欄手動裁決（不自動覆蓋）。

### 4.3 部分採納合併演算（含衝突處理，補 G8）
新增 `shared/character-schema.js` `mergeInstancePartial(canon, proposal, pickedPaths)`（加法、不改 `mergeInstance`）：
1. 以 DM 正史 `canon` 為基底。
2. 只對 `pickedPaths` 列出的欄位，從 `proposal.snapshot` 取值套回（逐欄 set by path）。
3. 每套一欄 → 校驗該欄 `baseVm` 是否 == canon 當前 version_m；不符（撞車）則跳過並回報需手動裁決。
4. 成功套用 → `bumpVersion(canon,'mechanical'|'narrative')`（依欄位 zone），寫 `charSaves`，回推 partial。
- **衝突處理原則**：寧可少套不要錯套；任何 baseVm 不符的欄位一律交 DM 手動，絕不無腦覆蓋（沿用 mergeInstance 的保守哲學）。

## 5. 相容性與安全
- **舊角色卡遷移**：`mergeChar`/`ensureSync`（schema.js）已做 `_sync` 回填；`offlineLog` 缺省→`[]`，
  `baseSync` 缺省→取現行 `_sync`。舊快照無 `changelog` 時 DM 端降級為「全採納/就地編輯」（現況行為）。
- **零破壞加法原則**：三項需求均為新增欄位/新增 service/新增 UI 分頁，
  不改既有 `composeC/mergeInstance/joinRoom/applyCommand` 行為（只擴充）。
- **風險點**：
  - R1：`offlineLog` 無上限會肥大 LS→ 需上限（如每 instance 200 筆 / 提案 flush 後清）。
  - R2：G3 世界 id 遷移若做錯會串檔（不同玩家/世界）→ 遷移須冪等 + 先備份（exportData），先寫測試。
  - R3：離線提案回推須玩家重連才生效，需 UI 明確提示「待重連套用」，避免玩家誤以為已同步。
  - R4：本地擲骰一鍵套用不可讓玩家在連線世界偽造 version_m 領先→ 只在 local/offline-dm 模式開放。

## 6. 落地拆解（可獨立驗收的開發任務）
建議順序與相依：

| PR | 內容 | 相依 | 驗收 |
|----|------|------|------|
| **PR-Local-1** ✅ | 修 G3：統一本地世界 id + worldProgress 遷移（冪等、不覆蓋） **+ `sessionMode` 狀態機 + 模式徽章**（本次合併交付） | — | 舊 `__solo__` 進度併入新 id、無串檔；徽章正確；本地不 init Firebase |
| **PR-Local-2** ✅ | （已並入 PR-Local-1 的 sessionMode）本地/連線互斥切換 UI 細部強化 **+ 精準世界比對徽章**（本次落地：徽章依實際世界物件精準比對顯示） | PR-1 | 本地世界不 init Firebase；徽章正確 |
| **PR-Local-3** ✅ | `shared/services/dice.js` 本地擲骰器 + 戰報落帳 + 可選一鍵套用 HP（本次落地：新增 `dice.js`、戰報記錄、僅 HP 套用走 decomposeC bump） | PR-2 | 圖骰/可重現；hp 套用走 decomposeC bump |
| **PR-Local-4** ✅ | `offlineLog` changelog：擴充 `decomposeC` 逐欄 diff + 上限 + source 標記（本次落地：instance 內加法欄位 `offlineLog`、頂層欄位粒度 `FieldChange{path,zone,from,to,at,source,baseVm,[summary]}`、僅 `mode !== 'connected'`（local/offline-dm）時記錄、`OFFLINE_LOG_LIMIT=200` 超出丟最舊） | PR-2 | 本地編輯→ log 正確記 from/to/at/source；connected 不寫；上限裁切 |
| **PR-Local-5** | 提案封包 `buildProposal` + 本地待發佇列 + 重連 flush | PR-4 | 離線排佇、重連自動送出 |
| **PR-Local-6** | 提案 JSON 匯出/匯入（無網 fallback） | PR-5 | 匯出檔 DM 可匯入 |
| **PR-DM-1** | DM `onRequests` 訂閱 + 「提案收件匣」分頁 + 差異表 | PR-5 | 收到離線提案、列差異 |
| **PR-DM-2** | `mergeInstancePartial` + 部分採納/駁回 UI + 回推 partial | PR-DM-1, PR-Local-4 | 逐欄採納、撞車欄交手動 |
| **PR-DM-3** | DM 匯入離線提案 JSON → 同收件匣 | PR-DM-1, PR-Local-6 | 匯入後可採納 |

> **Implementation status（2026-08-09）**：PR-Local-1／PR-Local-2／PR-Local-3／PR-Local-4 已交付；下一步 **PR-Local-5**（提案封包 `buildProposal` + 本地待發佇列 + 重連 flush）。
>
> **Follow-up 決策註記（PR-Local-4）**：本 PR 的 changelog 依 §4.1／D3 只追 **mechanical／narrative／identity** 三類欄位的逐欄異動；`worldProgress`（location/time/quest/records）**照舊隨 instance 持久化，但不進 `offlineLog`**。worldProgress 是否納入「提案 changelog」（供 DM 差異比對）留待 **PR-Local-5 提案封包（`buildProposal`）設計時明確決定**（本 PR 不預判；PR-Local-5 尚未实作）。

## 7. 決策點（Tommy 2026-08-09 全數拍板 → 已定案）

> 狀態：**6 項全數定案**（Tommy 2026-08-09 拍板全採設計文件建議）。以下為最終規格，實作以此為準。

- **D1 本地世界 id 統一** — ✅ **已定案**：採 **`'w_local_default'`**（store 現值）為唯一標準；
  UI 端 `'__solo__'` 全數改對齊，並提供一次性冪等遷移把 `worldProgress['__solo__']` 併入 `worldProgress['w_local_default']`（不覆蓋）。
- **D2 主傳輸管道** — ✅ **已定案**：離線提案**主管道走 Firebase requests（重連自動補提案）**；JSON 匯出/匯入為**備援**（無網 fallback）。
- **D3 changelog 採集粒度** — ✅ **已定案**：**先做頂層欄位粒度**（如 `hp`/`coins`/`inventory`/`classes`）；陣列型欄位存前/後快照 + 簡要摘要。
- **D4 部分採納粒度** — ✅ **已定案**：DM 逐欄勾選**對齊 changelog 頂層欄位粒度**，不再更細。
- **D5 本地擲骰自動套用範圍** — ✅ **已定案**：**MVP 僅自動套用 HP**；其餘（資源/法術位/死亡豁免）維持手動。
- **D6 離線提案 DM 部分採納後、未採欄位處置** — ✅ **已定案**：**玩家端保留未被採納的欄位（繼續領先）**，不強制對齊 DM。
