const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const oldClasses = `<!-- CLASSES 職業 -->
                <div v-if="activeModule === 'classes'" class="space-y-4">
                  <div v-for="(cls, idx) in (selectedChar.classes || [])" :key="idx" class="border border-gray-200 p-4 rounded-lg bg-gray-50">
                    <div class="grid grid-cols-2 gap-3 mb-2">
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">職業</label>
                        <select v-model="cls.name" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                          <option v-for="c in CLASSES" :key="c.name_zh" :value="c.name_zh">{{ c.name_zh }} ({{ c.name_en }})</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">等級</label>
                        <input type="number" v-model.number="cls.level" min="1" max="20" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-gray-500 mb-1">子職業 (可選)</label>
                      <input type="text" v-model="cls.subclass" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例如：生命領域">
                    </div>
                  </div>
                  <button @click="if(!selectedChar.classes) selectedChar.classes=[]; selectedChar.classes.push({name:'戰士', level:1, subclass:''})" class="w-full py-2 border border-dashed border-gray-300 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition">+ 新增兼職</button>
                </div>`;

const newClasses = `<!-- CLASSES 職業 -->
                <div v-if="activeModule === 'classes'" class="space-y-4">
                  <div v-if="!isEditMode" class="space-y-2">
                    <div v-if="!selectedChar.classes || selectedChar.classes.length === 0" class="text-gray-400 text-sm">無職業資料</div>
                    <div v-for="(cls, idx) in (selectedChar.classes || [])" :key="idx" class="flex justify-between items-center border-b border-gray-100 py-2">
                      <div>
                        <div class="font-bold text-gray-800">{{ cls.name }}</div>
                        <div class="text-xs text-gray-500">{{ cls.subclass || '無子職業' }}</div>
                      </div>
                      <div class="text-sm font-bold text-blue-600">Lv. {{ cls.level }}</div>
                    </div>
                  </div>
                  <div v-else class="space-y-4">
                    <div v-for="(cls, idx) in (selectedChar.classes || [])" :key="idx" class="border border-gray-200 p-4 rounded-lg bg-gray-50 relative">
                      <button @click="selectedChar.classes.splice(idx, 1)" class="absolute top-2 right-2 text-gray-400 hover:text-red-500">❌</button>
                      <div class="grid grid-cols-2 gap-3 mb-2">
                        <div>
                          <label class="block text-xs font-bold text-gray-500 mb-1">職業</label>
                          <select v-model="cls.name" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                            <option v-for="c in CLASSES" :key="c.name_zh" :value="c.name_zh">{{ c.name_zh }} ({{ c.name_en }})</option>
                          </select>
                        </div>
                        <div>
                          <label class="block text-xs font-bold text-gray-500 mb-1">等級</label>
                          <input type="number" v-model.number="cls.level" min="1" max="20" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                        </div>
                      </div>
                      <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">子職業 (可選)</label>
                        <input type="text" v-model="cls.subclass" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="例如：生命領域">
                      </div>
                    </div>
                    <button @click="if(!selectedChar.classes) selectedChar.classes=[]; selectedChar.classes.push({name:'戰士', level:1, subclass:''})" class="w-full py-2 border border-dashed border-gray-300 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition">+ 新增兼職</button>
                  </div>
                </div>`;

html = html.replace(oldClasses, newClasses);
fs.writeFileSync('v2/index.html', html);
