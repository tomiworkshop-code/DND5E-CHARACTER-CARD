const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetWatch = `        watch([isEditMode, activeModule, selectedChar], ([edit, mod, char]) => {
          if (edit && mod === 'stats' && char) {
            if (!char.abilityBonus) {
              char.abilityBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
            }
          }
        }, { immediate: true });`;

const newWatch = `        watch([isEditMode, activeModule, selectedChar], ([edit, mod, char]) => {
          if (edit && mod === 'stats' && char) {
            if (!char.abilities) {
              char.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
            }
            if (!char.abilityBonus) {
              char.abilityBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
            }
          }
        }, { immediate: true });`;

html = html.replace(targetWatch, newWatch);
fs.writeFileSync('v2/index.html', html);
