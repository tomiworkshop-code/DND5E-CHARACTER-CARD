# Firebase 建立傻瓜指引（Step B 前置）

> 目標：建立一個 Firebase 專案 + **Realtime Database**，讓「地下城指南 (DM 版)」能開房、玩家掃 QR 加入、DM 即時推訊息給玩家。
> 對齊設計文件 §3（傳輸層：Firebase Realtime DB）與 §3.1（Room 資料契約）。
> 全程在瀏覽器點一點，**不用寫任何程式**。做完把「第 6 步的設定」貼給卡娜拉即可。

---

## 為什麼是 Firebase Realtime Database（不是 Firestore）？
設計 §3 已拍板用 **Realtime Database**（不是 Firestore）：訂閱即時同步開箱即用、免費額度足夠、免自架。建立時**兩個都會看到，請務必選 Realtime Database**。

---

## 步驟

### 1. 建立 Firebase 專案
1. 開 https://console.firebase.google.com/ （用你的 Google 帳號登入）
2. 點 **「新增專案 / Add project」**
3. 專案名稱打：`dnd5e-dungeon`（隨意，好認就好）
4. Google Analytics：**可以關掉**（Disable，MVP 用不到）
5. 按 **建立**，等它跑完 → **繼續 / Continue**

### 2. 開啟 Realtime Database
1. 左側選單 → **建構 / Build** → **Realtime Database**
2. 點 **建立資料庫 / Create Database**
3. 位置 (location)：選 **`asia-southeast1` (新加坡)**（離香港最近、延遲低）
4. 安全性規則：先選 **「以鎖定模式啟動 / Start in locked mode」**（之後第 5 步我們會換成正式規則）
5. 按 **啟用 / Enable**

### 3. 開啟匿名登入 (Anonymous Auth)
> 玩家不用註冊帳號，用匿名身分即可加入房間（`playerId` = 匿名 auth uid）。
1. 左側 → **建構 / Build** → **Authentication**
2. 點 **開始使用 / Get started**
3. 分頁 **Sign-in method** → 找 **匿名 / Anonymous** → 點開 → **啟用 (Enable)** → **儲存**

### 4. 新增一個「網頁 App」拿設定
1. 左側齒輪 ⚙️ → **專案設定 / Project settings**
2. 捲到最下面「你的應用程式 / Your apps」→ 點 **`</>`（Web）** 圖示
3. App 暱稱打：`dnd-web` → **註冊應用程式 / Register app**（**不用**勾 Firebase Hosting）
4. 它會顯示一段 `firebaseConfig = { apiKey: ..., databaseURL: ... }` → **這段就是第 6 步要給我的東西**（先別關視窗，或之後可在同頁再看到）

### 5. 貼上安全性規則（權限隔離）
> 對齊 §3.1：玩家只能寫自己的格、DM 能寫房間；玩家看不到別人的私訊。
1. 回到 **Realtime Database** → 分頁 **規則 / Rules**
2. 把整段內容**換成**下面這段 → 按 **發布 / Publish**

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": "auth != null",
        "meta":      { ".write": "auth != null && (!data.exists() || data.child('dmId').val() === auth.uid)" },
        "state":     { ".write": "auth != null && root.child('rooms').child($roomId).child('meta/dmId').val() === auth.uid" },
        "broadcast": { ".write": "auth != null && root.child('rooms').child($roomId).child('meta/dmId').val() === auth.uid" },
        "fx":        { ".write": "auth != null && root.child('rooms').child($roomId).child('meta/dmId').val() === auth.uid" },
        "inbox": {
          "$pid": {
            ".read":  "auth != null && (auth.uid === $pid || root.child('rooms').child($roomId).child('meta/dmId').val() === auth.uid)",
            ".write": "auth != null && root.child('rooms').child($roomId).child('meta/dmId').val() === auth.uid"
          }
        },
        "commands": {
          "$pid": {
            ".read":  "auth != null && (auth.uid === $pid || root.child('rooms').child($roomId).child('meta/dmId').val() === auth.uid)",
            ".write": "auth != null && root.child('rooms').child($roomId).child('meta/dmId').val() === auth.uid"
          }
        },
        "saves": {
          "$cid": {
            ".write": "auth != null && root.child('rooms').child($roomId).child('meta/dmId').val() === auth.uid"
          }
        },
        "requests": {
          "$pid": {
            ".write": "auth != null && (auth.uid === $pid || root.child('rooms').child($roomId).child('meta/dmId').val() === auth.uid)"
          }
        },
        "players": {
          "$pid": {
            ".write": "auth != null && auth.uid === $pid"
          }
        }
      }
    }
  }
}
```

> 說明：`meta/dmId` 記錄開房 DM 的 uid；只有 DM 能寫房間狀態/廣播/私訊/指令/特效/中央存檔(saves)，玩家只能寫自己的 `players/{自己uid}` 快照與 `requests/{自己uid}` 請求。這是 §3.1 權限隔離的最小安全版，之後可再收緊。
> **【已補齊 2026-07-18】** 新增 `saves/{characterId}`（DM 權威中央存檔，僅 DM 寫）與 `requests/{playerId}`（玩家 push 自己請求、DM 讀/刪）兩節 write 規則（先前版本漏掉 → 會擋住存檔同步與請求通道）。

---

## 6. 把這個貼給卡娜拉 ✅
做完後，回到 **專案設定 → 你的應用程式 → SDK 設定與配置**，複製那段 `firebaseConfig`，**整段貼給我**（長這樣）：

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "dnd5e-dungeon.firebaseapp.com",
  databaseURL: "https://dnd5e-dungeon-xxxx.asia-southeast1.firebasedatabase.app",
  projectId: "dnd5e-dungeon",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

> ⚠️ 這些是「前端公開設定」，本來就會出現在網頁原始碼裡，貼給我沒有安全疑慮——真正的安全靠上面第 5 步的規則。**唯一要確認的是 `databaseURL` 有出現**（代表 Realtime DB 已建好）。

---

## 附錄：房間資料長相（§3.1，給你參考，不用手動建）
```
rooms/{roomId}/
  meta                 : {dmId, worldId, createdAt, status}     ← 開房時 DM 寫
  state                : {sceneTitle, ...}                       ← DM 寫、全體讀
  broadcast/[]         : {from, text, ts}                        ← DM 寫、全體讀（訊息記錄）
  inbox/{playerId}/[]  : {from, text, ts}                        ← DM 寫、該玩家+DM 讀（私訊）
  commands/{playerId}/[]: {type, ...payload, ts}                 ← DM 寫、該玩家讀（指令，套用後可清）
  fx/[]                : {type, target, ...payload, ts}          ← DM 寫、依 target 讀（特效，播完即棄）
  players/{playerId}   : {角色 Tier1 關鍵數值快照}                ← 玩家本人寫、全體+DM 讀（即時）
```
- **playerId** = 連線身分（匿名 auth uid，房間內用）
- **characterId** = 角色全域身份；**instanceId = characterId@worldId** = 該角色在某世界的存檔槽（已由 shared/character-schema.js 提供 helper）
- DM 隱藏資訊（NPC 真實身份、伏筆…）**永不寫入 room**。

## 費用
免費方案 (Spark) 對 MVP 綽綽有餘：Realtime DB 免費含 1GB 儲存 + 10GB/月下載。跑幾場團完全用不到。**不需要綁信用卡**。
