const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const target = `<div v-for="it in filteredAvailableItems" :key="it?.id || it?.name_zh" class="flex justify-between items-center p-2 border-b last:border-b-0 hover:bg-gray-50">
                          <div>
                            <div class="font-bold text-sm text-gray-800 flex items-center gap-1">
                              <span>{{ it?.name_zh || it?.name_en || it?.name }}</span>
                              <span v-if="hasStatEffect(it?.name_zh || it?.name_en || it?.name, '', it)" class="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5 rounded shrink-0 leading-none">⚠️ 影響數值</span>
                            </div>
                            <div v-if="it.type" class="text-xs text-gray-500">{{ it.type }}</div>
                          </div>
                          <button @click="addItem(it)" class="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-medium">+ 加入</button>
                        </div>`;

const replacement = `<div v-for="it in filteredAvailableItems" :key="it?.id || it?.name_zh" class="flex justify-between items-center p-2 border-b last:border-b-0 hover:bg-gray-50 gap-2">
                          <div class="flex-1 min-w-0">
                            <div class="font-bold text-sm text-gray-800 flex items-center gap-1">
                              <span class="truncate">{{ it?.name_zh || it?.name_en || it?.name }}</span>
                              <span v-if="hasStatEffect(it?.name_zh || it?.name_en || it?.name, '', it)" class="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5 rounded shrink-0 leading-none">⚠️ 影響數值</span>
                            </div>
                            <div class="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <span v-if="it.category || it.type" class="shrink-0 bg-gray-100 px-1 rounded">{{ it.category || it.type }}</span>
                              <span class="truncate">{{ Array.isArray(it.entries_zh) ? it.entries_zh.join(' ') : (Array.isArray(it.entries) ? it.entries.join(' ') : (it.desc || '')) }}</span>
                            </div>
                          </div>
                          <button @click="addItem(it)" class="shrink-0 text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-medium">+ 加入</button>
                        </div>`;

html = html.replace(target, replacement);
fs.writeFileSync('v2/index.html', html);
