const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const target = `          filteredAvailableItems,
          equippedItems:`;

const replacement = `          filteredAvailableItems,
          customItem,
          addItem: (it) => {
            if(!selectedChar.value.inventory) selectedChar.value.inventory = [];
            selectedChar.value.inventory.push({ 
              name: it?.name_zh || it?.name_en || it?.name, 
              qty: 1, 
              desc: it?.desc_zh || it?.desc_en || it?.desc || '',
              category: it?.type || it?.category || '',
              equipped: false,
              id: Date.now() + Math.random()
            });
          },
          addCustomItem: () => {
            if(!selectedChar.value.inventory) selectedChar.value.inventory = [];
            if(customItem.value.name) {
              selectedChar.value.inventory.push({ 
                name: customItem.value.name, 
                qty: customItem.value.qty || 1, 
                desc: customItem.value.desc || '',
                equipped: false,
                id: Date.now() + Math.random()
              });
              customItem.value.name = '';
              customItem.value.qty = 1;
              customItem.value.desc = '';
            }
          },
          equippedItems:`;

html = html.replace(target, replacement);
fs.writeFileSync('v2/index.html', html);
