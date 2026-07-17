const fs = require('fs');
let content = fs.readFileSync('v2/index.html', 'utf8');

const target = `              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-gray-500 mb-1">種族</label>
                  <input v-model="selectedChar.race" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none">
                </div>
                <div>
                  <label class="block text-xs font-bold text-gray-500 mb-1">陣營</label>
                  <input v-model="selectedChar.alignment" type="text" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none">
                </div>
              </div>`;

const replacement = `              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-bold text-gray-500 mb-1">種族</label>
                  <select v-model="selectedChar.race" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none bg-white">
                    <option v-for="r in RACES" :key="r.name" :value="r.name">{{ r.name }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-gray-500 mb-1">陣營</label>
                  <select v-model="selectedChar.alignment" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none bg-white">
                    <option v-for="a in ALIGNMENTS" :key="a" :value="a">{{ a }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-gray-500 mb-1">背景</label>
                  <select v-model="selectedChar.background" class="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none bg-white">
                    <option v-for="b in BACKGROUNDS" :key="b.name" :value="b.name">{{ b.name }}</option>
                  </select>
                </div>
              </div>`;

content = content.replace(target, replacement);
fs.writeFileSync('v2/index.html', content);
