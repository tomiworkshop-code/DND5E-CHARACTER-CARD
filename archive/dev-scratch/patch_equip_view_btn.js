const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// Update Equipped View to add unequip button
const targetEqView = `<span class="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">x{{ item.qty || 1 }}</span>
                            </div>`;
const newEqView = `<div class="flex items-center gap-2">
                                <span class="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded">x{{ item.qty || 1 }}</span>
                                <button @click="toggleEquip(item)" class="text-[10px] bg-white text-gray-500 border border-gray-200 px-2 py-0.5 rounded hover:bg-gray-50 shadow-sm transition">卸下</button>
                              </div>
                            </div>`;
html = html.replace(targetEqView, newEqView);

// Update Backpack View to add equip button
const targetBpView = `<span class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">x{{ item.qty || 1 }}</span>
                            </div>`;
const newBpView = `<div class="flex items-center gap-2">
                                <span class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">x{{ item.qty || 1 }}</span>
                                <button @click="toggleEquip(item)" class="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-100 shadow-sm transition">裝備</button>
                              </div>
                            </div>`;
html = html.replace(targetBpView, newBpView);

fs.writeFileSync('v2/index.html', html);
