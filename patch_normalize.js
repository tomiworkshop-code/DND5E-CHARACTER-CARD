const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetLoad = `        const loadChars = () => {
          try {
            const data = localStorage.getItem('dnd5e_chars');
            if(data) {
              charList.value = JSON.parse(data);
            }
          } catch(e) { console.error('Failed to parse chars', e); }
        };`;

const newLoad = `        const normalizeChar = (char) => {
          // Ensure all required nested objects exist to prevent white screen crashes
          if (!char.abilities) char.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
          if (!char.abilityBonus) char.abilityBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
          if (!char.coins) char.coins = { cp: 0, sp: 0, gp: 0, pp: 0 };
          if (!char.inventory) char.inventory = [];
          if (!char.spellbook) char.spellbook = [];
          if (!char.classes) char.classes = [];
          
          // Migrate old string array inventory to object array
          char.inventory = char.inventory.map(item => {
            if (typeof item === 'string') {
              return { id: Date.now() + Math.random(), name: item, qty: 1, desc: '' };
            }
            return item;
          });
          
          return char;
        };

        const loadChars = () => {
          try {
            const data = localStorage.getItem('dnd5e_chars');
            if(data) {
              charList.value = JSON.parse(data).map(normalizeChar);
            }
          } catch(e) { console.error('Failed to parse chars', e); }
        };`;

html = html.replace(targetLoad, newLoad);
fs.writeFileSync('v2/index.html', html);
