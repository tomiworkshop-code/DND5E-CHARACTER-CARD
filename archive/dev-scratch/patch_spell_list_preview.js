const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// The request is: Show spell details IN THE LIST, before they select it.
const spellListFind = `<div v-for="sp in filteredAvailableSpells" :key="sp.id || sp.name_zh" class="flex justify-between items-center p-2 border-b last:border-b-0 hover:bg-gray-50">
                          <div>
                            <div class="font-bold text-sm text-gray-800">{{ sp.name_zh || sp.name_en || sp.name }}</div>
                            <div class="text-xs text-gray-500">{{ sp.level === 0 ? '戲法' : 'Lv ' + sp.level }}</div>
                          </div>
                          <button v-if="isSpellInBook(sp)" disabled class="text-xs px-2 py-1 bg-gray-100 text-gray-400 rounded cursor-not-allowed">已加入</button>
                          <button v-else @click="addSpell(sp)" class="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-medium">+ 加入</button>
                        </div>`;

const spellListReplace = `<div v-for="sp in filteredAvailableSpells" :key="sp.id || sp.name_zh" class="flex flex-col p-2 border-b last:border-b-0 hover:bg-gray-50 gap-1">
                          <div class="flex justify-between items-start">
                            <div class="flex-1">
                              <div class="font-bold text-sm text-gray-800 flex items-center gap-2">
                                {{ sp.name_zh || sp.name_en || sp.name }}
                                <span class="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded">{{ sp.level === 0 ? '戲法' : 'Lv ' + sp.level }}</span>
                              </div>
                              <div class="text-[10px] text-gray-400 mt-0.5">
                                {{ [sp.school ? '學派:'+sp.school : '', sp.time && sp.time.length ? '時間:'+sp.time[0].number+sp.time[0].unit : '', sp.range && sp.range.distance ? '射程:'+(sp.range.distance.amount||'')+(sp.range.distance.type||'') : ''].filter(Boolean).join(' | ') }}
                              </div>
                              <div class="text-xs text-gray-500 mt-1 line-clamp-2" :title="Array.isArray(sp.entries_zh) ? sp.entries_zh.join('\\n') : (Array.isArray(sp.entries) ? sp.entries.join('\\n') : (sp.desc_zh || sp.desc_en || sp.desc || ''))">
                                {{ Array.isArray(sp.entries_zh) ? sp.entries_zh[0] : (Array.isArray(sp.entries) ? sp.entries[0] : (sp.desc_zh || sp.desc_en || sp.desc || '')) }}
                              </div>
                            </div>
                            <div class="ml-2 shrink-0">
                              <button v-if="isSpellInBook(sp)" disabled class="text-xs px-2 py-1 bg-gray-100 text-gray-400 rounded cursor-not-allowed">已加入</button>
                              <button v-else @click="addSpell(sp)" class="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-medium">+ 加入</button>
                            </div>
                          </div>
                        </div>`;

html = html.replace(spellListFind, spellListReplace);
fs.writeFileSync('v2/index.html', html);
