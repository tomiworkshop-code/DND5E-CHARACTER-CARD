const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const oldSkills = `<!-- SKILLS 技能 -->
                <div v-if="activeModule === 'skills'" class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <div class="flex items-center gap-2">
                        <input type="checkbox" v-model="skData.proficient" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
                        <span class="text-sm font-medium text-gray-700">{{ skName }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-400">覆蓋</span>
                        <input type="number" v-model.number="skData.override" class="w-12 text-center text-xs border border-gray-300 rounded p-1" placeholder="無">
                      </div>
                    </div>
                  </div>
                </div>`;

const newSkills = `<!-- SKILLS 技能 -->
                <div v-if="activeModule === 'skills'" class="space-y-4">
                  <div v-if="!isEditMode">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="p-2 border rounded-lg flex items-center justify-between" :class="skData.proficient ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'">
                        <div class="flex items-center gap-2">
                          <span v-if="skData.proficient" class="text-blue-500">★</span>
                          <span v-else class="text-gray-300">☆</span>
                          <span class="text-sm" :class="skData.proficient ? 'font-bold text-blue-900' : 'text-gray-600'">{{ skName }}</span>
                        </div>
                        <div v-if="skData.override" class="text-xs font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">={{ skData.override }}</div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div v-for="(skData, skName) in selectedChar.skills" :key="skName" class="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <div class="flex items-center gap-2">
                        <input type="checkbox" v-model="skData.proficient" class="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
                        <span class="text-sm font-medium text-gray-700">{{ skName }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-400">覆蓋</span>
                        <input type="number" v-model.number="skData.override" class="w-12 text-center text-xs border border-gray-300 rounded p-1" placeholder="無">
                      </div>
                    </div>
                  </div>
                </div>`;

html = html.replace(oldSkills, newSkills);
fs.writeFileSync('v2/index.html', html);
