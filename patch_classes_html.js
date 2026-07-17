const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetClassesBlock = `                <!-- CLASSES 職業 -->
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

const newClassesBlock = `                <!-- CLASSES 職業 -->
                <div v-if="activeModule === 'classes'" class="space-y-4">
                  <div v-if="!isEditMode" class="space-y-2">
                    <div v-if="!selectedChar.classes || selectedChar.classes.length === 0" class="text-gray-400 text-sm">無職業資料</div>
                    <div v-for="(cls, idx) in (selectedChar.classes || [])" :key="idx" class="flex justify-between items-center border-b border-gray-100 py-2">
                      <div>
                        <div class="font-bold text-gray-800">{{ getClassName(cls) || '未知職業' }}</div>
                        <div class="text-xs text-gray-500">{{ getSubclassName(cls) || '無子職業' }}</div>
                      </div>
                      <div class="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Lv {{ cls.level || 0 }}</div>
                    </div>
                  </div>
                  <div v-else class="space-y-4">
                    <div v-for="(cls, idx) in (selectedChar.classes || [])" :key="idx" class="border border-gray-200 p-4 rounded-lg bg-gray-50 relative">
                      <button @click="selectedChar.classes.splice(idx, 1)" class="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                      <div class="grid grid-cols-2 gap-3 mb-2 pr-6">
                        <div>
                          <label class="block text-xs font-bold text-gray-500 mb-1">職業</label>
                          <select v-model="cls.name_en" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                            <option v-for="c in CLASSES" :key="c.name_en" :value="c.name_en">{{ c.name_zh }} ({{ c.name_en }})</option>
                          </select>
                        </div>
                        <div>
                          <label class="block text-xs font-bold text-gray-500 mb-1">等級</label>
                          <input type="number" v-model.number="cls.level" min="1" max="20" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                        </div>
                      </div>
                      
                      <div class="mt-3 pt-3 border-t border-gray-200 border-dashed" v-if="subclassDef(cls)">
                        <div class="flex items-center gap-2 mb-1">
                          <label class="block text-xs font-bold text-gray-500">{{ subclassDef(cls).label }}</label>
                          <span v-if="(Number(cls.level)||0) < subclassDef(cls).level" class="text-[10px] text-gray-400 font-normal">達 {{ subclassDef(cls).level }} 級後可選擇</span>
                        </div>
                        <select v-model="cls.subclass" :disabled="(Number(cls.level)||0) < subclassDef(cls).level" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white disabled:bg-gray-100 disabled:text-gray-400">
                          <option value="">— 未選擇 —</option>
                          <option v-for="sc in subclassDef(cls).list" :key="sc.name_en" :value="sc.name_en">{{ sc.name_zh }}</option>
                        </select>
                        <div v-if="selectedSubclassDesc(cls)" class="text-[11px] text-gray-500 mt-1.5 leading-snug bg-white p-2 rounded border border-gray-100">
                          {{ selectedSubclassDesc(cls) }}
                        </div>
                      </div>
                    </div>
                    <button @click="if(!selectedChar.classes) selectedChar.classes=[]; selectedChar.classes.push({name_en:'Fighter', level:1, subclass:''})" class="w-full py-2 border border-dashed border-gray-300 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition">+ 新增兼職</button>
                  </div>
                </div>`;

html = html.replace(targetClassesBlock, newClassesBlock);
fs.writeFileSync('v2/index.html', html);
