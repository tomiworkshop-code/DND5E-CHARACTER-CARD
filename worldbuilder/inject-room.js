const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// 1. Inject scripts
const scriptsToInject = `
<!-- Firebase compat SDK -->
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js"></script>
<!-- QR -->
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<script src="../shared/firebase-config.js"></script>
<script src="../shared/room.js"></script>
`;
if(!html.includes('firebase-app-compat.js')) {
    html = html.replace('<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>', scriptsToInject + '<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>');
}

// 2. Add 'room' to tabs
if(!html.includes('{ id:"room",')) {
    html = html.replace('const tabs = [', 'const tabs = [\n      { id:"room",    icon:"🎲", label:"跑團" },');
}

// 3. Inject Vue state & functions for room
const vueLogic = `
    // ---- Room / Session State ----
    const fbApp = ref(null);
    const roomState = reactive({ status: 'idle', id: '', qr: '', error: '', players: {}, dmUid: '' });
    const broadcastInput = ref("");

    const initFirebase = () => {
      if(!window.DND5E_FIREBASE || !window.DND5E_ROOM) return;
      if(fbApp.value) return;
      try {
        const cfg = window.DND5E_FIREBASE.firebaseConfig;
        const fb = window.DND5E_ROOM.init(cfg);
        fbApp.value = fb;
        window.DND5E_ROOM.signInAnon(fb.auth).then(uid => {
          roomState.dmUid = uid;
        }).catch(e => { roomState.error = "Firebase登入失敗: " + e.message; });
      } catch(e) { roomState.error = "Firebase初始化失敗: " + e.message; }
    };

    const openRoom = async () => {
      if(!fbApp.value) initFirebase();
      if(!roomState.dmUid || roomState.status === 'opening') return;
      roomState.status = 'opening'; roomState.error = '';
      try {
        const rid = await window.DND5E_ROOM.createRoom(fbApp.value.db, {
          dmId: roomState.dmUid,
          worldId: activeWorldId.value
        });
        roomState.id = rid;
        roomState.status = 'open';
        // Generate QR
        const url = location.origin + location.pathname.replace('/worldbuilder/', '/') + "?room=" + rid;
        QRCode.toDataURL(url, { width: 200, margin: 1 }, (err, dataUrl) => {
          if(!err) roomState.qr = dataUrl;
        });
        // Listen to players
        window.DND5E_ROOM.onPlayers(fbApp.value.db, rid, (ps) => {
          roomState.players = ps || {};
        });
      } catch(e) {
        roomState.status = 'idle';
        roomState.error = "開房失敗: " + e.message;
      }
    };

    const sendBroadcast = async () => {
      const t = broadcastInput.value.trim();
      if(!t || roomState.status !== 'open') return;
      await window.DND5E_ROOM.sendBroadcast(fbApp.value.db, roomState.id, "dm", t);
      broadcastInput.value = "";
    };

    onMounted(() => { initFirebase(); });
`;

if(!html.includes('const roomState = reactive')) {
    html = html.replace('// ---- encounter builder state ----', vueLogic + '\n    // ---- encounter builder state ----');
}

if(!html.includes('sendBroadcast,')) {
    html = html.replace('return {', 'return {\n      roomState, openRoom, sendBroadcast, broadcastInput,');
}

// 4. Add UI in template
const uiHtml = `
    <!-- 🎲 跑團/房間面板 -->
    <div v-show="tab==='room'" class="space-y-4 pb-20">
      <div class="card p-4">
        <h2 class="text-xl font-bold mb-4 flex items-center gap-2">🎲 跑團控制台</h2>
        <div v-if="roomState.error" class="bg-red-900 text-red-200 p-3 rounded mb-4">{{ roomState.error }}</div>
        
        <div v-if="roomState.status === 'idle' || roomState.status === 'opening'">
          <p class="text-[var(--ink-soft)] mb-4">建立即時連線房間，讓玩家透過「冒險者之書」掃碼加入。進度將綁定當前世界：<b>{{ activeWorld()?.name || '未命名世界' }}</b></p>
          <button @click="openRoom" :disabled="!roomState.dmUid || roomState.status==='opening'" class="btn-primary w-full py-3 text-lg font-bold">
            {{ roomState.status === 'opening' ? '開房中...' : '建立房間 (Create Room)' }}
          </button>
        </div>

        <div v-if="roomState.status === 'open'" class="space-y-6">
          <div class="flex flex-col md:flex-row gap-6 items-center bg-[var(--bg)] p-4 rounded-lg border border-[var(--line)]">
            <div class="flex flex-col items-center gap-2">
              <div class="text-[var(--ink-soft)] text-sm">請玩家掃描或輸入房號加入</div>
              <div class="text-4xl font-black text-[var(--accent)] tracking-widest">{{ roomState.id }}</div>
              <img v-if="roomState.qr" :src="roomState.qr" class="w-48 h-48 rounded bg-white p-2">
            </div>
            
            <div class="flex-1 w-full space-y-4">
              <div class="card p-3">
                <div class="text-sm text-[var(--ink-soft)] mb-2">👥 玩家名單</div>
                <div v-if="Object.keys(roomState.players).length === 0" class="text-sm opacity-50 italic">尚未有玩家加入...</div>
                <div class="flex flex-wrap gap-2">
                  <div v-for="(p, pid) in roomState.players" :key="pid" class="bg-[var(--accent)] text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                    {{ p.name || '未命名' }}
                    <span class="text-xs bg-black/30 px-1.5 rounded">Lv.{{ p.level || 1 }}</span>
                  </div>
                </div>
              </div>

              <div class="card p-3">
                <div class="text-sm text-[var(--ink-soft)] mb-2">📢 廣播推播</div>
                <div class="flex gap-2">
                  <input v-model="broadcastInput" @keyup.enter="sendBroadcast" type="text" class="input flex-1" placeholder="輸入訊息...">
                  <button @click="sendBroadcast" class="btn-primary whitespace-nowrap">發送</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
`;
if(!html.includes('<!-- 🎲 跑團/房間面板 -->')) {
    html = html.replace('<!-- 🌍 世界面板 -->', uiHtml + '\n    <!-- 🌍 世界面板 -->');
}

fs.writeFileSync('index.html', html);
console.log('Injected Room UI into DM Worldbuilder');
