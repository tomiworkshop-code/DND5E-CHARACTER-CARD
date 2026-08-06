const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const oldStr = `<div v-if="activeModule === 'story'" class="space-y-4">
              <div class="bg-purple-50 text-purple-700 text-xs p-2 rounded-md mb-2 flex items-center gap-2 border border-purple-100">
                <span class="text-base">🌐</span> 此為全域跨世界設定，修改會自動套用到所有世界。
              </div>
              <div class="flex gap-4 items-start">
                <div class="flex-1 space-y-3">
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">頭像 URL</label>
                    <input v-model="selectedChar.avatar" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none" placeholder="輸入圖片網址...">
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">名稱</label>
                    <input v-model="selectedChar.name" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none">
                  </div>
                </div>
                <div class="w-20 h-20 shrink-0 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                  <img v-if="selectedChar.avatar" :src="selectedChar.avatar" class="w-full h-full object-cover">
                  <span v-else class="text-3xl">🧙</span>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-bold text-gray-500 mb-1">種族</label>
                  <select v-model="selectedChar.race" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none bg-white">
                    <option v-for="r in RACES" :key="r.name" :value="r.name">{{ r.name }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-gray-500 mb-1">陣營</label>
                  <select v-model="selectedChar.alignment" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none bg-white">
                    <option v-for="a in ALIGNMENTS" :key="a" :value="a">{{ a }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-gray-500 mb-1">背景</label>
                  <select v-model="selectedChar.background" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none bg-white">
                    <option v-for="b in BACKGROUNDS" :key="b.name" :value="b.name">{{ b.name }}</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-500 mb-1">背景故事</label>
                <textarea v-model="selectedChar.notes" rows="4" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none resize-none placeholder-gray-300" placeholder="寫下角色的起源與羈絆..."></textarea>
              </div>
            </div>`;

const newStr = `<div v-if="activeModule === 'story'" class="space-y-4">
              <div class="bg-purple-50 text-purple-700 text-xs p-2 rounded-md mb-2 flex items-center gap-2 border border-purple-100">
                <span class="text-base">🌐</span> 此為全域跨世界設定，修改會自動套用到所有世界。
              </div>
              
              <div v-if="!isEditMode" class="space-y-4">
                <div class="flex gap-4 items-start">
                  <div class="flex-1 space-y-3">
                    <div><span class="text-xs text-gray-500 block">名稱</span><div class="font-bold text-lg">{{ selectedChar.name || '未命名' }}</div></div>
                  </div>
                  <div class="w-20 h-20 shrink-0 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                    <img v-if="selectedChar.avatar" :src="selectedChar.avatar" class="w-full h-full object-cover">
                    <span v-else class="text-3xl">🧙</span>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-3">
                  <div><span class="text-xs text-gray-500 block">種族</span><div class="font-medium">{{ selectedChar.race || '未設定' }}</div></div>
                  <div><span class="text-xs text-gray-500 block">陣營</span><div class="font-medium">{{ selectedChar.alignment || '未設定' }}</div></div>
                  <div><span class="text-xs text-gray-500 block">背景</span><div class="font-medium">{{ selectedChar.background || '未設定' }}</div></div>
                </div>
                <div><span class="text-xs text-gray-500 block">背景故事</span><div class="text-sm whitespace-pre-wrap">{{ selectedChar.notes || '無' }}</div></div>
              </div>

              <div v-else class="space-y-4">
                <div class="flex gap-4 items-start">
                  <div class="flex-1 space-y-3">
                    <div>
                      <label class="block text-xs font-bold text-gray-500 mb-1">頭像 URL</label>
                      <input v-model="selectedChar.avatar" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none" placeholder="輸入圖片網址...">
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-gray-500 mb-1">名稱</label>
                      <input v-model="selectedChar.name" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none">
                    </div>
                  </div>
                  <div class="w-20 h-20 shrink-0 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                    <img v-if="selectedChar.avatar" :src="selectedChar.avatar" class="w-full h-full object-cover">
                    <span v-else class="text-3xl">🧙</span>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">種族</label>
                    <select v-model="selectedChar.race" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none bg-white">
                      <option v-for="r in RACES" :key="r.name" :value="r.name">{{ r.name }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">陣營</label>
                    <select v-model="selectedChar.alignment" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none bg-white">
                      <option v-for="a in ALIGNMENTS" :key="a" :value="a">{{ a }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">背景</label>
                    <select v-model="selectedChar.background" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none bg-white">
                      <option v-for="b in BACKGROUNDS" :key="b.name" :value="b.name">{{ b.name }}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="block text-xs font-bold text-gray-500 mb-1">背景故事</label>
                  <textarea v-model="selectedChar.notes" rows="4" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none resize-none placeholder-gray-300" placeholder="寫下角色的起源與羈絆..."></textarea>
                </div>
              </div>
            </div>`;

html = html.replace(oldStr, newStr);
fs.writeFileSync('v2/index.html', html);
