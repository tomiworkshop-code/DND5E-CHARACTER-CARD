const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// Add descOpen and needsExpand
const targetFeat = `const featOpen = ref({});`;
const newFeat = `const featOpen = ref({});
        const descOpen = ref({});
        const toggleDesc = (id) => { descOpen.value[id] = !descOpen.value[id]; };
        const needsExpand = (text) => {
          if (!text) return false;
          return text.length > 150 || text.split('\\n').length > 4;
        };`;

html = html.replace(targetFeat, newFeat);

// Add to return statement
const targetReturn = `featOpen,
          toggleFeat: (idx) => { featOpen.value[idx] = !featOpen.value[idx]; },`;
const newReturn = `featOpen,
          toggleFeat: (idx) => { featOpen.value[idx] = !featOpen.value[idx]; },
          descOpen,
          toggleDesc,
          needsExpand,`;
html = html.replace(targetReturn, newReturn);

// Update Inventory View Mode
const targetInv = `<div v-if="item.desc" class="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{{ item.desc }}</div>`;
const newInv = `<div v-if="item.desc" class="mt-1">
                            <div class="text-xs text-gray-500 whitespace-pre-wrap" :class="!descOpen['inv-'+idx] && needsExpand(item.desc) ? 'line-clamp-3' : ''">{{ item.desc }}</div>
                            <button v-if="needsExpand(item.desc)" @click="toggleDesc('inv-'+idx)" class="text-xs text-blue-500 hover:text-blue-700 mt-0.5">
                              {{ descOpen['inv-'+idx] ? '▲ 收起' : '... 更多' }}
                            </button>
                          </div>`;
html = html.replace(targetInv, newInv);

// Update Spell View Mode
const targetSpl = `<div v-if="spell.desc" class="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{{ spell.desc }}</div>`;
const newSpl = `<div v-if="spell.desc" class="mt-1">
                            <div class="text-xs text-gray-500 whitespace-pre-wrap" :class="!descOpen['spl-'+idx] && needsExpand(spell.desc) ? 'line-clamp-3' : ''">{{ spell.desc }}</div>
                            <button v-if="needsExpand(spell.desc)" @click="toggleDesc('spl-'+idx)" class="text-xs text-blue-500 hover:text-blue-700 mt-0.5">
                              {{ descOpen['spl-'+idx] ? '▲ 收起' : '... 更多' }}
                            </button>
                          </div>`;
html = html.replace(targetSpl, newSpl);

fs.writeFileSync('v2/index.html', html);
