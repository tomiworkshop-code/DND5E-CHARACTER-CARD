const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetView = `<div v-if="!isEditMode" class="grid grid-cols-3 gap-3">
                    <div v-for="def in abilityDefs" :key="def.key" class="border border-gray-200 p-3 rounded-lg bg-gray-50 flex flex-col items-center shadow-sm">
                      <div class="text-xs font-bold text-gray-500 mb-1 uppercase flex gap-1">
                        <span>{{ def.key }}</span><span class="text-gray-400">{{ def.zh }}</span>
                      </div>
                      <div :class="['text-3xl font-black mb-1', abilityMod(abilityTotal(def.key)) >= 0 ? 'text-blue-600' : 'text-red-600']">
                        {{ fmtMod(abilityMod(abilityTotal(def.key))) }}
                      </div>
                      <div class="text-[10px] text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-medium tracking-wider">
                        {{ selectedChar.abilities[def.key] }}
                        <span v-if="selectedChar.abilityBonus[def.key]" :class="selectedChar.abilityBonus[def.key] > 0 ? 'text-blue-600' : 'text-red-600'">
                          {{ selectedChar.abilityBonus[def.key] > 0 ? '+' : '' }}{{ selectedChar.abilityBonus[def.key] }}
                        </span>
                        = <span class="text-gray-800 font-bold">{{ abilityTotal(def.key) }}</span>
                      </div>
                    </div>
                  </div>`;

const newView = `<div v-if="!isEditMode" class="grid grid-cols-3 gap-3">
                    <div v-for="def in abilityDefs" :key="def.key" class="border border-gray-200 p-3 rounded-lg bg-gray-50 flex flex-col items-center shadow-sm">
                      <div class="text-xs font-bold text-gray-500 mb-1 uppercase flex gap-1">
                        <span>{{ def.key }}</span><span class="text-gray-400">{{ def.zh }}</span>
                      </div>
                      <div class="text-3xl font-black mb-1 text-gray-800">
                        {{ abilityTotal(def.key) }}
                      </div>
                      <div :class="['text-xs bg-gray-200 px-2 py-0.5 rounded-full font-bold tracking-wider', abilityMod(abilityTotal(def.key)) >= 0 ? 'text-blue-600' : 'text-red-600']">
                        調整值 {{ fmtMod(abilityMod(abilityTotal(def.key))) }}
                      </div>
                    </div>
                  </div>`;

const targetEdit = `<div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                        <span class="text-gray-500">總分 <span class="font-bold text-gray-800">{{ abilityTotal(def.key) }}</span></span>
                        <span :class="['font-bold', abilityMod(abilityTotal(def.key)) >= 0 ? 'text-blue-600' : 'text-red-600']">
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

html = html.replace(targetView, newView);
html = html.replace(targetEdit, newEdit);

fs.writeFileSync('v2/index.html', html);
