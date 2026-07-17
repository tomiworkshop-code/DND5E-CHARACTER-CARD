const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const oldFam = `<!-- FAMILIAR 魔寵 -->
                <div v-if="activeModule === 'familiar'" class="space-y-3">
                  <div v-if="!selectedChar.familiar" class="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                    <div class="text-gray-400 text-sm mb-2">尚未設定魔寵</div>
                    <button @click="selectedChar.familiar = {name:'', type:'', speed:'', ac:10, hp:{current:1, max:1}, abilities:{str:10, dex:10, con:10, int:10, wis:10, cha:10}, attacks:'', notes:''}" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">新增魔寵</button>
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
                </div>`;

const newFam = `<!-- FAMILIAR 魔寵 -->
                <div v-if="activeModule === 'familiar'" class="space-y-3">
                  <div v-if="!isEditMode">
                    <div v-if="!selectedChar.familiar" class="text-gray-400 text-sm text-center py-6">尚未設定魔寵</div>
                    <div v-else class="space-y-4">
                      <div class="flex justify-between items-end border-b pb-2">
                        <div>
                          <div class="text-lg font-bold">{{ selectedChar.familiar.name || '未命名魔寵' }}</div>
                          <div class="text-xs text-gray-500">{{ selectedChar.familiar.type || '未知種類' }}</div>
                        </div>
                        <div class="text-right">
                          <div class="text-xs text-gray-500">HP</div>
                          <div class="font-bold text-red-600">{{ selectedChar.familiar.hp.current }} / {{ selectedChar.familiar.hp.max }}</div>
                        </div>
                      </div>
                      <div>
                        <span class="text-xs text-gray-500">AC</span> <span class="font-bold">{{ selectedChar.familiar.ac }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-else>
                    <div v-if="!selectedChar.familiar" class="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                      <div class="text-gray-400 text-sm mb-2">尚未設定魔寵</div>
                      <button @click="selectedChar.familiar = {name:'', type:'', speed:'', ac:10, hp:{current:1, max:1}, abilities:{str:10, dex:10, con:10, int:10, wis:10, cha:10}, attacks:'', notes:''}" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">新增魔寵</button>
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
                </div>`;

html = html.replace(oldFam, newFam);
fs.writeFileSync('v2/index.html', html);
