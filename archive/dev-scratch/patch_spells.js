const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const oldSpells = `<!-- SPELLS 法術 -->
                <div v-if="activeModule === 'spells'" class="space-y-4">
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">法術位 (Slots)</label>
                    <div class="space-y-2">
                      <div v-for="slot in selectedChar.spellSlots" :key="slot.level" class="flex items-center gap-2 text-sm">
                        <span class="w-8 font-bold text-gray-600">Lv {{ slot.level }}</span>
                        <input type="number" v-model.number="slot.used" class="w-16 border border-gray-300 rounded p-1 text-center" title="已使用">
                        <span class="text-gray-400">/</span>
                        <input type="number" v-model.number="slot.max" class="w-16 border border-gray-300 rounded p-1 text-center" title="最大值">
                      </div>
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">法術列表 (每行一項)</label>
                    <textarea v-model="selectedChar.spellsText" rows="6" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none resize-none" placeholder="例如：\\n魔法飛彈\\n火球術"></textarea>
                  </div>
                </div>`;

const newSpells = `<!-- SPELLS 法術 -->
                <div v-if="activeModule === 'spells'" class="space-y-4">
                  <div v-if="!isEditMode">
                    <!-- View Mode -->
                    <div class="mb-4">
                      <div class="text-xs font-bold text-gray-500 mb-2">法術位 (Slots)</div>
                      <div class="flex flex-wrap gap-3">
                        <div v-for="slot in selectedChar.spellSlots" :key="slot.level" v-show="slot.max > 0" class="px-3 py-1 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                          <span class="font-bold text-blue-800">Lv{{ slot.level }}</span>
                          <span class="ml-2 text-gray-600">{{ slot.used }} / {{ slot.max }}</span>
                        </div>
                        <div v-if="!selectedChar.spellSlots || !selectedChar.spellSlots.some(s => s.max > 0)" class="text-xs text-gray-400">無法術位資料</div>
                      </div>
                    </div>
                    <div>
                      <div class="text-xs font-bold text-gray-500 mb-2">已記憶法術</div>
                      <div v-if="!selectedChar.spellbook || selectedChar.spellbook.length === 0" class="text-xs text-gray-400">法術書空空如也</div>
                      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div v-for="(sp, idx) in selectedChar.spellbook" :key="idx" class="p-2 border border-gray-200 rounded-lg flex justify-between items-center bg-white shadow-sm">
                          <div class="font-medium text-gray-800">{{ sp.name }}</div>
                          <div class="text-xs px-2 py-0.5 bg-gray-100 rounded-full">{{ sp.level == 0 ? '戲法' : 'Lv' + sp.level }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="space-y-6">
                    <!-- Edit Mode -->
                    <div>
                      <label class="block text-xs font-bold text-gray-500 mb-1">法術位 (Slots)</label>
                      <div class="grid grid-cols-3 gap-2">
                        <div v-for="slot in selectedChar.spellSlots" :key="slot.level" class="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded-lg border border-gray-200">
                          <span class="w-8 font-bold text-gray-600">Lv {{ slot.level }}</span>
                          <input type="number" v-model.number="slot.used" class="w-10 border border-gray-300 rounded p-1 text-center" title="已使用">
                          <span class="text-gray-400">/</span>
                          <input type="number" v-model.number="slot.max" class="w-10 border border-gray-300 rounded p-1 text-center" title="最大值">
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label class="block text-xs font-bold text-gray-500 mb-2">法術書管理</label>
                      
                      <!-- 已加入法術列表 -->
                      <div class="mb-4 space-y-2">
                        <div v-for="(sp, idx) in (selectedChar.spellbook || [])" :key="idx" class="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-bold px-2 py-0.5 bg-gray-200 rounded-full">{{ sp.level == 0 ? '戲法' : 'Lv' + sp.level }}</span>
                            <span class="font-medium text-sm">{{ sp.name }}</span>
                            <span v-if="sp.custom" class="text-[10px] text-white bg-blue-400 px-1 rounded">自訂</span>
                          </div>
                          <button @click="removeSpell(idx)" class="text-red-500 hover:text-red-700 text-xs">移除</button>
                        </div>
                      </div>

                      <!-- 新增現有法術 -->
                      <div class="p-3 border border-gray-200 rounded-lg bg-white space-y-2 mb-3">
                        <div class="text-xs font-bold text-gray-600">從資料庫加入</div>
                        <div class="flex gap-2">
                          <select v-model="newSpellQuery" class="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none">
                            <option value="">-- 選擇法術 --</option>
                            <option v-for="sp in availableSpells" :key="sp.id" :value="sp">{{ sp.name_zh || sp.name }} (Lv.{{ sp.level }})</option>
                          </select>
                          <button @click="if(newSpellQuery) { addSpell(newSpellQuery); newSpellQuery=''; }" class="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100">加入</button>
                        </div>
                      </div>

                      <!-- 新增自訂法術 -->
                      <div class="p-3 border border-gray-200 rounded-lg bg-white space-y-2">
                        <div class="text-xs font-bold text-gray-600">加入自訂法術</div>
                        <div class="flex gap-2">
                          <input type="text" v-model="customSpell.name" placeholder="法術名稱" class="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none">
                          <select v-model="customSpell.level" class="w-24 border border-gray-300 rounded-lg p-2 text-sm outline-none">
                            <option value="0">戲法</option>
                            <option v-for="n in 9" :key="n" :value="n">Lv {{ n }}</option>
                          </select>
                          <button @click="addCustomSpell()" class="px-3 py-2 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100">新增</button>
                        </div>
                      </div>
                      
                    </div>
                  </div>
                </div>`;

html = html.replace(oldSpells, newSpells);
fs.writeFileSync('v2/index.html', html);
