const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

/* 1) 引入 shared/familiar-presets.js（放在 room.js 之後，與其他 shared 模組同區） */
const oldScript = `  <script src="../shared/room.js"></script>`;
const newScript = `  <script src="../shared/room.js"></script>
  <script src="../shared/familiar-presets.js"></script>`;
if (html.indexOf('../shared/familiar-presets.js') === -1) {
  html = html.replace(oldScript, newScript);
}

/* 2) 魔寵區頂部加「從範本中匯入」按鈕 + 分組選單 + 確認 dialog */
const oldFamOpen = `                <div v-if="activeModule === 'familiar'" class="space-y-3">
                  <div v-if="!isEditMode">`;

const newFamOpen = `                <div v-if="activeModule === 'familiar'" class="space-y-3">
                  <!-- 從範本中匯入 (Familiar Preset Import) -->
                  <div class="flex items-center justify-between gap-2">
                    <button @click="openFamiliarPresetPicker" class="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100 transition">🐾 從範本中匯入</button>
                    <span v-if="familiarImportCtx.mode==='dm' && familiarImportCtx.started" class="text-[11px] text-amber-600">已開團 · 機制面需 DM 調整</span>
                  </div>
                  <!-- 範本選單（依 tier 分組） -->
                  <div v-if="familiarImport.pickerOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="closeFamiliarPresetPicker">
                    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
                      <div class="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
                        <div class="font-bold text-gray-800">從範本中匯入魔寵</div>
                        <button @click="closeFamiliarPresetPicker" class="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                      </div>
                      <div class="p-4 space-y-4">
                        <div v-for="grp in familiarPresetGroups" :key="grp.tier">
                          <div class="text-xs font-bold text-gray-500 mb-2">{{ grp.label }}</div>
                          <div class="grid grid-cols-1 gap-2">
                            <button v-for="entry in grp.items" :key="entry.preset.id" @click="askImportFamiliarPreset(entry)" :disabled="!entry.allowed"
                              class="text-left border rounded-lg p-2 transition"
                              :class="entry.allowed ? 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40' : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'">
                              <div class="flex justify-between items-center gap-2">
                                <span class="font-bold text-sm text-gray-800">{{ entry.preset.type }}</span>
                                <span class="text-[10px] text-gray-500 shrink-0">AC {{ entry.preset.ac }} · HP {{ entry.preset.hp.max }}</span>
                              </div>
                              <div class="text-[11px] text-gray-500 mt-0.5">{{ entry.preset.speed }}</div>
                              <div v-if="!entry.allowed && entry.reason" class="text-[10px] text-amber-600 mt-1">🔒 {{ entry.reason }}</div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- 確認覆蓋 dialog -->
                  <div v-if="familiarImport.confirmPreset" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" @click.self="familiarImport.confirmPreset=null">
                    <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
                      <div class="font-bold text-gray-800 mb-2">匯入「{{ familiarImport.confirmPreset.type }}」範本？</div>
                      <div v-if="selectedChar && selectedChar.familiar" class="text-sm text-gray-600 mb-4">此動作會<span class="font-bold text-red-600">覆蓋魔寵的機制面</span>（AC／HP／能力值／速度／感官／特性／動作），但會<span class="font-bold text-emerald-600">保留你自取的名稱與故事背景</span>。</div>
                      <div v-else class="text-sm text-gray-600 mb-4">將以此範本建立魔寵的機制面，名稱與故事背景留空給你填寫。</div>
                      <div class="flex justify-end gap-2">
                        <button @click="familiarImport.confirmPreset=null" class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">取消</button>
                        <button @click="confirmImportFamiliarPreset" class="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">確認匯入</button>
                      </div>
                    </div>
                  </div>
                  <div v-if="!isEditMode">`;

if (html.indexOf('openFamiliarPresetPicker') === -1) {
  html = html.replace(oldFamOpen, newFamOpen);
}

fs.writeFileSync('v2/index.html', html);
console.log('patch_familiar_import.js applied');
