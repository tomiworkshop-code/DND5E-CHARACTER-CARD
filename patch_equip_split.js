const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// 1. In setup(), add the toggle logic and computed arrays
const setupReturnFind = `filteredAvailableItems,`;
const setupReturnReplace = `filteredAvailableItems,
          equippedItems: Vue.computed(() => (selectedChar.value?.inventory || []).filter(i => i.equipped)),
          backpackItems: Vue.computed(() => (selectedChar.value?.inventory || []).filter(i => !i.equipped)),
          toggleEquip: (item) => {
            item.equipped = !item.equipped;
            if (hasStatEffect(item.name, item.desc)) {
              if (item.equipped) {
                alert('【裝備調整建議】\\n\\n「' + item.name + '」可能包含 AC 或能力值加成。\\n請記得前往【能力值】模塊手動設定您的加值喔！');
              } else {
                alert('【卸下裝備提醒】\\n\\n您卸下了「' + item.name + '」。\\n如果它之前有提供 AC 或能力值加成，請記得前往【能力值】模塊將其扣除！');
              }
            }
          },`;
html = html.replace(setupReturnFind, setupReturnReplace);

// 2. Change module name from 物品與背包 to 裝備與背包
html = html.replace(/物品與背包/g, '裝備與背包');

// 3. Update View Mode
const viewFind = `<div class="flex justify-between items-end mb-2">
                        <div class="text-xs font-bold text-gray-500">穿戴裝備與背包物品</div>
                        <div class="text-[10px] text-gray-400">目前將所有物品統一管理</div>
                      </div>
                      <div v-if="selectedChar.inventory && selectedChar.inventory.length > 0" class="space-y-2">
                        <div v-for="(item, idx) in selectedChar.inventory" :key="idx" class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-1">
                          <div class="flex justify-between items-center w-full">
                            <span class="font-bold text-sm text-gray-800">{{ item.name || item }}</span>
                            <span class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">x{{ item.qty || 1 }}</span>
                          </div>
                          <div v-if="item.desc" class="mt-1">
                            <div class="text-xs text-gray-500 whitespace-pre-wrap" :class="!descOpen['inv-'+idx] && needsExpand(item.desc) ? 'line-clamp-3' : ''">{{ item.desc }}</div>
                            <button v-if="needsExpand(item.desc)" @click="toggleDesc('inv-'+idx)" class="text-xs text-blue-500 hover:text-blue-700 mt-0.5">
                              {{ descOpen['inv-'+idx] ? '▲ 收起' : '... 更多' }}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div v-else class="text-xs text-gray-400 p-4 border border-dashed rounded-lg text-center">背包空空如也</div>`;

const viewReplace = `<!-- Equipped -->
                      <div class="mb-4">
                        <div class="text-xs font-bold text-gray-500 mb-2 border-b pb-1">⚔️ 穿戴裝備 (Equipped)</div>
                        <div v-if="equippedItems.length > 0" class="space-y-2">
                          <div v-for="(item, idx) in equippedItems" :key="'eq-'+idx" class="px-3 py-2 bg-blue-50/50 border border-blue-100 rounded-lg flex flex-col gap-1">
                            <div class="flex justify-between items-center w-full">
                              <span class="font-bold text-sm text-blue-900 flex items-center gap-1">
                                {{ item.name || item }}
                                <span v-if="hasStatEffect(item.name||item, item.desc)" class="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5 rounded shrink-0 leading-none">⚠️ 影響數值</span>
                              </span>
                              <span class="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">x{{ item.qty || 1 }}</span>
                            </div>
                            <div v-if="item.desc" class="mt-1">
                              <div class="text-xs text-gray-600 whitespace-pre-wrap" :class="!descOpen['inv-eq-'+idx] && needsExpand(item.desc) ? 'line-clamp-3' : ''">{{ item.desc }}</div>
                              <button v-if="needsExpand(item.desc)" @click="toggleDesc('inv-eq-'+idx)" class="text-xs text-blue-500 hover:text-blue-700 mt-0.5">
                                {{ descOpen['inv-eq-'+idx] ? '▲ 收起' : '... 更多' }}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div v-else class="text-xs text-gray-400 py-2 italic">目前沒有穿戴裝備</div>
                      </div>
                      
                      <!-- Backpack -->
                      <div>
                        <div class="text-xs font-bold text-gray-500 mb-2 border-b pb-1">🎒 背包物品 (Backpack)</div>
                        <div v-if="backpackItems.length > 0" class="space-y-2">
                          <div v-for="(item, idx) in backpackItems" :key="'bp-'+idx" class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-1 opacity-90">
                            <div class="flex justify-between items-center w-full">
                              <span class="font-bold text-sm text-gray-800">{{ item.name || item }}</span>
                              <span class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">x{{ item.qty || 1 }}</span>
                            </div>
                            <div v-if="item.desc" class="mt-1">
                              <div class="text-xs text-gray-500 whitespace-pre-wrap" :class="!descOpen['inv-bp-'+idx] && needsExpand(item.desc) ? 'line-clamp-3' : ''">{{ item.desc }}</div>
                              <button v-if="needsExpand(item.desc)" @click="toggleDesc('inv-bp-'+idx)" class="text-xs text-blue-500 hover:text-blue-700 mt-0.5">
                                {{ descOpen['inv-bp-'+idx] ? '▲ 收起' : '... 更多' }}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div v-else class="text-xs text-gray-400 py-2 italic">背包空空如也</div>
                      </div>`;
html = html.replace(viewFind, viewReplace);

// 4. Update Edit Mode
const editFind = `<label class="block text-xs font-bold text-gray-500 mb-2">已有物品列表</label>
                      <div class="space-y-2 mb-4">
                        <div v-for="(item, idx) in selectedChar.inventory" :key="idx" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm flex justify-between items-start shadow-sm gap-2">
                          <div class="flex-1 min-w-0">
                            <div class="font-bold text-gray-800 flex items-center gap-1 min-w-0">
                              <span class="truncate">{{ item.name || item }}</span>
                              <span v-if="hasStatEffect(item.name||item, item.desc)" class="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5 rounded shrink-0 leading-none">⚠️ 數值</span>
                            </div>
                            <div v-if="item.desc" class="text-xs text-gray-400 mt-1 line-clamp-2" :title="item.desc">{{ item.desc }}</div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <input type="number" v-model.number="item.qty" class="w-16 border border-gray-300 rounded p-1 text-center text-sm outline-none" min="1" placeholder="數量">
                            <button @click="removeItem(idx)" class="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded bg-red-50 shrink-0">移除</button>
                          </div>
                        </div>
                        <div v-if="!selectedChar.inventory || selectedChar.inventory.length === 0" class="text-xs text-gray-400 text-center py-2">目前沒有物品</div>
                      </div>`;

const editReplace = `<label class="block text-xs font-bold text-gray-500 mb-2">物品清單管理 (點擊可切換裝備狀態)</label>
                      <div class="space-y-2 mb-4">
                        <div v-for="(item, idx) in selectedChar.inventory" :key="idx" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm flex justify-between items-start shadow-sm gap-2" :class="item.equipped ? 'border-blue-300 bg-blue-50/30' : ''">
                          <div class="shrink-0 pt-0.5">
                            <button @click="toggleEquip(item)" class="text-xl" :title="item.equipped ? '卸下' : '裝備'">
                              {{ item.equipped ? '🛡️' : '🎒' }}
                            </button>
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="font-bold text-gray-800 flex items-center gap-1 min-w-0">
                              <span class="truncate" :class="item.equipped ? 'text-blue-900' : ''">{{ item.name || item }}</span>
                              <span v-if="hasStatEffect(item.name||item, item.desc)" class="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5 rounded shrink-0 leading-none">⚠️ 數值</span>
                            </div>
                            <div v-if="item.desc" class="text-xs text-gray-400 mt-1 line-clamp-2" :title="item.desc">{{ item.desc }}</div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <input type="number" v-model.number="item.qty" class="w-16 border border-gray-300 rounded p-1 text-center text-sm outline-none bg-white" min="1" placeholder="數量">
                            <button @click="removeItem(idx)" class="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded bg-red-50 shrink-0">移除</button>
                          </div>
                        </div>
                        <div v-if="!selectedChar.inventory || selectedChar.inventory.length === 0" class="text-xs text-gray-400 text-center py-2">目前沒有物品</div>
                      </div>`;
html = html.replace(editFind, editReplace);

fs.writeFileSync('v2/index.html', html);
