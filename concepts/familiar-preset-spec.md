---
title: "魔寵範本匯入 (Familiar Preset Import) — 規格"
type: "project/spec"
resource: "project:DND5E-CHARACTER-CARD"
date: "2026-07-20"
status: "approved-design"
owner: "Tommy (Admin)"
---

# 魔寵範本匯入 (Familiar Preset Import)

## 1. 目標
在「冒險者之書」(v2) 角色的魔寵區，新增「從範本中匯入」功能：玩家從官方範本清單選一種，帶入固定機制數據，欄位仍可覆寫。

## 2. 已拍板決策 (2026-07-20, Tommy 確認)
- **方案**：範本 + 可覆寫（匯入帶值，欄位仍可編輯）。
- **觸發**：明確的「從範本中匯入」按鈕（**不自動覆蓋**；點擊 → 選單 → 確認後才寫入，避免誤蓋玩家已填數據）。
- **分組（tier）**：
  - `srd`：**尋找魔寵 (Find Familiar)** — SRD 5.1 CR0 野獸清單。
  - `pact`：**鎖鏈契約 (Pact of the Chain)** — 官方進階魔寵（**取代 homebrew「高等尋找魔寵」**；走官方數據，版權乾淨）。
  - ⛔ 不做 homebrew「Find Greater Familiar」（非官方，已否決）。
- **主權閘門**：能否匯入由「世界主權 (DM / 本地)」決定（見 §5）。

## 3. 資料結構
每筆 preset 對齊 `defaultFamiliar()` 形狀，並多帶 `tier`：
```
{
  id, tier: 'srd' | 'pact',
  name: '',            // 留空給玩家自取名（敘事面）
  type: '貓 (Cat)',    // 種類標籤
  speed: '30呎，攀爬30呎',
  ac: 12,
  hp: { current: 2, max: 2 },
  abilities: { str, dex, con, int, wis, cha },
  attacks: '爪 +0，1 傷害',   // 文字描述，可多行
  notes: '敏銳嗅覺；被動察覺13。可攻擊：否'
}
```
- 建議新檔 `shared/familiar-presets.js`，掛 `window.DND5E_FAMILIAR_PRESETS`（UMD/IIFE，與 character-schema 同風格，可被 v2 `<script>` 及 node 測試引用）。
- **資料來源**：SRD 5.1 (CC-BY-4.0) 野獸 + Pact of Chain 官方數據。SRD 數值請以官方 stat block 交叉核對，勿臆造。

## 4. 清單內容
### 4.1 tier=srd（尋找魔寵，CR0 野獸）
bat 蝙蝠 / cat 貓 / crab 螃蟹 / frog 青蛙(蟾蜍) / hawk 鷹 / lizard 蜥蜴 /
octopus 章魚 / owl 貓頭鷹 / poisonous snake 毒蛇 / quipper 魚 / rat 老鼠 /
raven 渡鴉 / sea horse 海馬 / spider 蜘蛛 / weasel 鼬。
（皆 `可攻擊：否`；沿用 SRD 各自 AC/HP/速度/能力值/攻擊。）

### 4.2 tier=pact（鎖鏈契約，官方 4 種，**可自行攻擊**）
| 種類 | AC | HP | 速度 | STR/DEX/CON/INT/WIS/CHA | 攻擊/特長重點 |
|---|---|---|---|---|---|
| 小惡魔 Imp | 13 | 10 | 20，飛40 | 6/17/13/11/12/14 | 螫刺 +5，1d4+3 刺 + 3d6 毒；變形、隱形、魔法抗性、魔鬼視覺 |
| 類魔 Quasit | 13 | 7 | 40 | 5/17/10/7/10/10 | 爪 +4，1d4+3 + DC10 毒；變形、隱形、魔法抗性 |
| 偽龍 Pseudodragon | 13 | 7 | 15，飛60 | 6/15/13/10/12/10 | 咬 +4 1d4+2；螫 +4 2d4+2 + DC11 毒睡；敏銳感官、魔法抗性、有限心靈感應 |
| 小魔靈 Sprite | 15 | 2 | 10，飛40 | 3/18/10/14/13/11 | 短劍 +2 1；短弓 +6 1 + DC10 毒(昏睡)；隱形、洞察善惡 |

> 註：pact 數值以官方 stat block 為準，實作時逐項核對。

## 5. 主權 (Sovereignty) 閘門
魔寵屬 `mechanical`（version_m，DM 權威）。匯入權限：
```
canImportFamiliar(preset, ctx):
  // ctx 由當前角色是否綁定 DM 房間/世界決定
  if ctx.mode === 'local'  → 允許全部 tier（本地自由）
  if ctx.mode === 'dm':
     tier==='srd'  → 允許（限建檔/創角階段；開團後鎖定）
     tier==='pact' → 需 world.rules.allowPactFamiliar === true（DM 端開關，預設 false）
```
- **開團後鎖定**：綁定 DM 世界並開團後，機制面 (ac/hp/abilities/attacks) 不可由玩家端直接改，僅走 DM `mergeChar` / `version_m` 更新。匯入按鈕在此狀態應 disable 並提示「需 DM 調整」。
- ⚠️ 實作前先確認 v2 目前「local vs dm 綁定」的真實狀態欄位（room/worldId/version_m 綁定），把 `ctx.mode` 接到既有狀態，勿新造平行狀態。
- `world.rules.allowPactFamiliar` 若尚無，於 world 規則物件新增（預設 false），並在 DM 端（敘事者之書/worldbuilder）預留開關（可 Phase 2 補 UI，先落資料欄位）。

## 6. UI
- 魔寵區加按鈕「從範本中匯入」。
- 點擊 → 彈出/展開選單，依 tier 分組（尋找魔寵 / 鎖鏈契約），每項顯示種類 + 關鍵數據預覽。
- 選定 → 確認 dialog（若魔寵已有資料，警告將覆蓋機制面，保留玩家自取的 name/notes 敘事面）。
- 依 §5 閘門 disable/隱藏不可用項目並附原因提示。

## 7. 交付物 & 驗收
- [ ] `shared/familiar-presets.js`（含 tier + 完整數據，node 可引用）
- [ ] v2 魔寵區「從範本中匯入」按鈕 + 分組選單 UI（沿用現有 patch_*.js 工作流打進 v2/index.html）
- [ ] `canImportFamiliar()` 主權閘門 + 開團後鎖定行為
- [ ] SW 快取 ASSETS +1、CACHE 版本 bump
- [ ] 回歸：既有 jsdom/migration 測試不破；新增 preset 匯入 + 閘門的最小測試
- [ ] 敘事面 (name/notes) 於匯入後保留、機制面正確帶入且可覆寫
