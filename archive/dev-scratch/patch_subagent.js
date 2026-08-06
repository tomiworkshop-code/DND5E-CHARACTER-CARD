const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// 1. Add isEditMode and availableSpells to setup()
html = html.replace("const activeModule = ref(null);", "const activeModule = ref(null);\n        const isEditMode = ref(false);\n        const availableSpells = ref([]);\n        const newSpellQuery = ref('');\n        const customSpell = ref({ name: '', level: '1' });");

// 2. Add fetch logic in onMounted
const onMountedStr = `onMounted(() => {`;
const fetchStr = `onMounted(() => {
          fetch('../data/spells.json').then(res => res.json()).then(data => {
            availableSpells.value = data.spells || data || [];
          }).catch(() => {
            availableSpells.value = [
              { id: 'fireball', name_zh: '火球術', level: 3 },
              { id: 'magic_missile', name_zh: '魔法飛彈', level: 1 }
            ];
          });`;
html = html.replace(onMountedStr, fetchStr);

// 3. Expose new refs
html = html.replace("activeModule,", "activeModule,\n          isEditMode,\n          availableSpells,\n          newSpellQuery,\n          customSpell,\n          addSpell: (sp) => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; selectedChar.value.spellbook.push({ id: sp.id || Date.now(), name: sp.name_zh || sp.name, level: sp.level, custom: false }); },\n          addCustomSpell: () => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; if(customSpell.value.name) { selectedChar.value.spellbook.push({ id: Date.now(), name: customSpell.value.name, level: customSpell.value.level, custom: true }); customSpell.value.name = ''; } },\n          removeSpell: (idx) => { selectedChar.value.spellbook.splice(idx, 1); },");

// 4. Update the inner page header to include Edit toggle
const headerTarget = `<button @click="activeModule = null" class="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 font-medium transition">`;
const headerReplacement = `<div class="flex gap-2">
                <button @click="isEditMode = !isEditMode" :class="isEditMode ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'" class="px-3 py-1 text-sm rounded-lg hover:bg-gray-200 font-medium transition">
                  {{ isEditMode ? '✏️ 編輯中' : '👁️ 檢視模式' }}
                </button>
                <button @click="activeModule = null; isEditMode = false;" class="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 font-medium transition">
                  ← 返回
                </button>
              </div>`;
html = html.replace(/<button @click="activeModule = null"[^>]*>\s*← 返回\s*<\/button>/, headerReplacement);

// 5. Replace modules with view/edit logic
// I'll run a sed/awk or python script for targeted replacements next.
fs.writeFileSync('v2/index.html', html);
