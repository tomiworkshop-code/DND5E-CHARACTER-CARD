const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// 1. Replace the old notes HTML section
const htmlRegex = /<!-- 輕量級戰役筆記本 -->[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/template>)/;
const newHtml = `<!-- 輕量級世界紀錄板塊 -->
            <div class="mt-8 border-t border-gray-100 pt-6">
              <h3 class="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>📝 世界紀錄與筆記</span>
              </h3>
              
              <!-- 分類 Tabs -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <button v-for="rtab in recordTabs" :key="rtab.id" @click="activeRecordTab = rtab.id"
                  :class="['border rounded-lg p-3 text-center text-sm transition', activeRecordTab === rtab.id ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100']">
                  <div class="text-xl mb-1">{{ rtab.icon }}</div>
                  {{ rtab.label }}
                </button>
              </div>

              <!-- 輸入區 (僅限本地或單人) -->
              <div v-if="selectedWorldObj.type === 'local' || selectedWorldKey === '__solo__'" class="mb-4 flex gap-2">
                <input v-model="newRecordText" @keyup.enter="addWorldRecord" type="text" class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" :placeholder="'新增 ' + recordTabs.find(t=>t.id===activeRecordTab)?.label + '...'">
                <button @click="addWorldRecord" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm whitespace-nowrap">新增</button>
              </div>

              <!-- 列表區 -->
              <div v-if="!selectedWorldObj.records || !selectedWorldObj.records[activeRecordTab] || selectedWorldObj.records[activeRecordTab].length === 0" class="text-center p-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                此分類目前還沒有任何紀錄。
              </div>
              
              <div v-else class="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                <div v-for="rec in selectedWorldObj.records[activeRecordTab]" :key="rec.id" class="p-3 bg-white border border-gray-100 rounded-lg shadow-sm flex gap-3 group relative">
                  <div class="text-lg">{{ recordTabs.find(t=>t.id===activeRecordTab)?.icon }}</div>
                  <div class="flex-1">
                    <div class="text-xs text-gray-400 mb-1">{{ rec.time }}</div>
                    <div class="text-gray-700 text-sm whitespace-pre-wrap">{{ rec.text }}</div>
                  </div>
                  <button v-if="selectedWorldObj.type === 'local' || selectedWorldKey === '__solo__'" @click="removeWorldRecord(rec.id)" class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition p-1">
                    ✕
                  </button>
                </div>
              </div>
            </div>
`;
html = html.replace(htmlRegex, newHtml);

// 2. Replace the Vue setup logic
const jsRegex = /const newWorldNote = ref\(''\);[\s\S]*?const removeWorldNote = \(id\) => \{[\s\S]*?\};\s*/;
const newJs = `const activeRecordTab = ref('log');
        const newRecordText = ref('');
        const recordTabs = [
          { id: 'log', icon: '📜', label: '戰報與大事紀' },
          { id: 'quest', icon: '📚', label: '任務與遭遇' },
          { id: 'npc', icon: '🤝', label: '陣營與NPC' },
          { id: 'clue', icon: '💎', label: '線索與寶物' }
        ];
        const addWorldRecord = () => {
          if(!newRecordText.value.trim()) return;
          if(!selectedWorldObj.value.records) selectedWorldObj.value.records = { log:[], quest:[], npc:[], clue:[] };
          if(!selectedWorldObj.value.records[activeRecordTab.value]) selectedWorldObj.value.records[activeRecordTab.value] = [];
          selectedWorldObj.value.records[activeRecordTab.value].unshift({ id: Date.now(), text: newRecordText.value, time: new Date().toLocaleString() });
          newRecordText.value = '';
        };
        const removeWorldRecord = (id) => {
          if(selectedWorldObj.value.records && selectedWorldObj.value.records[activeRecordTab.value]) {
            selectedWorldObj.value.records[activeRecordTab.value] = selectedWorldObj.value.records[activeRecordTab.value].filter(n => n.id !== id);
          }
        };
        `;
html = html.replace(jsRegex, newJs);

// 3. Update return statement
html = html.replace(/newWorldNote, startWorldEdit, saveWorldEdit, addWorldNote, removeWorldNote,/, "activeRecordTab, newRecordText, recordTabs, startWorldEdit, saveWorldEdit, addWorldRecord, removeWorldRecord,");

// 4. Update Build number
html = html.replace(/Build 0717\.05/, "Build 0717.06");

fs.writeFileSync('v2/index.html', html);
console.log('Successfully patched records section.');
