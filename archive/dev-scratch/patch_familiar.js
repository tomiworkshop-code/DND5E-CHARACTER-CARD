const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const oldView = `<div class="flex justify-between items-end border-b pb-2">
                        <div>
                          <div class="text-lg font-bold">{{ selectedChar.familiar?.name || '未命名魔寵' }}</div>
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
                    </div>`;

const newView = `<div class="flex justify-between items-end border-b pb-2">
                        <div>
                          <div class="text-lg font-bold">{{ selectedChar.familiar?.name || '未命名魔寵' }}</div>
                          <div class="text-xs text-gray-500">{{ selectedChar.familiar.type || '未知種類' }}</div>
                        </div>
                        <div class="text-right">
                          <div class="text-xs text-gray-500">HP</div>
                          <div class="font-bold text-red-600">{{ selectedChar.familiar.hp?.current || 1 }} / {{ selectedChar.familiar.hp?.max || 1 }}</div>
                        </div>
                      </div>
                      <div class="flex gap-4">
                        <div><span class="text-xs text-gray-500">AC</span> <span class="font-bold">{{ selectedChar.familiar.ac || 10 }}</span></div>
                        <div><span class="text-xs text-gray-500">速度</span> <span class="font-bold">{{ selectedChar.familiar.speed || '-' }}</span></div>
                      </div>
                      
                      <div v-if="selectedChar.familiar.story" class="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div class="text-xs font-bold text-gray-500 mb-1">📖 故事背景</div>
                        <div class="text-sm text-gray-700 whitespace-pre-wrap">{{ selectedChar.familiar.story }}</div>
                      </div>

                      <div v-if="selectedChar.familiar.skills && selectedChar.familiar.skills.length > 0">
                        <div class="text-xs font-bold text-gray-500 mb-2">✨ 技能與特性</div>
                        <div class="space-y-2">
                          <div v-for="(sk, i) in selectedChar.familiar.skills" :key="i" class="bg-blue-50/50 p-2 rounded border border-blue-100">
                            <div class="font-bold text-sm text-blue-900">{{ sk.name }}</div>
                            <div class="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{{ sk.desc }}</div>
                          </div>
                        </div>
                      </div>
                    </div>`;

const oldEditInit = `<button @click="selectedChar.familiar = {name:'', type:'', speed:'', ac:10, hp:{current:1, max:1}, abilities:{str:10, dex:10, con:10, int:10, wis:10, cha:10}, attacks:'', notes:''}" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">新增魔寵</button>`;

const newEditInit = `<button @click="selectedChar.familiar = {name:'', type:'', speed:'', ac:10, hp:{current:1, max:1}, abilities:{str:10, dex:10, con:10, int:10, wis:10, cha:10}, story:'', skills:[{name:'', desc:''}]}" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">新增魔寵</button>`;

const oldEdit = `<div>
                          <label class="block text-xs font-bold text-gray-500 mb-1">AC</label>
                          <input type="number" v-model.number="selectedChar.familiar.ac" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none">
                        </div>
                      </div>
                    </div>
                  </div>`;

const newEdit = `<div>
                          <label class="block text-xs font-bold text-gray-500 mb-1">AC</label>
                          <input type="number" v-model.number="selectedChar.familiar.ac" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none">
                        </div>
                      </div>
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">速度</label>
                        <input type="text" v-model="selectedChar.familiar.speed" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none" placeholder="例如: 30呎, 飛行60呎">
                      </div>

                      <div class="border-t pt-3 mt-2">
                        <label class="block text-xs font-bold text-gray-500 mb-1">故事背景</label>
                        <textarea v-model="selectedChar.familiar.story" rows="3" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none resize-none" placeholder="魔寵的由來與個性..."></textarea>
                      </div>

                      <div class="border-t pt-3 mt-2">
                        <div class="flex justify-between items-center mb-2">
                          <label class="block text-xs font-bold text-gray-500">技能與特性</label>
                          <button @click="if(!selectedChar.familiar.skills) selectedChar.familiar.skills=[]; selectedChar.familiar.skills.push({name:'', desc:''})" class="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">+ 新增技能</button>
                        </div>
                        <div v-if="selectedChar.familiar.skills && selectedChar.familiar.skills.length > 0" class="space-y-3">
                          <div v-for="(sk, i) in selectedChar.familiar.skills" :key="i" class="p-2 border border-blue-100 bg-blue-50/30 rounded-lg relative">
                            <button @click="selectedChar.familiar.skills.splice(i, 1)" class="absolute top-2 right-2 text-red-400 hover:text-red-600">✕</button>
                            <input type="text" v-model="sk.name" placeholder="技能名稱 (例如: 敏銳聽覺)" class="w-full mb-2 bg-transparent border-b border-blue-200 focus:border-blue-400 outline-none text-sm font-bold text-blue-900 pr-6">
                            <textarea v-model="sk.desc" rows="2" placeholder="技能描述..." class="w-full bg-white/50 border border-blue-100 rounded p-2 text-sm outline-none resize-none"></textarea>
                          </div>
                        </div>
                        <div v-else class="text-xs text-gray-400 text-center py-2 italic">目前沒有技能</div>
                      </div>
                    </div>
                  </div>`;

html = html.replace(oldView, newView);
html = html.replace(oldEditInit, newEditInit);
html = html.replace(oldEdit, newEdit);

fs.writeFileSync('v2/index.html', html);
