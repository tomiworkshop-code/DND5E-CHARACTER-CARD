# DM v2 Step 4 施工清單 — 訊息模板系統 + 遭遇模組

> 定案 2026-07-21（Tommy）。詳規見 `dm-v2-spec.md` §4。
> 紀律：每步 `node --check` → 測試全綠（不回歸）→ 版號 badge → git commit + push；工作樹保持乾淨。
> 隔離：所有 localStorage key 走 `dmv2:` 前綴，不污染玩家版 `v2/`。

## 定案要點
- 不做骰子引擎（現場擲實體骰）；模板從 DM「訊息模板庫」選。
- 具名變數 `{變數名}`；套用時每變數生獨立**搜尋式選擇器**（軟過濾、不鎖死、可切顯示全部/自由打字）。
- 選單池：roster 玩家 + 世界實體(NPC/地點/任務/線索/事件) + 遭遇怪物 + 自由輸入。
- 按鈕後 → 填變數 → **可編輯預覽框** → 確認送出。
- B：變數綁指令（damage/heal/xp/gold/item）；damage/heal 只對「連線玩家」；指令對象另設欄位＝roster 玩家。

## 4.0 遭遇 (Encounter) 模組 — ✅ 完成 (DM v2.5.0 / Build 0721.9)
- [x] 資料模型：新實體型別 `type:'encounter'`，三軸 `questId?/locationId?/eraId?` + `monsters:[{name,count,notes}]` + `story/notes/status`。
- [x] 儲存走現有 entity 管線（world.entities，`dmv2:` 隔離）。
- [x] UI：任務/地點/時間點詳情底下掛「遭遇」子區塊（列表 + 怪物子清單編輯）；新增自動帶對應三軸 id。
- [x] 提供 `encounterMonsters` 攤平清單（給 4.4 `{monsterName}` 選單用）。
- [x] 測試（模型/三軸關聯/怪物子清單 CRUD）+ 回歸 + push。

## 4.1 模板資料模型 — ✅ 完成 (DM v2.5.1 / Build 0721.10)
- [x] `{ id, name, kind:'broadcast'|'inbox'|'command', text, vars:[{name,hint?}], command? }`。
- [x] 變數 `hint` = 預設提示過濾來源（roster/npc/location/quest/clue/event/monster/free），不鎖死。
- [x] command（可選）：`{ type:'damage'|'heal'|'xp'|'gold'|'item', amountVar?, targetIsRoster:true }`。
- [x] `dmv2:dnd_templates_v2` 儲存 + 內建範例 seed。
- [x] 測試 + push。
- 實作：純邏輯 `shared/templates.js`(DND5E_TEMPLATES: scanVars/guessHint/normalize/applyValues/missingVars/builtins/parseLibrary) + DM app 儲存層(`dmv2:dnd_templates_v2` 全域、首載 seed 5 內建、upsert/delete/reset)。test `test_dmv2_step4_templates.js`(44)。

## 4.2 模板設定 UI（CRUD）
- [ ] 模板清單、新增/編輯/刪除；變數自動偵測 + 每變數標 hint；指令綁定設定。
- [ ] 測試 + push。

## 4.3 套用流程
- [ ] 選模板 → 掃出 `{變數}` → 每變數生搜尋式選擇器（依 hint 預設過濾，可切全部/自由輸入；`{playerName}` 自動帶入已選 roster 目標）。
- [ ] 變數代入 → 可編輯預覽框。
- [ ] 測試 + push。

## 4.4 對接發送 + 指令執行
- [ ] broadcast/inbox/command 三通道；指令對象＝roster 玩家；`{monsterName}` 接遭遇攤平清單。
- [ ] 送訊息 +（可選）送指令；確認護欄。
- [ ] 測試 + push。

## 4.5 收尾
- [ ] 內建範例模板（攻擊命中、陷阱、寶箱奇遇、技能檢定結果）。
- [ ] 完整回歸全綠；spec/checklist 標記完成；push。
