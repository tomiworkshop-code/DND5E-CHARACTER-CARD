const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const target = `          addItem: (it) => {
            if(!selectedChar.value.inventory) selectedChar.value.inventory = [];
            selectedChar.value.inventory.push({ 
              name: it?.name_zh || it?.name_en || it?.name, 
              qty: 1, 
              desc: it?.desc_zh || it?.desc_en || it?.desc || '',
              category: it?.type || it?.category || '',
              equipped: false,
              id: Date.now() + Math.random()
            });
          },`;

const replacement = `          addItem: (it) => {
            if(!selectedChar.value.inventory) selectedChar.value.inventory = [];
            
            // Fix: Find existing item and increment qty to prevent "missing/reduced quantities" feeling
            let existingItem = selectedChar.value.inventory.find(x => x.name === (it?.name_zh || it?.name_en || it?.name));
            if (existingItem) {
              existingItem.qty = (existingItem.qty || 1) + 1;
              return;
            }

            // Fix: Extract description properly from entries_zh array
            let itemDesc = '';
            if (Array.isArray(it.entries_zh)) itemDesc = it.entries_zh.join('\\n');
            else if (Array.isArray(it.entries)) itemDesc = it.entries.join('\\n');
            else itemDesc = it.desc || '';

            selectedChar.value.inventory.push({ 
              name: it?.name_zh || it?.name_en || it?.name, 
              qty: 1, 
              desc: itemDesc,
              category: it?.type || it?.category || '',
              equipped: false,
              id: Date.now() + Math.random()
            });
          },`;

html = html.replace(target, replacement);
fs.writeFileSync('v2/index.html', html);
