const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetAction = `          createNewChar: () => {
            console.log("createNewChar clicked");
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
            };`;

const replaceAction = `          createNewChar: () => {
            console.log("createNewChar clicked");
            const newChar = {
              id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,7),
              name: '新冒險者',
              race: '',
              alignment: '',
              classes: [],
              abilities: { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
              abilityBonus: { str:0, dex:0, con:0, int:0, wis:0, cha:0 },
              hp: { current:10, max:10, temp:0 },
              ac: 10,
              initiative: 0,
              inventory: [],
              spellbook: [],
              spellSlots: Array.from({length:9}, (_,i)=>({ level:i+1, max:0, used:0 })),
              familiar: null,
              skills: {},
              worldProgress: {}
            };`;

html = html.replace(targetAction, replaceAction);
fs.writeFileSync('v2/index.html', html);
