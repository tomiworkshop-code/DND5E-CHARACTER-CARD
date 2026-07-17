const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetView = `<div class="flex gap-4">
                        <div><span class="text-xs text-gray-500">AC</span> <span class="font-bold">{{ selectedChar.familiar.ac || 10 }}</span></div>
                        <div><span class="text-xs text-gray-500">速度</span> <span class="font-bold">{{ selectedChar.familiar.speed || '-' }}</span></div>
                      </div>
                      
                      <div v-if="selectedChar.familiar.story" class="bg-gray-50 p-3 rounded-lg border border-gray-100">`;

const replaceView = `<div class="flex gap-4">
                        <div><span class="text-xs text-gray-500">AC</span> <span class="font-bold">{{ selectedChar.familiar.ac || 10 }}</span></div>
                        <div><span class="text-xs text-gray-500">速度</span> <span class="font-bold">{{ selectedChar.familiar.speed || '-' }}</span></div>
                      </div>
                      <div class="flex flex-col gap-1 mt-1">
                        <div v-if="selectedChar.familiar.senses"><span class="text-xs text-gray-500">感官</span> <span class="text-sm">{{ selectedChar.familiar.senses }}</span></div>
                        <div v-if="selectedChar.familiar.resistances"><span class="text-xs text-gray-500">抗性/免疫</span> <span class="text-sm">{{ selectedChar.familiar.resistances }}</span></div>
                      </div>
                      
                      <div v-if="selectedChar.familiar.abilities" class="grid grid-cols-6 gap-1 mt-2">
                        <div v-for="stat in ['str','dex','con','int','wis','cha']" :key="stat" class="bg-gray-50 border border-gray-200 rounded text-center py-1">
                          <div class="text-[9px] text-gray-400 uppercase font-bold">{{ stat }}</div>
                          <div class="text-sm font-bold">{{ selectedChar.familiar.abilities[stat] || 10 }}</div>
                          <div class="text-[10px] text-gray-500">{{ Math.floor(((selectedChar.familiar.abilities[stat] || 10) - 10) / 2) >= 0 ? '+' : '' }}{{ Math.floor(((selectedChar.familiar.abilities[stat] || 10) - 10) / 2) }}</div>
                        </div>
                      </div>
                      
                      <div v-if="selectedChar.familiar.story" class="bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">`;

const targetEditInit = `<button @click="selectedChar.familiar = {name:'', type:'', speed:'', ac:10, hp:{current:1, max:1}, abilities:{str:10, dex:10, con:10, int:10, wis:10, cha:10}, story:'', skills:[{name:'', desc:''}]}"`;
const replaceEditInit = `<button @click="selectedChar.familiar = {name:'', type:'', speed:'', ac:10, hp:{current:1, max:1}, abilities:{str:10, dex:10, con:10, int:10, wis:10, cha:10}, senses:'', resistances:'', story:'', skills:[], attacks:[]}"`;

const targetEditInput = `<div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">速度</label>
                        <input type="text" v-model="selectedChar.familiar.speed" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none" placeholder="例如: 30呎, 飛行60呎">
                      </div>

                      <div class="border-t pt-3 mt-2">`;

const replaceEditInput = `<div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">速度</label>
                        <input type="text" v-model="selectedChar.familiar.speed" class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none" placeholder="例如: 30呎, 飛行60呎">
                      </div>
                      
                      <div class="border-t pt-3 mt-2">
                        <label class="block text-xs font-bold text-gray-500 mb-2">能力值 (Ability Scores)</label>
                        <div class="grid grid-cols-6 gap-1">
                          <div v-for="stat in ['str','dex','con','int','wis','cha']" :key="stat">
                            <div class="text-[10px] text-center text-gray-500 uppercase mb-1">{{stat}}</div>
                            <input type="number" v-if="selectedChar.familiar.abilities" v-model.number="selectedChar.familiar.abilities[stat]" class="w-full border border-gray-300 rounded p-1 text-center text-sm outline-none">
                          </div>
                        </div>
                      </div>
                      
                      <div class="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <label class="block text-xs font-bold text-gray-500 mb-1">感官能力 (Senses)</label>
                          <input type="text" v-model="selectedChar.familiar.senses" placeholder="被動察覺 13..." class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none">
                        </div>
                        <div>
                          <label class="block text-xs font-bold text-gray-500 mb-1">抗性/免疫</label>
                          <input type="text" v-model="selectedChar.familiar.resistances" placeholder="毒素免疫..." class="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none">
                        </div>
                      </div>

                      <div class="border-t pt-3 mt-2">`;

const targetSkillEnd = `</div>
                        <div v-else class="text-xs text-gray-400 text-center py-2 italic">目前沒有技能</div>
                      </div>
                    </div>`;

const replaceSkillEnd = `</div>
                        <div v-else class="text-xs text-gray-400 text-center py-2 italic">目前沒有技能</div>
                      </div>
                      
                      <div class="border-t pt-3 mt-2">
                        <div class="flex justify-between items-center mb-2">
                          <label class="block text-xs font-bold text-gray-500">動作與攻擊 (Actions)</label>
                          <button @click="if(!selectedChar.familiar.attacks) selectedChar.familiar.attacks=[]; selectedChar.familiar.attacks.push({name:'', hit:'', dmg:'', desc:''})" class="text-xs text-red-600 bg-red-50 px-2 py-1 rounded hover:bg-red-100">+ 新增動作</button>
                        </div>
                        <div v-if="selectedChar.familiar.attacks && selectedChar.familiar.attacks.length > 0" class="space-y-3">
                          <div v-for="(atk, i) in selectedChar.familiar.attacks" :key="i" class="p-2 border border-red-100 bg-red-50/30 rounded-lg flex flex-col gap-2">
                            <div class="flex items-center gap-2">
                              <input type="text" v-model="atk.name" placeholder="動作名稱" class="w-1/3 bg-transparent border-b border-red-200 focus:border-red-400 outline-none text-sm font-bold text-red-900 px-1 py-0.5">
                              <input type="text" v-model="atk.hit" placeholder="命中(例: +4)" class="w-1/4 bg-transparent border-b border-red-200 focus:border-red-400 outline-none text-sm text-red-900 px-1 py-0.5">
                              <input type="text" v-model="atk.dmg" placeholder="傷害(例: 1d4+2)" class="flex-1 bg-transparent border-b border-red-200 focus:border-red-400 outline-none text-sm text-red-900 px-1 py-0.5">
                              <button @click="selectedChar.familiar.attacks.splice(i, 1)" class="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded bg-red-100 shrink-0 border border-red-200">移除</button>
                            </div>
                            <textarea v-model="atk.desc" rows="2" placeholder="動作描述或附帶效果..." class="w-full bg-white/50 border border-red-100 rounded p-2 text-sm outline-none resize-none"></textarea>
                          </div>
                        </div>
                        <div v-else class="text-xs text-gray-400 text-center py-2 italic">目前沒有動作或攻擊</div>
                      </div>
                    </div>`;

const targetSkillViewEnd = `<div v-for="(sk, i) in selectedChar.familiar.skills" :key="i" class="bg-blue-50/50 p-2 rounded border border-blue-100">
                            <div class="font-bold text-sm text-blue-900">{{ sk.name }}</div>
                            <div class="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{{ sk.desc }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>`;

const replaceSkillViewEnd = `<div v-for="(sk, i) in selectedChar.familiar.skills" :key="i" class="bg-blue-50/50 p-2 rounded border border-blue-100">
                            <div class="font-bold text-sm text-blue-900">{{ sk.name }}</div>
                            <div class="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{{ sk.desc }}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div v-if="selectedChar.familiar.attacks && selectedChar.familiar.attacks.length > 0">
                        <div class="text-xs font-bold text-gray-500 mt-3 mb-2">⚔️ 動作與攻擊</div>
                        <div class="space-y-2">
                          <div v-for="(atk, i) in selectedChar.familiar.attacks" :key="i" class="bg-red-50/50 p-2 rounded border border-red-100">
                            <div class="font-bold text-sm text-red-900 flex justify-between">
                              <span>{{ atk.name }}</span>
                              <span v-if="atk.hit || atk.dmg" class="text-[10px] bg-red-100 px-1 py-0.5 rounded">{{ atk.hit }} {{ atk.hit && atk.dmg ? '|' : '' }} {{ atk.dmg }}</span>
                            </div>
                            <div v-if="atk.desc" class="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{{ atk.desc }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>`;

html = html.replace(targetView, replaceView);
html = html.replace(targetEditInit, replaceEditInit);
html = html.replace(targetEditInput, replaceEditInput);
html = html.replace(targetSkillEnd, replaceSkillEnd);
html = html.replace(targetSkillViewEnd, replaceSkillViewEnd);

fs.writeFileSync('v2/index.html', html);
