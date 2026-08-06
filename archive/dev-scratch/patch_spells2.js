const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const target = `                <!-- SPELLS 法術 -->
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
                    <textarea v-model="selectedChar.spellsText" rows="6" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none resize-none" placeholder="例如：
魔法飛彈
火球術"></textarea>
                  </div>
                </div>`;

const newSpellsUI = `                <!-- SPELLS 法術 -->
                <div v-if="activeModule === 'spells'" class="space-y-4">
                  
                  <div v-if="!isEditMode">
                    <div>
                      <label class="block text-xs font-bold text-gray-500 mb-1">法術位 (Slots)</label>
                      <div class="flex flex-wrap gap-2">
                        <div v-for="slot in selectedChar.spellSlots?.filter(s => s.max > 0)" :key="slot.level" class="px-2 py-1 bg-blue-50 text-blue-800 rounded text-sm border border-blue-200">
                          Lv {{ slot.level }}：{{ slot.max - slot.used }} / {{ slot.max }}
                        </div>
                        <div v-if="!selectedChar.spellSlots?.some(s => s.max > 0)" class="text-xs text-gray-400">無法術位</div>
                      </div>
                    </div>
                    
                    <div class="mt-4">
                      <label class="block text-xs font-bold text-gray-500 mb-2">已準備 / 習得法術</label>
                      <div v-if="selectedChar.spellbook && selectedChar.spellbook.length > 0" class="space-y-2">
                        <div v-for="(spell, idx) in selectedChar.spellbook" :key="idx" class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm flex justify-between items-center">
                          <span class="font-bold text-gray-800">{{ spell.name || spell.name_zh || spell.id }}</span>
                          <span class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{{ spell.level === 0 || spell.level === '0' ? '戲法' : 'Lv ' + spell.level }}</span>
                        </div>
                      </div>
                      <div v-else class="text-xs text-gray-400 p-4 border border-dashed rounded-lg text-center">尚未習得任何法術</div>
                    </div>
                  </div>

                  <div v-else class="space-y-6">
                    <div>
                      <label class="block text-xs font-bold text-gray-500 mb-1">法術位 (Slots)</label>
                      <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div v-for="slot in selectedChar.spellSlots" :key="slot.level" class="flex items-center gap-1 text-sm bg-gray-50 p-2 rounded border border-gray-100">
                          <span class="w-8 font-bold text-gray-600">Lv {{ slot.level }}</span>
                          <input type="number" v-model.number="slot.used" class="w-12 border border-gray-300 rounded p-1 text-center" title="已使用">
                          <span class="text-gray-400">/</span>
                          <input type="number" v-model.number="slot.max" class="w-12 border border-gray-300 rounded p-1 text-center" title="最大值">
                        </div>
                      </div>
                    </div>

                    <div class="border-t pt-4">
                      <label class="block text-xs font-bold text-gray-500 mb-2">法術書 (目前習得)</label>
                      <div class="space-y-2 mb-4">
                        <div v-for="(spell, idx) in selectedChar.spellbook" :key="idx" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm flex justify-between items-center shadow-sm">
                          <div>
                            <span class="font-bold text-gray-800">{{ spell.name || spell.name_zh || spell.id }}</span>
                            <span class="text-xs text-gray-500 ml-2">({{ spell.level === 0 || spell.level === '0' ? '戲法' : 'Lv ' + spell.level }})</span>
                          </div>
                          <button @click="removeSpell(idx)" class="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded bg-red-50">移除</button>
                        </div>
                        <div v-if="!selectedChar.spellbook || selectedChar.spellbook.length === 0" class="text-xs text-gray-400 text-center py-2">目前沒有法術</div>
                      </div>
                    </div>

                    <div class="border border-blue-100 bg-blue-50/30 p-4 rounded-xl space-y-3">
                      <label class="block text-sm font-bold text-blue-800">📖 加入法術</label>
                      
                      <div class="flex gap-2">
                        <input type="text" v-model="newSpellQuery" placeholder="搜尋法術名稱..." class="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                        <select v-model="spellFilterLevel" class="border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white">
                          <option value="">全部環級</option>
                          <option value="0">戲法</option>
                          <option v-for="n in 9" :key="n" :value="n">Lv {{ n }}</option>
                        </select>
                      </div>

                      <div class="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                        <div v-for="sp in filteredAvailableSpells" :key="sp.id || sp.name_zh" class="flex justify-between items-center p-2 border-b last:border-b-0 hover:bg-gray-50">
                          <div>
                            <div class="font-bold text-sm text-gray-800">{{ sp.name_zh || sp.name_en || sp.name }}</div>
                            <div class="text-xs text-gray-500">{{ sp.level === 0 ? '戲法' : 'Lv ' + sp.level }}</div>
                          </div>
                          <button v-if="isSpellInBook(sp)" disabled class="text-xs px-2 py-1 bg-gray-100 text-gray-400 rounded cursor-not-allowed">已加入</button>
                          <button v-else @click="addSpell(sp)" class="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-medium">+ 加入</button>
                        </div>
                        <div v-if="filteredAvailableSpells.length === 0" class="text-center text-xs text-gray-400 py-4">無符合的法術</div>
                      </div>
                      
                      <div class="pt-2 border-t border-blue-100 mt-2">
                        <label class="block text-xs font-bold text-gray-500 mb-1">新增自訂法術</label>
                        <div class="flex gap-2">
                          <input type="text" v-model="customSpell.name" placeholder="法術名稱" class="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none">
                          <select v-model="customSpell.level" class="border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white">
                            <option value="0">戲法</option>
                            <option v-for="n in 9" :key="n" :value="n">Lv {{ n }}</option>
                          </select>
                          <button @click="addCustomSpell" class="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition font-medium">新增</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>`;

if(html.includes(target)) {
    html = html.replace(target, newSpellsUI);
    console.log("Successfully replaced Spells UI target.");
} else {
    console.log("Target string not found for Spells UI.");
}
fs.writeFileSync('v2/index.html', html);
