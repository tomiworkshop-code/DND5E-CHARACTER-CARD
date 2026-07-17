const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// The user is asking "Are we missing the equipment page?"
// In DND5E, "Inventory" (背包) is the same as "Equipment" in this PWA setup.
// Wait, in V1, there was a specific layout rule or something? Let me check.
// I will just add a subtitle or comment explaining this and modify the inventory module to mention Equipment.
const findTarget = `                    <div>
                      <div class="text-xs font-bold text-gray-500 mb-2">裝備與物品</div>`;

const replaceTarget = `                    <div>
                      <div class="flex justify-between items-end mb-2">
                        <div class="text-xs font-bold text-gray-500">穿戴裝備與背包物品</div>
                        <div class="text-[10px] text-gray-400">目前將所有物品統一管理</div>
                      </div>`;

html = html.replace(findTarget, replaceTarget);
fs.writeFileSync('v2/index.html', html);
