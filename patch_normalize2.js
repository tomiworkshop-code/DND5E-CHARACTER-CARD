const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetLoad = `          try {
            const raw = localStorage.getItem('dnd_chars');
            if (raw) {
              chars.value = JSON.parse(raw);
            }
          } catch(e) {
            console.error("無法讀取既有存檔", e);
          }`;

const newLoad = `          try {
            const raw = localStorage.getItem('dnd_chars');
            if (raw) {
              let parsed = JSON.parse(raw);
              if (!Array.isArray(parsed)) parsed = [];
              
              // 深度補齊資料，防止 Vue template 遇到 undefined properties 白畫面
              chars.value = parsed.map(char => {
                if (!char.abilities) char.abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
                if (!char.abilityBonus) char.abilityBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
                if (!char.coins) char.coins = { cp: 0, sp: 0, gp: 0, pp: 0 };
                if (!char.inventory) char.inventory = [];
                if (!char.spellbook) char.spellbook = [];
                if (!char.classes) char.classes = [];
                
                // 遷移舊版字串陣列背包
                char.inventory = char.inventory.map(item => {
                  if (typeof item === 'string') {
                    return { id: Date.now() + Math.random(), name: item, qty: 1, desc: '' };
                  }
                  return item;
                });
                return char;
              });
            }
          } catch(e) {
            console.error("無法讀取既有存檔", e);
          }`;

html = html.replace(targetLoad, newLoad);
fs.writeFileSync('v2/index.html', html);
