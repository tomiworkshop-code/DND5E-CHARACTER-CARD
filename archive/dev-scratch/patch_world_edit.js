const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// 1. Vue setup additions
const setupMatch = html.match(/const isEditMode = ref\(false\);/);
if (setupMatch) {
  html = html.replace('const isEditMode = ref(false);', `const isEditMode = ref(false);\n        const isWorldEditMode = ref(false);\n        const worldEditTemp = Vue.reactive({ name: '', location: '', time: '', quest: '' });\n        const newWorldNote = ref('');\n        const startWorldEdit = () => {\n          worldEditTemp.name = selectedWorldObj.value.name || '';\n          worldEditTemp.location = selectedWorldObj.value.location || '';\n          worldEditTemp.time = selectedWorldObj.value.time || '';\n          worldEditTemp.quest = selectedWorldObj.value.quest || '';\n          isWorldEditMode.value = true;\n        };\n        const saveWorldEdit = () => {\n          selectedWorldObj.value.name = worldEditTemp.name;\n          selectedWorldObj.value.location = worldEditTemp.location;\n          selectedWorldObj.value.time = worldEditTemp.time;\n          selectedWorldObj.value.quest = worldEditTemp.quest;\n          isWorldEditMode.value = false;\n        };\n        const addWorldNote = () => {\n          if(!newWorldNote.value.trim()) return;\n          if(!selectedWorldObj.value.notes) selectedWorldObj.value.notes = [];\n          selectedWorldObj.value.notes.unshift({ id: Date.now(), text: newWorldNote.value, time: new Date().toLocaleString() });\n          newWorldNote.value = '';\n        };\n        const removeWorldNote = (id) => {\n          if(selectedWorldObj.value.notes) {\n            selectedWorldObj.value.notes = selectedWorldObj.value.notes.filter(n => n.id !== id);\n          }\n        };`);
}

// 2. Returns additions
html = html.replace(/isEditMode,\s*availableSpells,/, 'isEditMode, isWorldEditMode, worldEditTemp, newWorldNote, startWorldEdit, saveWorldEdit, addWorldNote, removeWorldNote, availableSpells,');

// 3. Header replacement
const headerRegex = /<h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">([\s\S]*?)<\/h2>/;
const newHeader = `<h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                <template v-if="!isWorldEditMode">
                  <span>{{ selectedWorldObj.name }}</span>
                </template>
                <template v-else>
                  <input v-model="worldEditTemp.name" class="border border-gray-300 px-2 py-1 rounded text-lg w-full max-w-xs font-normal" placeholder="世界名稱" />
                </template>
                <span v-if="selectedWorldObj.type === 'local' || selectedWorldKey === '__solo__'" class="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700 font-normal">本地單人</span>
                <span v-else class="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1 font-normal">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.078 2.027-.231 3.021M15.328 14.304c.52.87 1.01 1.776 1.467 2.715m-4.577-4.577l.035.012M12 21a9.003 9.003 0 008.354-5.646"></path></svg>
                  DM 連線
                </span>
              </h2>
              <div v-if="selectedWorldObj.type === 'local' || selectedWorldKey === '__solo__'">
                <button v-if="!isWorldEditMode" @click="startWorldEdit" class="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition flex items-center gap-1">
                  ✏️ 編輯
                </button>
                <div v-else class="flex items-center gap-2">
                  <button @click="isWorldEditMode = false" class="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition">取消</button>
                  <button @click="saveWorldEdit" class="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition">儲存</button>
                </div>
              </div>`;
html = html.replace(headerRegex, newHeader);

// 4. Fields replacement
const fieldsOriginal = /<div class="bg-gray-50 p-3 rounded-lg border border-gray-100">\s*<div class="text-xs text-gray-400 mb-1 flex items-center gap-1">([\s\S]*?)當前位置<\/div>\s*<div class="font-bold text-gray-800">{{ selectedWorldObj.location }}<\/div>\s*<\/div>\s*<div class="bg-gray-50 p-3 rounded-lg border border-gray-100">\s*<div class="text-xs text-gray-400 mb-1 flex items-center gap-1">([\s\S]*?)遊戲時間<\/div>\s*<div class="font-bold text-gray-800">{{ selectedWorldObj.time }}<\/div>\s*<\/div>\s*<\/div>\s*<div class="space-y-4">\s*<div class="bg-gray-50 p-3 rounded-lg border border-gray-100 h-full">\s*<div class="text-xs text-gray-400 mb-1 flex items-center gap-1">([\s\S]*?)當前主要任務<\/div>\s*<div class="text-gray-700 leading-relaxed">{{ selectedWorldObj.quest }}<\/div>\s*<\/div>/;

const fieldsNew = `<div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div class="text-xs text-gray-400 mb-1 flex items-center gap-1">$1 當前位置</div>
                  <div v-if="!isWorldEditMode" class="font-bold text-gray-800">{{ selectedWorldObj.location || '未設定' }}</div>
                  <input v-else v-model="worldEditTemp.location" class="border border-gray-300 p-1 w-full rounded text-sm bg-white" placeholder="未設定" />
                </div>
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div class="text-xs text-gray-400 mb-1 flex items-center gap-1">$2 遊戲時間</div>
                  <div v-if="!isWorldEditMode" class="font-bold text-gray-800">{{ selectedWorldObj.time || '未設定' }}</div>
                  <input v-else v-model="worldEditTemp.time" class="border border-gray-300 p-1 w-full rounded text-sm bg-white" placeholder="未設定" />
                </div>
              </div>
              <div class="space-y-4">
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-100 h-full flex flex-col">
                  <div class="text-xs text-gray-400 mb-1 flex items-center gap-1 shrink-0">$3 當前主要任務</div>
                  <div v-if="!isWorldEditMode" class="text-gray-700 leading-relaxed flex-1 whitespace-pre-wrap">{{ selectedWorldObj.quest || '自由探索' }}</div>
                  <textarea v-else v-model="worldEditTemp.quest" class="border border-gray-300 p-2 w-full rounded text-sm bg-white flex-1 min-h-[60px]" placeholder="自由探索"></textarea>
                </div>`;
html = html.replace(fieldsOriginal, fieldsNew);

// 5. Notes section replacement
const notesOriginal = /<!-- 未來階段預告 -->[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/template>)/;
const notesNew = `<!-- 輕量級戰役筆記本 -->
            <div class="mt-8 border-t border-gray-100 pt-6">
              <h3 class="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>📝 世界筆記與戰報</span>
              </h3>
              
              <div v-if="selectedWorldObj.type === 'local' || selectedWorldKey === '__solo__'" class="mb-4 flex gap-2">
                <input v-model="newWorldNote" @keyup.enter="addWorldNote" type="text" class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="輸入筆記 (例如: 拿到 500 金幣、打敗哥布林王...)">
                <button @click="addWorldNote" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm whitespace-nowrap">新增</button>
              </div>

              <div v-if="!selectedWorldObj.notes || selectedWorldObj.notes.length === 0" class="text-center p-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                目前還沒有任何筆記，紀錄一下冒險的點滴吧！
              </div>
              
              <div v-else class="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                <div v-for="note in selectedWorldObj.notes" :key="note.id" class="p-3 bg-white border border-gray-100 rounded-lg shadow-sm flex gap-3 group relative">
                  <div class="text-lg">📜</div>
                  <div class="flex-1">
                    <div class="text-xs text-gray-400 mb-1">{{ note.time }}</div>
                    <div class="text-gray-700 text-sm whitespace-pre-wrap">{{ note.text }}</div>
                  </div>
                  <button v-if="selectedWorldObj.type === 'local' || selectedWorldKey === '__solo__'" @click="removeWorldNote(note.id)" class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition p-1">
                    ✕
                  </button>
                </div>
              </div>
            </div>
`;
html = html.replace(notesOriginal, notesNew);

fs.writeFileSync('v2/index.html', html);
console.log('Patched');
