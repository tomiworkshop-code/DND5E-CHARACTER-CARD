const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// Replace top buttons
html = html.replace(
`<div class="flex items-center justify-between gap-2">
                    <button @click="openFamiliarPresetPicker" class="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100 transition">🐾 從範本中匯入</button>
                    <span v-if="familiarImportCtx.mode==='dm' && familiarImportCtx.started" class="text-[11px] text-amber-600">已開團 · 機制面需 DM 調整</span>
                  </div>`,
`<div v-if="isEditMode" class="flex items-center justify-between gap-2 mb-4">
                    <button @click="openFamiliarPresetPicker" class="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100 transition">🐾 從範本中匯入</button>
                    <button @click="if(!selectedChar.familiars) selectedChar.familiars=[]; selectedChar.familiars.push({name:'', type:'', speed:'', ac:10, hp:{current:1, max:1}, abilities:{str:10, dex:10, con:10, int:10, wis:10, cha:10}, senses:'', resistances:'', story:'', skills:[], attacks:[]})" class="px-3 py-1.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-200 transition">＋ 新增魔寵</button>
                    <span v-if="familiarImportCtx.mode==='dm' && familiarImportCtx.started" class="text-[11px] text-amber-600">已開團 · 機制面需 DM 調整</span>
                  </div>`
);

// We need to rewrite the main content block for familiars.
// We will replace the entire block from `<div v-if="!isEditMode">` down to `<!-- SPELLS 法術 -->` minus the top lines.

const oldBlockStart = `<div v-if="!isEditMode">
                    <div v-if="!selectedChar.familiar" class="text-gray-400 text-sm text-center py-6">尚未設定魔寵</div>`;

const newBlockStart = `
                  <div v-if="!selectedChar.familiars || selectedChar.familiars.length === 0" class="text-gray-400 text-sm text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">尚未設定魔寵</div>
                  <div v-else class="space-y-6">
                    <div v-for="(fam, famIndex) in selectedChar.familiars" :key="famIndex" class="border border-gray-200 rounded-xl p-4 bg-white shadow-sm relative">
                      <button v-if="isEditMode" @click="selectedChar.familiars.splice(famIndex, 1)" class="absolute top-2 right-2 text-red-400 hover:text-red-600 px-2 py-1 bg-red-50 rounded text-xs">刪除此魔寵</button>
                  <div v-if="!isEditMode">`;

html = html.replace(oldBlockStart, newBlockStart);

// We need to replace all `selectedChar.familiar.` with `fam.` inside the v-for loop block, but wait, if we just do global replace of selectedChar.familiar to fam, we might hit other things.
// Let's do it carefully.
let inFamBlock = false;
let lines = html.split('\n');
let outLines = [];
for (let i = 0; i < lines.length; i++) {
   if (lines[i].includes(`v-for="(fam, famIndex) in selectedChar.familiars"`)) {
      inFamBlock = true;
   }
   if (inFamBlock && lines[i].includes(`<!-- SPELLS 法術 -->`)) {
      inFamBlock = false;
      outLines.push(`                    </div>\n                  </div>`); // Close the v-for and space-y-6
   }

   let line = lines[i];
   if (inFamBlock) {
      line = line.replace(/selectedChar\.familiar\?/g, 'fam?');
      line = line.replace(/selectedChar\.familiar/g, 'fam');
      
      // Also the edit mode else block had a check:
      if (line.includes(`<div v-else class="space-y-3">`)) {
         // keep it
      }
      if (line.includes(`<div v-if="!fam" class="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">`)) {
         // remove this block entirely as we already loop over valid fams
         i += 3; // skip this and next 3 lines
         continue;
      }
   }
   outLines.push(line);
}
html = outLines.join('\n');

html = html.replace(/char\.familiar = FAM_PRESETS\.applyPreset\(char\.familiar, preset\);/, 
`if (!char.familiars) char.familiars = [];
char.familiars.push(FAM_PRESETS.applyPreset(window.DND5E_CHAR.defaultFamiliar(), preset));`);

html = html.replace(/<div v-if="selectedChar && selectedChar.familiar"/g, '<div v-if="selectedChar"');
html = html.replace(/v-if="selectedChar && fam"/g, '');

html = html.replace(/v2\.1\.0/g, 'v2.2.0');
html = html.replace(/Build 0720\.1/g, 'Build 0720.5');

fs.writeFileSync('v2/index.html', html);
console.log('HTML patched.');
