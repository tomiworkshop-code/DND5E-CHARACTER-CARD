const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const oldInv = `<!-- INVENTORY 物品與背包 -->
                <div v-if="activeModule === 'inventory'" class="space-y-4">
                  <div class="grid grid-cols-4 gap-2">
                    <div v-for="c in ['cp','sp','gp','pp']" :key="c">
                      <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">{{c}}</label>
                      <input type="number" v-model.number="selectedChar.coins[c]" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-gray-500 mb-1">裝備與物品 (每行一項)</label>
                    <textarea :value="selectedChar.inventory.join('\\n')" @input="selectedChar.inventory = $event.target.value.split('\\n').filter(Boolean)" rows="6" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"></textarea>
                  </div>
                </div>`;

const newInv = `<!-- INVENTORY 物品與背包 -->
                <div v-if="activeModule === 'inventory'" class="space-y-4">
                  <div v-if="!isEditMode">
                    <div class="flex gap-4 mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100 justify-around">
                      <div v-for="c in ['cp','sp','gp','pp']" :key="c" class="text-center">
                        <div class="text-xs font-bold text-yellow-600 uppercase">{{ c }}</div>
                        <div class="font-bold text-gray-800">{{ selectedChar.coins[c] || 0 }}</div>
                      </div>
                    </div>
                    <div>
                      <div class="text-xs font-bold text-gray-500 mb-2">裝備與物品</div>
                      <ul class="list-disc pl-5 text-sm space-y-1">
                        <li v-for="(item, idx) in selectedChar.inventory" :key="idx">{{ item }}</li>
                        <li v-if="!selectedChar.inventory || selectedChar.inventory.length === 0" class="text-gray-400 list-none -ml-5">背包空空如也</li>
                      </ul>
                    </div>
                  </div>
                  <div v-else class="space-y-4">
                    <div class="grid grid-cols-4 gap-2">
                      <div v-for="c in ['cp','sp','gp','pp']" :key="c">
                        <label class="block text-xs font-bold text-gray-500 mb-1 uppercase">{{c}}</label>
                        <input type="number" v-model.number="selectedChar.coins[c]" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none">
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-gray-500 mb-1">裝備與物品 (每行一項)</label>
                      <textarea :value="(selectedChar.inventory||[]).join('\\n')" @input="selectedChar.inventory = $event.target.value.split('\\n').filter(Boolean)" rows="6" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"></textarea>
                    </div>
                  </div>
                </div>`;

html = html.replace(oldInv, newInv);
fs.writeFileSync('v2/index.html', html);
