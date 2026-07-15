const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');

// 1. Inject scripts
const scriptsToInject = `
<!-- Firebase compat SDK -->
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js"></script>
<script src="shared/firebase-config.js"></script>
<script src="shared/room.js"></script>
`;
if(!html.includes('firebase-app-compat.js')) {
    html = html.replace('<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>', scriptsToInject + '<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>');
}

// 2. Vue logic
const vueLogic = `
    // ---- Player Room State ----
    const fbApp = ref(null);
    const joinCode = ref("");
    const roomState = reactive({ status: 'idle', id: '', error: '', uid: '', messages: [] });
    let unsubs = [];

    const initFirebase = () => {
      if(!window.DND5E_FIREBASE || !window.DND5E_ROOM) return;
      if(fbApp.value) return;
      try {
        const cfg = window.DND5E_FIREBASE.firebaseConfig;
        const fb = window.DND5E_ROOM.init(cfg);
        fbApp.value = fb;
        window.DND5E_ROOM.signInAnon(fb.auth).then(uid => { roomState.uid = uid; checkAutoJoin(); })
          .catch(e => { roomState.error = "Firebase登入失敗: " + e.message; });
      } catch(e) { roomState.error = "Firebase初始化失敗: " + e.message; }
    };

    const pushMsg = (m) => {
      roomState.messages.unshift(m);
      if(roomState.messages.length > 50) roomState.messages.pop();
    };

    const joinRoom = async (code) => {
      const rid = window.DND5E_ROOM.normRoomId(code || joinCode.value);
      if(!rid || !fbApp.value || !roomState.uid) return;
      roomState.status = 'joining'; roomState.error = '';
      try {
        const meta = await window.DND5E_ROOM.roomMeta(fbApp.value.db, rid);
        if(!meta) throw new Error("找不到該房間");
        
        // sync snapshot
        const ch = activeChar();
        const snap = { name: ch.name || "未命名", level: ch.classes.reduce((sum, cl)=>sum+(cl.level||1),0) || 1, hp: ch.hp, ac: ch.ac };
        await window.DND5E_ROOM.joinRoom(fbApp.value.db, rid, roomState.uid, snap);
        
        roomState.id = rid;
        roomState.status = 'joined';
        
        unsubs.forEach(u=>u()); unsubs = [];
        unsubs.push(window.DND5E_ROOM.onBroadcast(fbApp.value.db, rid, (m) => pushMsg(m)));
        unsubs.push(window.DND5E_ROOM.onInbox(fbApp.value.db, rid, roomState.uid, (m) => pushMsg({ ...m, isPrivate: true })));
        
        // bind worldId to current character instance if empty
        if(ch.worldId === "" && meta.worldId) {
          ch.worldId = meta.worldId;
          saveData();
        }
      } catch(e) {
        roomState.status = 'idle';
        roomState.error = "加入失敗: " + e.message;
      }
    };

    const checkAutoJoin = () => {
      const m = /[?&]room=([^&]+)/.exec(location.search);
      if(m) { joinCode.value = m[1]; joinRoom(m[1]); }
    };

    onMounted(() => { initFirebase(); });
`;
if(!html.includes('const roomState = reactive')) {
    html = html.replace('// ---- auto save / init ----', vueLogic + '\n    // ---- auto save / init ----');
}
if(!html.includes('joinRoom,')) {
    html = html.replace('return {', 'return {\n      joinCode, roomState, joinRoom,');
}

// 3. Template UI: Top bar connection status
const uiHtml = `
      <!-- 連線橫幅 (玩家端) -->
      <div v-if="tab==='main' && roomState.uid" class="px-4 mt-2">
        <div v-if="roomState.status !== 'joined'" class="stat-box p-3 flex gap-2 items-center">
          <input v-model="joinCode" @keyup.enter="joinRoom()" placeholder="輸入房號 (5碼)" class="input flex-1 m-0 uppercase" maxlength="5">
          <button @click="joinRoom()" :disabled="roomState.status==='joining'" class="btn-primary shrink-0">{{ roomState.status==='joining'?'連線中...':'連線跑團' }}</button>
        </div>
        <div v-else class="stat-box p-3 border border-[var(--accent)]">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-bold text-[var(--accent)]">🎲 已連線房間：{{ roomState.id }}</span>
            <span class="text-xs opacity-60">即時同步中</span>
          </div>
          <div class="h-32 overflow-y-auto bg-[var(--bg)] p-2 rounded text-xs space-y-2 border border-[var(--line)]">
            <div v-if="roomState.messages.length===0" class="opacity-50 italic text-center mt-10">等待 DM 訊息...</div>
            <div v-for="m in roomState.messages" :key="m._key" class="bg-[var(--card)] p-2 rounded border border-[var(--line)]">
              <span v-if="m.isPrivate" class="text-yellow-400 font-bold mr-1">[私訊]</span>
              <span>{{ m.text }}</span>
              <div class="text-[10px] opacity-50 mt-1 text-right">{{ new Date(m.ts).toLocaleTimeString() }}</div>
            </div>
          </div>
        </div>
        <div v-if="roomState.error" class="text-red-400 text-xs mt-1">{{ roomState.error }}</div>
      </div>
`;
if(!html.includes('<!-- 連線橫幅 (玩家端) -->')) {
    html = html.replace('<!-- 主分頁 -->', '<!-- 主分頁 -->\n' + uiHtml);
}

fs.writeFileSync('index.html', html);
console.log('Injected Player Room UI into Character Card');
