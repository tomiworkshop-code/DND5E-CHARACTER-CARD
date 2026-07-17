const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// Update 'addSpell' to save 'desc' if it exists. (The JSON in spells.json has 'desc_zh' or 'desc_en', we'll just save the whole original object so it's fully accessible)
const targetAddSpell = `          addSpell: (sp) => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; selectedChar.value.spellbook.push({ id: sp.id || Date.now(), name: sp.name_zh || sp.name_en || sp.name, level: sp.level, custom: false }); },`;
const newAddSpell = `          addSpell: (sp) => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; selectedChar.value.spellbook.push({ id: sp.id || Date.now(), name: sp.name_zh || sp.name_en || sp.name, level: sp.level, desc: sp.desc_zh || sp.desc_en || sp.desc || '', custom: false }); },`;
html = html.replace(targetAddSpell, newAddSpell);


// Update View mode rendering
const targetView = `<div v-for="(spell, idx) in selectedChar.spellbook" :key="idx" class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm flex justify-between items-center">
                          <span class="font-bold text-gray-800">{{ spell.name || spell.name_zh || spell.id }}</span>
                          <span class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{{ spell.level === 0 || spell.level === '0' ? '戲法' : 'Lv ' + spell.level }}</span>
                        </div>`;
const newView = `<div v-for="(spell, idx) in selectedChar.spellbook" :key="idx" class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-1">
                          <div class="flex justify-between items-center w-full">
                            <span class="font-bold text-sm text-gray-800">{{ spell.name || spell.name_zh || spell.id }}</span>
                            <span class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{{ spell.level === 0 || spell.level === '0' ? '戲法' : 'Lv ' + spell.level }}</span>
                          </div>
                          <div v-if="spell.desc" class="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{{ spell.desc }}</div>
                        </div>`;
html = html.replace(targetView, newView);


// Update Edit mode rendering
const targetEdit = `<div v-for="(spell, idx) in selectedChar.spellbook" :key="idx" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm flex justify-between items-center shadow-sm">
                          <div>
                            <span class="font-bold text-gray-800">{{ spell.name || spell.name_zh || spell.id }}</span>
                            <span class="text-xs text-gray-500 ml-2">({{ spell.level === 0 || spell.level === '0' ? '戲法' : 'Lv ' + spell.level }})</span>
                          </div>
                          <button @click="removeSpell(idx)" class="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded bg-red-50">移除</button>
                        </div>`;
const newEdit = `<div v-for="(spell, idx) in selectedChar.spellbook" :key="idx" class="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm flex justify-between items-start shadow-sm">
                          <div class="flex-1">
                            <div class="font-bold text-gray-800">
                              {{ spell.name || spell.name_zh || spell.id }}
                              <span class="text-xs text-gray-500 font-normal ml-1">({{ spell.level === 0 || spell.level === '0' ? '戲法' : 'Lv ' + spell.level }})</span>
                            </div>
                            <div v-if="spell.desc" class="text-xs text-gray-400 mt-1 line-clamp-2" :title="spell.desc">{{ spell.desc }}</div>
                          </div>
                          <button @click="removeSpell(idx)" class="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded bg-red-50 ml-2 mt-0.5 shrink-0">移除</button>
                        </div>`;
html = html.replace(targetEdit, newEdit);


// Update Custom spell logic
const targetAddCustom = `addCustomSpell: () => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; if(customSpell.value.name) { selectedChar.value.spellbook.push({ id: Date.now(), name: customSpell.value.name, level: customSpell.value.level, custom: true }); customSpell.value.name = ''; } },`;
const newAddCustom = `addCustomSpell: () => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; if(customSpell.value.name) { selectedChar.value.spellbook.push({ id: Date.now(), name: customSpell.value.name, level: customSpell.value.level, desc: customSpell.value.desc || '', custom: true }); customSpell.value.name = ''; customSpell.value.desc = ''; } },`;
html = html.replace(targetAddCustom, newAddCustom);

const targetCustomInputs = `                        <div class="flex gap-2">
                          <input type="text" v-model="customSpell.name" placeholder="法術名稱" class="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none">
                          <select v-model="customSpell.level" class="border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white">
                            <option value="0">戲法</option>
                            <option v-for="n in 9" :key="n" :value="n">Lv {{ n }}</option>
                          </select>
                          <button @click="addCustomSpell" class="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">新增</button>
                        </div>`;
const newCustomInputs = `                        <div class="flex flex-col gap-2">
                          <div class="flex gap-2">
                            <input type="text" v-model="customSpell.name" placeholder="法術名稱" class="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none">
                            <select v-model="customSpell.level" class="border border-gray-300 rounded-lg p-2 text-sm outline-none bg-white">
                              <option value="0">戲法</option>
                              <option v-for="n in 9" :key="n" :value="n">Lv {{ n }}</option>
                            </select>
                          </div>
                          <div class="flex gap-2">
                            <textarea v-model="customSpell.desc" placeholder="法術描述..." rows="2" class="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none resize-none"></textarea>
                            <button @click="addCustomSpell" class="px-3 py-2 h-full bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">新增</button>
                          </div>
                        </div>`;
html = html.replace(targetCustomInputs, newCustomInputs);


fs.writeFileSync('v2/index.html', html);
