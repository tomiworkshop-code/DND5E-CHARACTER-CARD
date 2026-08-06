const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const oldHeader = `<div class="flex items-center justify-between gap-2">
                    <button @click="openFamiliarPresetPicker" class="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100 transition">🐾 從範本中匯入</button>
                    <span v-if="familiarImportCtx.mode==='dm' && familiarImportCtx.started" class="text-[11px] text-amber-600">已開團 · 機制面需 DM 調整</span>
                  </div>`;

const newHeader = `<div v-if="isEditMode" class="flex items-center justify-between gap-2 mb-4">
                    <button @click="openFamiliarPresetPicker" class="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100 transition">🐾 從範本中匯入</button>
                    <button @click="if(!selectedChar.familiars) selectedChar.familiars=[]; selectedChar.familiars.push({name:'', type:'', speed:'', ac:10, hp:{current:1, max:1}, abilities:{str:10, dex:10, con:10, int:10, wis:10, cha:10}, senses:'', resistances:'', story:'', skills:[], attacks:[]})" class="px-3 py-1.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-200 transition">＋ 新增魔寵</button>
                    <span v-if="familiarImportCtx.mode==='dm' && familiarImportCtx.started" class="text-[11px] text-amber-600">已開團 · 機制面需 DM 調整</span>
                  </div>`;
html = html.replace(oldHeader, newHeader);

html = html.replace(
`<div v-if="selectedChar && selectedChar.familiar" class="text-sm text-gray-600 mb-4">此動作會<span class="font-bold text-red-600">覆蓋魔寵的機制面</span>（AC／HP／能力值／速度／感官／特性／動作），但會<span class="font-bold text-emerald-600">保留你自取的名稱與故事背景</span>。</div>`,
`<div v-if="selectedChar" class="text-sm text-gray-600 mb-4">此動作會新增一隻魔寵。機制面將被覆蓋，名稱與故事背景將留空給你填寫。</div>`
);

const oldFamBlock = `<div v-if="!isEditMode">
                    <div v-if="!selectedChar.familiar" class="text-gray-400 text-sm text-center py-6">尚未設定魔寵</div>
                    <div v-else class="space-y-4">`;

const newFamBlock = `<div v-if="!selectedChar.familiars || selectedChar.familiars.length === 0" class="text-gray-400 text-sm text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">尚未設定魔寵</div>
                  <div v-else class="space-y-6">
                    <div v-for="(fam, famIndex) in selectedChar.familiars" :key="famIndex" class="border border-gray-200 rounded-xl p-4 bg-white shadow-sm relative">
                      <button v-if="isEditMode" @click="selectedChar.familiars.splice(famIndex, 1)" class="absolute top-2 right-2 text-red-400 hover:text-red-600 px-2 py-1 bg-red-50 rounded text-xs">刪除此魔寵</button>
                  <div v-if="!isEditMode">
                    <div class="space-y-4">`;
html = html.replace(oldFamBlock, newFamBlock);

const oldEditElse = `</div>
                  <div v-else>
                    <div v-if="!selectedChar.familiar" class="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                      <div class="text-gray-400 text-sm mb-2">尚未設定魔寵</div>
                      <button @click="selectedChar.familiar = {name:'', type:'', speed:'', ac:10, hp:{current:1, max:1}, abilities:{str:10, dex:10, con:10, int:10, wis:10, cha:10}, senses:'', resistances:'', story:'', skills:[], attacks:[]}" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">新增魔寵</button>
                    </div>
                    <div v-else class="space-y-3">`;

const newEditElse = `</div>
                  <div v-else>
                    <div class="space-y-3">`;
html = html.replace(oldEditElse, newEditElse);

// End tags fix
const oldEndTags = `</div>
                    </div>
                  </div>
                </div>

                <!-- SPELLS 法術 -->`;
const newEndTags = `</div>
                    </div>
                  </div>
                    </div>
                  </div>
                </div>

                <!-- SPELLS 法術 -->`;
html = html.replace(oldEndTags, newEndTags);

// Now global replace `selectedChar.familiar.` with `fam.` inside the v-for block.
// Instead of risky regex, I'll extract the block and replace.
let startIdx = html.indexOf('<div v-for="(fam, famIndex) in selectedChar.familiars"');
let endIdx = html.indexOf('<!-- SPELLS 法術 -->');
let block = html.substring(startIdx, endIdx);
block = block.replace(/selectedChar\.familiar\?/g, 'fam?');
block = block.replace(/selectedChar\.familiar/g, 'fam');
html = html.substring(0, startIdx) + block + html.substring(endIdx);

html = html.replace(/v2\.1\.0/g, 'v2.2.0');
html = html.replace(/Build 0720\.1/g, 'Build 0720.5');

fs.writeFileSync('v2/index.html', html);
console.log('HTML exact patch applied.');
