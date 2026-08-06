/* patch_skills_expertise_saves.js
 * 技能頁強化 + 豁免檢定（僅動 v2/index.html 模板；JS 邏輯在 v2/app.js）：
 *   1) 技能加「專精 (Expertise)」切換：view 顯示 ★★／專精徽章；edit 加勾選（需先熟練）。
 *   2) 每個技能旁顯示主控屬性（skillAttrZh）。
 *   3) 技能頁內新增「豁免檢定 (Saving Throws)」區塊：六大屬性各一列，view/edit 兩模式。
 * 參考既有 patch_familiar_import.js 風格：字串精確替換 + 冪等 guard。
 */
const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const oldModule = `                <!-- SKILLS 技能 -->
                <div v-if="activeModule === 'skills'" class="space-y-4">
                  <div v-if="!isEditMode">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="p-2 border rounded-lg flex items-center justify-between" :class="skData.proficient ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'">
                        <div class="flex items-center gap-2">
                          <span v-if="skData.proficient" class="text-blue-500 font-bold">★</span>
                          <span v-else class="text-gray-300">☆</span>
                          <span class="text-sm" :class="skData.proficient ? 'font-bold text-blue-900' : 'text-gray-600'">{{ skName }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <div v-if="skData.override !== null && skData.override !== '' && skData.override !== undefined" class="text-xs font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">覆寫</div>
                          <div class="text-lg font-black" :class="skillValue(skName) >= 0 ? 'text-blue-600' : 'text-red-600'">{{ fmtMod(skillValue(skName)) }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <div class="flex items-center gap-2">
                        <input type="checkbox" v-model="skData.proficient" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
                        <span class="text-sm font-medium text-gray-700">{{ skName }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="flex items-center gap-1">
                          <span class="text-xs text-gray-400">覆寫</span>
                          <input type="number" v-model.number="skData.override" class="w-12 text-center text-xs border border-gray-300 rounded p-1" placeholder="無">
                        </div>
                        <div class="w-8 text-right font-black" :class="skillValue(skName) >= 0 ? 'text-blue-600' : 'text-red-600'">{{ fmtMod(skillValue(skName)) }}</div>
                      </div>
                    </div>
                  </div>
                </div>`;

const newModule = `                <!-- SKILLS 技能 -->
                <div v-if="activeModule === 'skills'" class="space-y-4">
                  <div v-if="!isEditMode">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="p-2 border rounded-lg flex items-center justify-between" :class="skData.proficient ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'">
                        <div class="flex items-center gap-2 min-w-0">
                          <span v-if="skData.expertise" class="text-amber-500 font-bold" title="專精 (Expertise)">★★</span>
                          <span v-else-if="skData.proficient" class="text-blue-500 font-bold">★</span>
                          <span v-else class="text-gray-300">☆</span>
                          <span class="text-sm truncate" :class="skData.proficient ? 'font-bold text-blue-900' : 'text-gray-600'">{{ skName }}</span>
                          <span class="text-[10px] text-gray-400 shrink-0">{{ skillAttrZh(skName) }}</span>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                          <div v-if="skData.expertise" class="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">專精</div>
                          <div v-if="skData.override !== null && skData.override !== '' && skData.override !== undefined" class="text-xs font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">覆寫</div>
                          <div class="text-lg font-black" :class="skillValue(skName) >= 0 ? 'text-blue-600' : 'text-red-600'">{{ fmtMod(skillValue(skName)) }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <div class="flex items-center gap-2 min-w-0">
                        <input type="checkbox" v-model="skData.proficient" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
                        <span class="text-sm font-medium text-gray-700 truncate">{{ skName }}</span>
                        <span class="text-[10px] text-gray-400 shrink-0">{{ skillAttrZh(skName) }}</span>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <label class="flex items-center gap-1 text-xs cursor-pointer" :class="skData.proficient ? 'text-amber-600' : 'text-gray-300 cursor-not-allowed'" title="專精：熟練加值 x2（需先具備熟練）">
                          <input type="checkbox" v-model="skData.expertise" :disabled="!skData.proficient" class="w-3.5 h-3.5 text-amber-500 rounded border-gray-300 focus:ring-amber-400">
                          <span>專精</span>
                        </label>
                        <div class="flex items-center gap-1">
                          <span class="text-xs text-gray-400">覆寫</span>
                          <input type="number" v-model.number="skData.override" class="w-12 text-center text-xs border border-gray-300 rounded p-1" placeholder="無">
                        </div>
                        <div class="w-8 text-right font-black" :class="skillValue(skName) >= 0 ? 'text-blue-600' : 'text-red-600'">{{ fmtMod(skillValue(skName)) }}</div>
                      </div>
                    </div>
                  </div>

                  <!-- 豁免檢定 (Saving Throws) -->
                  <div class="pt-3 mt-1 border-t border-gray-100">
                    <div class="text-xs font-bold text-gray-500 mb-2">豁免檢定 (Saving Throws)</div>
                    <div v-if="!isEditMode" class="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div v-for="sv in SAVE_LIST" :key="sv.key" class="p-2 border rounded-lg flex items-center justify-between" :class="(selectedChar.profSaves && selectedChar.profSaves[sv.key]) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'">
                        <div class="flex items-center gap-2">
                          <span v-if="selectedChar.profSaves && selectedChar.profSaves[sv.key]" class="text-blue-500 font-bold">★</span>
                          <span v-else class="text-gray-300">☆</span>
                          <span class="text-sm" :class="(selectedChar.profSaves && selectedChar.profSaves[sv.key]) ? 'font-bold text-blue-900' : 'text-gray-600'">{{ sv.zh }}</span>
                        </div>
                        <div class="text-lg font-black" :class="saveValue(sv.key) >= 0 ? 'text-blue-600' : 'text-red-600'">{{ fmtMod(saveValue(sv.key)) }}</div>
                      </div>
                    </div>
                    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div v-for="sv in SAVE_LIST" :key="sv.key" class="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                        <label class="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" v-model="selectedChar.profSaves[sv.key]" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
                          <span class="text-sm font-medium text-gray-700">{{ sv.zh }} 豁免</span>
                        </label>
                        <div class="w-8 text-right font-black" :class="saveValue(sv.key) >= 0 ? 'text-blue-600' : 'text-red-600'">{{ fmtMod(saveValue(sv.key)) }}</div>
                      </div>
                    </div>
                  </div>
                </div>`;

if (html.indexOf('豁免檢定 (Saving Throws)') === -1) {
  if (html.indexOf(oldModule) === -1) {
    console.error('patch_skills_expertise_saves.js: 找不到 SKILLS 模板錨點，未套用（請確認 index.html 未被其他 patch 改動）');
    process.exit(1);
  }
  html = html.replace(oldModule, newModule);
  fs.writeFileSync('v2/index.html', html);
  console.log('patch_skills_expertise_saves.js applied');
} else {
  console.log('patch_skills_expertise_saves.js: already applied (skip)');
}
