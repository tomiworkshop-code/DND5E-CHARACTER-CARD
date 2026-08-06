const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetEdit = `<div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div v-for="def in abilityDefs" :key="def.key" class="border border-gray-200 p-3 rounded-lg bg-gray-50">
                      <div class="text-xs font-bold text-gray-700 mb-2 uppercase text-center flex justify-center gap-1">
                        <span>{{ def.key }}</span><span class="text-gray-400">{{ def.zh }}</span>
                      </div>
                      <div class="mb-2">
                        <label class="block text-[10px] text-gray-500 text-center mb-1">總分</label>
                        <input type="number" v-model.number="selectedChar.abilities[def.key]" class="w-full text-center font-bold text-lg border border-gray-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500 outline-none">
                      </div>
                      <div class="bg-white border border-gray-100 rounded p-1.5 flex justify-center items-center text-xs gap-2">
                        <span class="text-gray-500">調整值</span>
                        <span :class="['font-bold text-sm', abilityMod(abilityTotal(def.key)) >= 0 ? 'text-blue-600' : 'text-red-600']">
                          {{ fmtMod(abilityMod(abilityTotal(def.key))) }}
                        </span>
                      </div>
                    </div>
                  </div>`;

const newEdit = `<div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div v-for="def in abilityDefs" :key="def.key" class="border border-gray-200 p-3 rounded-lg bg-gray-50">
                      <div class="text-xs font-bold text-gray-700 mb-2 uppercase text-center flex justify-center gap-1">
                        <span>{{ def.key }}</span><span class="text-gray-400">{{ def.zh }}</span>
                      </div>
                      <div class="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label class="block text-[10px] text-gray-500 text-center mb-1">基礎</label>
                          <input type="number" v-model.number="selectedChar.abilities[def.key]" class="w-full text-center font-bold text-sm border border-gray-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500 outline-none">
                        </div>
                        <div>
                          <label class="block text-[10px] text-gray-500 text-center mb-1">加值</label>
                          <input type="number" v-model.number="selectedChar.abilityBonus[def.key]" class="w-full text-center font-bold text-sm border border-gray-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500 outline-none">
                        </div>
                      </div>
                      <div class="bg-white border border-gray-100 rounded p-1.5 flex justify-between items-center text-xs">
                        <span class="text-gray-500">總計 <span class="font-bold text-gray-800 text-sm">{{ abilityTotal(def.key) }}</span></span>
                        <span :class="['font-bold text-sm', abilityMod(abilityTotal(def.key)) >= 0 ? 'text-blue-600' : 'text-red-600']">
                          {{ fmtMod(abilityMod(abilityTotal(def.key))) }}
                        </span>
                      </div>
                    </div>
                  </div>`;

html = html.replace(targetEdit, newEdit);
fs.writeFileSync('v2/index.html', html);
