# Firebase Google 登入 + 個人雲備份 建立傻瓜指引（TC-A1 前置）

> 目標：在既有 `dnd5e-dungeon` 專案上，**加開 Google 登入**、**加授權網域**、**補上 `users/{uid}` 雲備份規則**。
> 這樣玩家就能用 Google 帳號登入，把角色資料備份到雲端、換手機也救得回。
> 對齊規劃文件 `memory/projects/dnd-google-auth-cloud-backup-plan.md` §2/§5/§8（TC-A1）。
> ⚠️ 全程在瀏覽器點一點，**不用寫任何程式**。做完把「第 4 步確認清單」回報給卡娜拉即可。

---

## 前提
- 你已經有 Firebase 專案 `dnd5e-dungeon`（跑團聯機那個），且 Realtime Database + 匿名登入都已啟用。
- 本指引**只加東西、不改動** rooms 那套跑團規則。

---

## 步驟 1. 開啟「Google 登入」(Google Sign-in provider)
> 現在只開了「匿名」，要再多開「Google」。
1. 開 https://console.firebase.google.com/ → 選專案 **`dnd5e-dungeon`**
2. 左側 → **建構 / Build** → **Authentication**
3. 分頁 **Sign-in method**（登入方式）
4. 找 **Google** → 點開 → 右上角 **啟用 (Enable)**
5. 會要你填：
   - **專案的公開名稱 (Public-facing name)**：打 `冒險者之書`（玩家登入畫面會看到）
   - **專案支援電子郵件 (Support email)**：選你自己的 Google email（下拉選單）
6. 按 **儲存 / Save** ✅

---

## 步驟 2. 加「授權網域」(Authorized domains) 【最容易漏，漏了登入會直接失敗】
> Google 登入只允許「白名單網域」彈出登入視窗。要把你的網站網域加進去。
1. 一樣在 **Authentication** → 分頁 **Settings（設定）**
2. 找到 **Authorized domains（授權網域）** 區塊
3. 預設通常已有 `localhost` 和 `dnd5e-dungeon.firebaseapp.com`（保留別刪）
4. 點 **Add domain（新增網域）**，把你**正式上線的網域**加進去。例如：
   - Cloudflare Pages 網域（像 `xxxx.pages.dev`，或你綁的自訂網域）
   - ⚠️ 只填「網域」本身，不用加 `https://` 或路徑
5. （開發用）`localhost` 若不在清單，補上，方便本機測試

> 📌 小抄：如果之後登入時看到 `auth/unauthorized-domain` 錯誤，就是這一步漏了或網域打錯。

---

## 步驟 3. 更新 Realtime Database 規則（加 `users/{uid}` 雲備份節點）
> 現有 `rooms` 跑團規則**完全不動**，只在旁邊加一段 `users`：本人只能讀寫自己的雲備份。
1. 左側 → **建構 / Build** → **Realtime Database** → 分頁 **規則 / Rules**
2. 把整段內容**換成**下面這段「rooms + users 合併版」→ 按 **發布 / Publish**

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
    },

    "users": {
      "$uid": {
        ".read":  "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

> 說明：新增的 `users/{uid}` 節點 —— **只有本人（登入後 uid 相符）能讀寫自己的雲備份**，別人碰不到。個人雲備份就存在 `users/{uid}/backup/payload`（規劃文件 §3.1）。

---

## 步驟 4. ✅ 回報卡娜拉這個確認清單
做完後，回覆卡娜拉以下幾點（有做到就打勾）：
- [ ] Google 登入已啟用（Authentication → Sign-in method → Google = Enabled）
- [ ] 已加授權網域（把你正式網站網域貼給我，例如 `xxxx.pages.dev`）
- [ ] Realtime Database 規則已換成「rooms + users 合併版」並 Publish
- [ ] 你的正式部署網址是哪個（我要拿去對授權網域、也給 auth.js 用）

> 拿到這些，卡娜拉就能開 **TC-A2**：抽 `shared/services/auth.js` 登入模組（Google 登入 + 匿名帳號升級綁定 + redirect fallback）。

---

## 常見坑（Troubleshooting）
- **`auth/unauthorized-domain`**：步驟 2 授權網域漏了或打錯（別加 `https://`）。
- **`auth/operation-not-allowed`**：步驟 1 Google provider 沒啟用。
- **手機按登入沒反應**：行動瀏覽器擋 popup → auth.js 會自動 fallback 成 redirect（TC-A2 處理），Console 這邊不用改。
- **規則發布後跑團壞了**：檢查你貼的是「合併版」（rooms 那段有保留），不是只貼了 users 那段。

---
_附註：本指引可日後併入 `FIREBASE-SETUP.md` 成為 §7；目前先獨立成檔，避免動到現有跑團設定文件。_
