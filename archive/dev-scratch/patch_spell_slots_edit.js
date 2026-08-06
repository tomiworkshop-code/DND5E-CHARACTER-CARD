const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetEdit = `<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div v-for="slot in selectedChar.spellSlots" :key="slot.level" class="flex items-center gap-1 text-sm bg-gray-50 p-2 rounded border border-gray-100">
                          <span class="w-8 font-bold text-gray-600">Lv {{ slot.level }}</span>
                          <input type="number" v-model.number="slot.used" class="w-12 border border-gray-300 rounded p-1 text-center" title="已使用">
                          <span class="text-gray-400">/</span>
                          <input type="number" v-model.number="slot.max" class="w-12 border border-gray-300 rounded p-1 text-center" title="最大值">
                        </div>
                      </div>`;

const replaceEdit = `<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div v-for="slot in selectedChar.spellSlots" :key="slot.level" class="flex items-center gap-1 text-sm bg-gray-50 p-2 rounded border border-gray-100">
                          <span class="w-8 font-bold text-gray-600 text-xs">Lv {{ slot.level }}</span>
                          <div class="flex items-center flex-1">
                            <input type="number" v-model.number="slot.used" class="w-full min-w-0 border border-gray-300 rounded-l p-1 text-center outline-none focus:border-blue-500" title="已消耗">
                            <span class="bg-gray-200 text-gray-500 px-1.5 py-1 text-xs border-y border-gray-300">/</span>
                            <input type="number" v-model.number="slot.max" class="w-full min-w-0 border border-gray-300 rounded-r p-1 text-center outline-none focus:border-blue-500" title="總次數">
                          </div>
                        </div>
                      </div>`;

html = html.replace(targetEdit, replaceEdit);
fs.writeFileSync('v2/index.html', html);
