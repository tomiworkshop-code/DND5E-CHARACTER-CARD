const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const target = `              <!-- 佔位模擬內容 -->
              <div class="p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-center text-sm text-gray-400">
                <div class="mb-2">🚧 開發中</div>
                (此處將載入 <span class="font-bold text-gray-600">{{ activeModule }}</span> 在世界 <span class="font-bold text-gray-600">{{ selectedWorldKey }}</span> 下的詳細數據表單)
              </div>`;

const newHTML = `              <!-- 內容區塊 -->
              <div class="space-y-4">
                
                <!-- CLASSES 職業 -->
                <div v-if="activeModule === 'classes'" class="space-y-4">
                  <div v-for="(cls, idx) in (selectedChar.classes || [])" :key="idx" class="border border-gray-200 p-4 rounded-lg bg-gray-50">
                    <div class="grid grid-cols-2 gap-3 mb-2">
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">職業</label>
                        <select v-model="cls.name" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                          <option v-for="c in CLASSES" :key="c.name_zh" :value="c.name_zh">{{ c.name_zh }} ({{ c.name_en }})</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">等級</label>
                        <input type="number" v-model.number="cls.level" min="1" max="20" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-gray-500 mb-1">子職業 (可選)</label>
                      <input type="text" v-model="cls.subclass" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例如：生命領域">
                    </div>
                  </div>
                  <button @click="if(!selectedChar.classes) selectedChar.classes=[]; selectedChar.classes.push({name:'戰士', level:1, subclass:''})" class="w-full py-2 border border-dashed border-gray-300 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition">+ 新增兼職</button>
                </div>

                <!-- STATS 能力值 -->
                <div v-if="activeModule === 'stats'" class="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div v-for="(val, key) in selectedChar.abilities" :key="key" class="border border-gray-200 p-3 rounded-lg bg-gray-50 text-center">
                    <label class="block text-xs font-bold text-gray-500 mb-2 uppercase">{{ key }}</label>
                    <input type="number" v-model.number="selectedChar.abilities[key]" class="w-full text-center font-bold text-lg border border-gray-300 rounded-md p-1 focus:ring-blue-500 focus:border-blue-500 outline-none">
                  </div>
                </div>

                <!-- INVENTORY 物品與背包 -->
                <div v-if="activeModule === 'inventory'" class="space-y-4">
                  <div class="grid grid-cols-4 gap-2">
                    <div v-for="c in ['cp','sp','gp','pp']" :key="c">
                      <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">{{c}}</label>
                      <input type="number" v-model.number="selectedChar.coins[c]" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">裝備與物品 (每行一項)</label>
                    <textarea :value="selectedChar.inventory.join('\\n')" @input="selectedChar.inventory = $event.target.value.split('\\n').filter(Boolean)" rows="6" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"></textarea>
                  </div>
                </div>

                <!-- FAMILIAR 魔寵 -->
                <div v-if="activeModule === 'familiar'" class="space-y-3">
                  <div v-if="!selectedChar.familiar" class="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                    <div class="text-gray-400 text-sm mb-2">尚未設定魔寵</div>
                    <button @click="selectedChar.familiar = DND5E_CHAR.defaultFamiliar()" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">新增魔寵</button>
                  </div>
                  <div v-else class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">名稱</label>
                        <input type="text" v-model="selectedChar.familiar.name" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none">
                      </div>
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">類型/種類</label>
                        <input type="text" v-model="selectedChar.familiar.type" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none">
                      </div>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">HP (目前)</label>
                        <input type="number" v-model.number="selectedChar.familiar.hp.current" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none">
                      </div>
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">HP (最大)</label>
                        <input type="number" v-model.number="selectedChar.familiar.hp.max" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none">
                      </div>
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">AC</label>
                        <input type="number" v-model.number="selectedChar.familiar.ac" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none">
                      </div>
                    </div>
                  </div>
                </div>

                <!-- SPELLS 法術 -->
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
                    <textarea v-model="selectedChar.spellsText" rows="6" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none resize-none" placeholder="例如：\n魔法飛彈\n火球術"></textarea>
                  </div>
                </div>

                <!-- SKILLS 技能 -->
                <div v-if="activeModule === 'skills'" class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <div class="flex items-center gap-2">
                        <input type="checkbox" v-model="skData.proficient" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
                        <span class="text-sm font-medium text-gray-700">{{ skName }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-400">覆蓋</span>
                        <input type="number" v-model.number="skData.override" class="w-12 text-center text-xs border border-gray-300 rounded p-1" placeholder="無">
                      </div>
                    </div>
                  </div>
                </div>
                
              </div>`;

html = html.replace(target, newHTML);
fs.writeFileSync('v2/index.html', html);
