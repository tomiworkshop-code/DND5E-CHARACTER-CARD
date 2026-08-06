const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// The error says "Cannot access 'selectedChar' before initialization" at line 914.
// Looking at line 914: watch([isEditMode, activeModule, selectedChar], ...
// However, selectedChar is defined at line 971: const selectedChar = computed(...)

const targetWatch = `        watch([isEditMode, activeModule, selectedChar], ([edit, mod, char]) => {
          if (edit && mod === 'stats' && char) {
            if (!char.abilities) {
              char.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
            }
            if (!char.abilityBonus) {
              char.abilityBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
            }
          }
          if (edit && mod === 'inventory' && char) {
            if (char.inventory && char.inventory.length > 0 && typeof char.inventory[0] === 'string') {
              char.inventory = char.inventory.map(item => ({ name: item, qty: 1, desc: '' }));
            }
          }
        }, { immediate: true });`;

html = html.replace(targetWatch, ''); // Remove from current location

// Re-insert right below selectedChar
const insertPoint = `        const selectedChar = computed(() => {
          if (!selectedCharId.value) return null;
          return chars.value.find(c => c.id === selectedCharId.value) || null;
        });`;

html = html.replace(insertPoint, insertPoint + '\n\n' + targetWatch);

fs.writeFileSync('v2/index.html', html);
