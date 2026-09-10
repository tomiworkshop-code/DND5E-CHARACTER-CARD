# data/2024 — 規則版本專屬資料集（5.5e (2024 修訂版 PHB)）

本目錄放 **2024** 版與 2014 的**差異資料**。載入規則（見 v2/app.js `loadRuleJson`）：

1. 版本世界出團時，先抓 `data/2024/<file>`。
2. 若檔案不存在（404），或檔案 `_meta.inherit === "2014"`，**自動回退** `data/<file>`（2014 canonical）。

→ 因此本目錄現為**骨架**：所有檔標記 `inherit:"2014"`，行為等同 2014，不影響現有跑團。
   要正式導入 2024 差異時：編輯對應檔，**移除 `_meta.inherit`**，填入該版真正的資料（種族→物種、背景給屬性、武器精通、專長改版等）。

檔案：core-rules / classes / races / spells / items / sources / feats（.json）
