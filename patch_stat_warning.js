const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// 1. Add hasStatEffect helper
const targetSetup = `const featOpen = ref({});`;
const newSetup = `const featOpen = ref({});
        const hasStatEffect = (name, desc, rawItem = null) => {
          let text = String(name || '') + ' ' + String(desc || '');
          if (rawItem) {
            if (rawItem.bonus) return true;
            if (Array.isArray(rawItem.entries_zh)) text += ' ' + rawItem.entries_zh.join('');
          }
          const keywords = ['+1', '+2', '+3', '防禦等級', '豁免', '值變為', 'AC:'];
          return keywords.some(k => text.includes(k));
        };`;
html = html.replace(targetSetup, newSetup);

// 2. Add to return block
const targetReturn = `toggleDesc,
          needsExpand,`;
const newReturn = `toggleDesc,
          needsExpand,
          hasStatEffect,`;
html = html.replace(targetReturn, newReturn);

// 3. Update UI - View Mode Inventory
const targetViewInv = `<div class="font-bold text-gray-800">{{ item.name || item }}</div>`;
const newViewInv = `<div class="font-bold text-gray-800 flex items-center flex-wrap gap-1">
                            <span>{{ item.name || item }}</span>
                            <span v-if="hasStatEffect(item.name||item, item.desc)" class="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5 rounded shrink-0 leading-none">⚠️ 影響數值</span>
                          </div>`;
html = html.replace(targetViewInv, newViewInv);

// 4. Update UI - Edit Mode Owned Inventory
const targetEditInv = `<div class="font-bold text-gray-800 truncate">{{ item.name || item }}</div>`;
const newEditInv = `<div class="font-bold text-gray-800 flex items-center gap-1 min-w-0">
                              <span class="truncate">{{ item.name || item }}</span>
                              <span v-if="hasStatEffect(item.name||item, item.desc)" class="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5 rounded shrink-0 leading-none">⚠️ 數值</span>
                            </div>`;
html = html.replace(targetEditInv, newEditInv);

// 5. Update UI - Edit Mode Available Items List
const targetAvailable = `<div class="font-bold text-sm text-gray-800">{{ it.name_zh || it.name_en || it.name }}</div>`;
const newAvailable = `<div class="font-bold text-sm text-gray-800 flex items-center gap-1">
                              <span>{{ it.name_zh || it.name_en || it.name }}</span>
                              <span v-if="hasStatEffect(it.name_zh || it.name_en || it.name, '', it)" class="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1 py-0.5 rounded shrink-0 leading-none">⚠️ 影響數值</span>
                            </div>`;
html = html.replace(targetAvailable, newAvailable);

fs.writeFileSync('v2/index.html', html);
