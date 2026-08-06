const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetView = `<div>
                      <label class="block text-xs font-bold text-gray-500 mb-1">法術位 (Slots)</label>
                      <div class="flex flex-wrap gap-2">
                        <div v-for="slot in selectedChar.spellSlots?.filter(s => s.max > 0)" :key="slot.level" class="px-2 py-1 bg-blue-50 text-blue-800 rounded text-sm border border-blue-200">
                          Lv {{ slot.level }}：{{ slot.max - slot.used }} / {{ slot.max }}
                        </div>
                        <div v-if="!selectedChar.spellSlots?.some(s => s.max > 0)" class="text-xs text-gray-400">無法術位</div>
                      </div>
                    </div>`;

const replaceView = `<div>
                      <label class="block text-xs font-bold text-gray-500 mb-2">法術位 (點擊圓圈消耗)</label>
                      <div class="space-y-2">
                        <div v-for="slot in selectedChar.spellSlots?.filter(s => s.max > 0)" :key="slot.level" class="flex items-center gap-3 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                          <span class="w-10 text-sm font-bold text-blue-900">Lv {{ slot.level }}</span>
                          <div class="flex-1 flex flex-wrap gap-1.5">
                            <button v-for="i in slot.max" :key="i" 
                                    @click="clickSpellSlot(slot, i)"
                                    class="w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center shadow-sm"
                                    :class="i <= slot.used ? 'bg-gray-300 border-gray-400 opacity-50' : 'bg-blue-400 border-blue-500 shadow-blue-200/50 hover:bg-blue-300'">
                            </button>
                          </div>
                          <span class="text-xs font-bold text-blue-800 w-12 text-right">{{ slot.max - slot.used }} 剩餘</span>
                        </div>
                        <div v-if="!selectedChar.spellSlots?.some(s => s.max > 0)" class="text-xs text-gray-400 p-2 border border-dashed rounded text-center">無法術位</div>
                      </div>
                    </div>`;

const targetReturn = `          toggleEquip: (item) => {`;
const replaceReturn = `          clickSpellSlot: (slot, i) => {
            if (slot.used === i) slot.used = i - 1;
            else slot.used = i;
          },
          toggleEquip: (item) => {`;

html = html.replace(targetView, replaceView);
html = html.replace(targetReturn, replaceReturn);

fs.writeFileSync('v2/index.html', html);
