const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetAddSpell = `desc: Array.isArray(sp.entries_zh) ? sp.entries_zh.join('\\n') : (Array.isArray(sp.entries) ? sp.entries.join('\\n') : (sp.desc_zh || sp.desc_en || sp.desc || ''))`;

const newAddSpell = `desc: (
  [
    sp.school ? \`學派: \${sp.school}\` : null,
    sp.time && sp.time.length ? \`施法時間: \${sp.time.map(t => t.number + ' ' + t.unit).join(', ')}\` : null,
    sp.range && sp.range.distance ? \`射程: \${sp.range.distance.amount || ''} \${sp.range.distance.type || ''}\` : null,
    sp.components ? \`成分: \${Object.keys(sp.components).filter(k=>sp.components[k]).join(', ').toUpperCase()}\` : null,
    sp.duration && sp.duration.length ? \`持續: \${sp.duration.map(d => d.type === 'instant' ? '瞬間' : (d.duration ? d.duration.amount + ' ' + d.duration.type : d.type)).join(', ')}\` : null,
    sp.ritual ? '【儀式】' : null
  ].filter(Boolean).join(' | ') + 
  '\\n\\n' +
  (Array.isArray(sp.entries_zh) ? sp.entries_zh.join('\\n') : (Array.isArray(sp.entries) ? sp.entries.join('\\n') : (sp.desc_zh || sp.desc_en || sp.desc || '')))
).trim()`;

html = html.replace(targetAddSpell, newAddSpell);
fs.writeFileSync('v2/index.html', html);
