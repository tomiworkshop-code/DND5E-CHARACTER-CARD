const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const target = `<div v-if="selectedChar.familiar.skills && selectedChar.familiar.skills.length > 0" class="space-y-3">
                          <div v-for="(sk, i) in selectedChar.familiar.skills" :key="i" class="p-2 border border-blue-100 bg-blue-50/30 rounded-lg relative">
                            <button @click="selectedChar.familiar.skills.splice(i, 1)" class="absolute top-2 right-2 text-red-400 hover:text-red-600">✕</button>
                            <input type="text" v-model="sk.name" placeholder="技能名稱 (例如: 敏銳聽覺)" class="w-full mb-2 bg-transparent border-b border-blue-200 focus:border-blue-400 outline-none text-sm font-bold text-blue-900 pr-6">
                            <textarea v-model="sk.desc" rows="2" placeholder="技能描述..." class="w-full bg-white/50 border border-blue-100 rounded p-2 text-sm outline-none resize-none"></textarea>
                          </div>
                        </div>`;

const replacement = `<div v-if="selectedChar.familiar.skills && selectedChar.familiar.skills.length > 0" class="space-y-3">
                          <div v-for="(sk, i) in selectedChar.familiar.skills" :key="i" class="p-2 border border-blue-100 bg-blue-50/30 rounded-lg flex flex-col gap-2">
                            <div class="flex items-center gap-2">
                              <input type="text" v-model="sk.name" placeholder="技能名稱 (例如: 敏銳聽覺)" class="flex-1 bg-transparent border-b border-blue-200 focus:border-blue-400 outline-none text-sm font-bold text-blue-900 px-1 py-0.5">
                              <button @click="selectedChar.familiar.skills.splice(i, 1)" class="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded bg-red-50 shrink-0 border border-red-100">移除</button>
                            </div>
                            <textarea v-model="sk.desc" rows="2" placeholder="技能描述..." class="w-full bg-white/50 border border-blue-100 rounded p-2 text-sm outline-none resize-none"></textarea>
                          </div>
                        </div>`;

html = html.replace(target, replacement);
fs.writeFileSync('v2/index.html', html);
