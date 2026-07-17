const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// The issue is that startWorldEdit was NOT defined in the Vue setup but it was returned.
// Let's check where the activeRecordTab was injected and see if it overwrote startWorldEdit.
const checkRegex = /const activeRecordTab = ref\('log'\);/;
console.log(html.includes("const activeRecordTab = ref('log');"));

// I need to add startWorldEdit and saveWorldEdit back to the Vue setup block
const fixRegex = /const activeRecordTab = ref\('log'\);/;
const fixReplacement = `const isWorldEditMode = ref(false);
        const worldEditTemp = Vue.reactive({ name: '', location: '', time: '', quest: '' });
        const startWorldEdit = () => {
          worldEditTemp.name = selectedWorldObj.value.name || '';
          worldEditTemp.location = selectedWorldObj.value.location || '';
          worldEditTemp.time = selectedWorldObj.value.time || '';
          worldEditTemp.quest = selectedWorldObj.value.quest || '';
          isWorldEditMode.value = true;
        };
        const saveWorldEdit = () => {
          selectedWorldObj.value.name = worldEditTemp.name;
          selectedWorldObj.value.location = worldEditTemp.location;
          selectedWorldObj.value.time = worldEditTemp.time;
          selectedWorldObj.value.quest = worldEditTemp.quest;
          isWorldEditMode.value = false;
        };
        const activeRecordTab = ref('log');`;

html = html.replace(fixRegex, fixReplacement);

// Build bump
html = html.replace(/Build 0717\.06/, "Build 0717.07");

fs.writeFileSync('v2/index.html', html);
