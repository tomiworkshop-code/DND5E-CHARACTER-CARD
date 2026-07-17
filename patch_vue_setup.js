const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const target1 = `        const availableSpells = ref([]);
        const newSpellQuery = ref('');
        const customSpell = ref({ name: '', level: '1' });`;

const replace1 = `        const availableSpells = ref([]);
        const newSpellQuery = ref('');
        const spellFilterLevel = ref('');
        const customSpell = ref({ name: '', level: '1' });
        
        const filteredAvailableSpells = computed(() => {
          let q = newSpellQuery.value.toLowerCase().trim();
          let level = spellFilterLevel.value;
          return availableSpells.value.filter(sp => {
            if (level !== '' && String(sp.level) !== String(level)) return false;
            if (q) {
              const zh = (sp.name_zh || sp.name || '').toLowerCase();
              const en = (sp.name_en || '').toLowerCase();
              if (!zh.includes(q) && !en.includes(q)) return false;
            }
            return true;
          }).slice(0, 30);
        });
        
        const isSpellInBook = (sp) => {
          if(!selectedChar.value || !selectedChar.value.spellbook) return false;
          return selectedChar.value.spellbook.some(b => b.name === sp.name_zh || b.name === sp.name || b.name === sp.name_en);
        };`;

if(html.includes(target1)) {
    html = html.replace(target1, replace1);
    console.log("Replaced target1");
}

const target2 = `          availableSpells,
          newSpellQuery,
          customSpell,
          addSpell: (sp) => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; selectedChar.value.spellbook.push({ id: sp.id || Date.now(), name: sp.name_zh || sp.name, level: sp.level, custom: false }); },
          addCustomSpell: () => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; if(customSpell.value.name) { selectedChar.value.spellbook.push({ id: Date.now(), name: customSpell.value.name, level: customSpell.value.level, custom: true }); customSpell.value.name = ''; } },
          removeSpell: (idx) => { selectedChar.value.spellbook.splice(idx, 1); },`;

const replace2 = `          availableSpells,
          newSpellQuery,
          spellFilterLevel,
          filteredAvailableSpells,
          isSpellInBook,
          customSpell,
          addSpell: (sp) => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; selectedChar.value.spellbook.push({ id: sp.id || Date.now(), name: sp.name_zh || sp.name_en || sp.name, level: sp.level, custom: false }); },
          addCustomSpell: () => { if(!selectedChar.value.spellbook) selectedChar.value.spellbook = []; if(customSpell.value.name) { selectedChar.value.spellbook.push({ id: Date.now(), name: customSpell.value.name, level: customSpell.value.level, custom: true }); customSpell.value.name = ''; } },
          removeSpell: (idx) => { selectedChar.value.spellbook.splice(idx, 1); },`;

if(html.includes(target2)) {
    html = html.replace(target2, replace2);
    console.log("Replaced target2");
}

fs.writeFileSync('v2/index.html', html);
