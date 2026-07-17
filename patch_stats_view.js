const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetStatsView = `<div class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-medium">
                        總分 {{ abilityTotal(def.key) }}
                      </div>`;

const newStatsView = `<div class="text-[10px] text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-medium tracking-wider">
                        {{ selectedChar.abilities[def.key] }}
                        <span v-if="selectedChar.abilityBonus[def.key]" :class="selectedChar.abilityBonus[def.key] > 0 ? 'text-blue-600' : 'text-red-600'">
                          {{ selectedChar.abilityBonus[def.key] > 0 ? '+' : '' }}{{ selectedChar.abilityBonus[def.key] }}
                        </span>
                        = <span class="text-gray-800 font-bold">{{ abilityTotal(def.key) }}</span>
                      </div>`;

html = html.replace(targetStatsView, newStatsView);
fs.writeFileSync('v2/index.html', html);
