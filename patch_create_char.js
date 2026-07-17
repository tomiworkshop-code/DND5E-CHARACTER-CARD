const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetReturn = `          createNewWorld,
          currentView,`;

const replaceReturn = `          createNewWorld,
          createNewChar: () => {
            const newChar = {
              id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,7),
              name: '新冒險者',
              race: '',
              alignment: '',
              classes: [],
              abilities: { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
              hp: { current:10, max:10, temp:0 },
              ac: 10,
              initiative: 0,
              inventory: [],
              spellbook: [],
              spellSlots: Array.from({length:9}, (_,i)=>({ level:i+1, max:0, used:0 })),
              worldProgress: {}
            };
            chars.value.push(newChar);
            selectedCharId.value = newChar.id;
            switchView('characters');
          },
          currentView,`;

const targetBtn = `<button class="bg-white border border-gray-200 text-gray-700 rounded-xl p-4 text-left shadow-sm hover:bg-gray-50 transition">
            <div class="text-xl mb-1">✍️</div>
            <div class="font-bold text-sm">創建新角色</div>`;

const replaceBtn = `<button @click="createNewChar" class="bg-white border border-gray-200 text-gray-700 rounded-xl p-4 text-left shadow-sm hover:bg-gray-50 transition">
            <div class="text-xl mb-1">✍️</div>
            <div class="font-bold text-sm">創建新角色</div>`;

html = html.replace(targetReturn, replaceReturn);
html = html.replace(targetBtn, replaceBtn);

fs.writeFileSync('v2/index.html', html);
