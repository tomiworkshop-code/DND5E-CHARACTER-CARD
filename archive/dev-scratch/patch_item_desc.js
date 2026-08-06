const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetAdd = `desc: Array.isArray(itemData.entries_zh) ? itemData.entries_zh.join('\\n') : (Array.isArray(itemData.entries) ? itemData.entries.join('\\n') : (itemData.desc_zh || itemData.desc || ''))`;
const newAdd = `desc: (Array.isArray(itemData.entries_zh) && itemData.entries_zh.length > 0) ? itemData.entries_zh.join('\\n') : ((Array.isArray(itemData.entries) && itemData.entries.length > 0) ? itemData.entries.join('\\n') : ((itemData.damage ? itemData.damage.map(d => d.dice + ' ' + (d.type||'')).join(', ') : '') || itemData.desc_zh || itemData.desc || ''))`;

html = html.replace(targetAdd, newAdd);
fs.writeFileSync('v2/index.html', html);
