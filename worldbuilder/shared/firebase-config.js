/* shared/firebase-config.js
 * Firebase 前端公開設定（Step B：Room 即時連線用）。
 * 註：這些皆為「前端公開」值，本就會出現在網頁原始碼中；真正的安全靠
 *     Realtime Database 安全規則（見 FIREBASE-SETUP.md 第 5 步）。
 * 專案：dnd5e-dungeon｜Realtime DB 位置：asia-southeast1（新加坡）｜方案：Spark 免費
 * 掛在單一全域 window.DND5E_FIREBASE，避免污染命名空間。
 */
(function(global){
  const firebaseConfig = {
    apiKey: "AIzaSyBDGNSlgQAsNehDhYS2Alkt34hq7a1uJGs",
    authDomain: "dnd5e-dungeon.firebaseapp.com",
    databaseURL: "https://dnd5e-dungeon-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dnd5e-dungeon",
    storageBucket: "dnd5e-dungeon.firebasestorage.app",
    messagingSenderId: "979065582556",
    appId: "1:979065582556:web:6d4576c356a0b330265519",
    measurementId: "G-5HRH4CH1N7"
  };
  global.DND5E_FIREBASE = { firebaseConfig };
})(typeof window !== "undefined" ? window : this);
