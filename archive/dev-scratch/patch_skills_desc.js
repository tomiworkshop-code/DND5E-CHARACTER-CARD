const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// 1. Fix desc mapping in addSpell and addItem
html = html.replace(
  `desc: itemData.desc_zh || itemData.desc || ''`,
  `desc: Array.isArray(itemData.entries_zh) ? itemData.entries_zh.join('\\n') : (Array.isArray(itemData.entries) ? itemData.entries.join('\\n') : (itemData.desc_zh || itemData.desc || ''))`
);
html = html.replace(
  `desc: sp.desc_zh || sp.desc_en || sp.desc || ''`,
  `desc: Array.isArray(sp.entries_zh) ? sp.entries_zh.join('\\n') : (Array.isArray(sp.entries) ? sp.entries.join('\\n') : (sp.desc_zh || sp.desc_en || sp.desc || ''))`
);

// 2. Add skill calculations and initialization in watch
const watchFind = `          if (edit && mod === 'stats' && char) {`;
const watchInsert = `          if (edit && mod === 'skills' && char) {
            if (!char.skills) char.skills = {};
            coreRules.SKILLS.forEach(s => {
              if (!char.skills[s.zh]) char.skills[s.zh] = { proficient: false, override: null };
            });
          }
          if (edit && mod === 'stats' && char) {`;
html = html.replace(watchFind, watchInsert);

const computedFind = `const isDMWorld = computed(() => selectedWorldKey.value !== '__solo__');`;
const computedInsert = `
        const totalLevel = computed(() => {
          if (!selectedChar.value || !selectedChar.value.classes) return 1;
          return selectedChar.value.classes.reduce((sum, cl) => sum + (Number(cl.level) || 0), 0) || 1;
        });
        const profBonus = computed(() => Math.ceil(totalLevel.value / 4) + 1);
        const skillValue = (zh) => {
          if (!selectedChar.value || !selectedChar.value.skills) return 0;
          const def = coreRules.SKILLS.find(s => s.zh === zh);
          if (!def) return 0;
          const skData = selectedChar.value.skills[zh];
          if (!skData) return abilityMod(abilityTotal(def.attr));
          if (skData.override !== null && skData.override !== '' && skData.override !== undefined) return Number(skData.override);
          return abilityMod(abilityTotal(def.attr)) + (skData.proficient ? profBonus.value : 0);
        };
        
        const isDMWorld = computed(() => selectedWorldKey.value !== '__solo__');`;
html = html.replace(computedFind, computedInsert);

// Add to return
html = html.replace(`abilityDefs,`, `abilityDefs,\n          profBonus,\n          skillValue,`);

// 3. Update Skills UI
const skillsUIFind = `<div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="p-2 border rounded-lg flex items-center justify-between" :class="skData.proficient ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'">
                        <div class="flex items-center gap-2">
                          <span v-if="skData.proficient" class="text-blue-500">★</span>
                          <span v-else class="text-gray-300">☆</span>
                          <span class="text-sm" :class="skData.proficient ? 'font-bold text-blue-900' : 'text-gray-600'">{{ skName }}</span>
                        </div>
                        <div v-if="skData.override" class="text-xs font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">={{ skData.override }}</div>
                      </div>`;
const skillsUIReplace = `<div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="p-2 border rounded-lg flex items-center justify-between" :class="skData.proficient ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'">
                        <div class="flex items-center gap-2">
                          <span v-if="skData.proficient" class="text-blue-500 font-bold">★</span>
                          <span v-else class="text-gray-300">☆</span>
                          <span class="text-sm" :class="skData.proficient ? 'font-bold text-blue-900' : 'text-gray-600'">{{ skName }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <div v-if="skData.override !== null && skData.override !== '' && skData.override !== undefined" class="text-xs font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">覆寫</div>
                          <div class="text-lg font-black" :class="skillValue(skName) >= 0 ? 'text-blue-600' : 'text-red-600'">{{ fmtMod(skillValue(skName)) }}</div>
                        </div>
                      </div>`;
html = html.replace(skillsUIFind, skillsUIReplace);

const skillsUIEditFind = `<div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <div class="flex items-center gap-2">
                        <input type="checkbox" v-model="skData.proficient" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
                        <span class="text-sm font-medium text-gray-700">{{ skName }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-400">覆蓋</span>
                        <input type="number" v-model.number="skData.override" class="w-12 text-center text-xs border border-gray-300 rounded p-1" placeholder="無">
                      </div>
                    </div>`;
const skillsUIEditReplace = `<div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <div class="flex items-center gap-2">
                        <input type="checkbox" v-model="skData.proficient" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
                        <span class="text-sm font-medium text-gray-700">{{ skName }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="flex items-center gap-1">
                          <span class="text-xs text-gray-400">覆寫</span>
                          <input type="number" v-model.number="skData.override" class="w-12 text-center text-xs border border-gray-300 rounded p-1" placeholder="無">
                        </div>
                        <div class="w-8 text-right font-black" :class="skillValue(skName) >= 0 ? 'text-blue-600' : 'text-red-600'">{{ fmtMod(skillValue(skName)) }}</div>
                      </div>
                    </div>`;
html = html.replace(skillsUIEditFind, skillsUIEditReplace);

fs.writeFileSync('v2/index.html', html);
