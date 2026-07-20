/* patch_app_version.js
 * App 版本標記同步：v2.0.0 → v2.1.0（技能專精 / 豁免檢定 / 魔寵匯入快取修正）。
 * 只動 v2/index.html 既有的兩處可見版本字樣，字串精確替換 + 冪等 guard。
 */
const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');
let changed = false;

const reps = [
  ['          v2.0.0 (Build 0717.24)\n', '          v2.1.0 (Build 0720.1)\n'],
  ['冒險者之書（5E）<span class="text-xs font-normal text-gray-400">v2.0.0</span>',
   '冒險者之書（5E）<span class="text-xs font-normal text-gray-400">v2.1.0</span>']
];

reps.forEach(([oldStr, newStr]) => {
  if (html.indexOf(oldStr) !== -1) { html = html.split(oldStr).join(newStr); changed = true; }
});

if (changed) {
  fs.writeFileSync('v2/index.html', html);
  console.log('patch_app_version.js applied (v2.0.0 -> v2.1.0)');
} else {
  console.log('patch_app_version.js: nothing to change (already v2.1.0?)');
}
