# 羊皮卷 · D&D 5E 角色暫存 (PWA)

一個離線可用的 D&D 5E 角色卡 PWA（繁體中文）。單檔前端，無需後端。

## 功能
- 雙模式：設定模式 / 跑團模式
- 多角色管理、魔寵角色卡
- 種族 / 副種族下拉、法術 / 物品搜尋選取式（內建繁中資料庫）
- 來源(擴充)多選篩選 + 含英文內容開關
- 跑團 HP 快捷 +/− 與暫時HP；狀態(Conditions) checkbox + 耗竭
- 法術位摺疊壓縮顯示
- 語言 / 熟練手動編輯
- 列印 / 匯出 PDF（瀏覽器原生）
- Service Worker 離線快取（network-first）

## 使用
直接以靜態網站方式部署（Cloudflare Workers / Pages / 任何靜態主機），開啟 `index.html` 即可。可「加入主螢幕」當 App 用。

## 資料
`data/*.json`（種族 / 法術 / 物品 / 來源），格式見 `data/SCHEMA.md`。

## 授權與聲明
見 `LICENSE-NOTE.md`（非官方愛好者工具；D&D 內容版權屬 Wizards of the Coast，依 SRD/OGL）。

意見回饋：Line `tomilam`
