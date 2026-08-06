const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// Update UI generation in addCustomItem and addItem to properly format item info:
// For weapons/armor without description, we construct a descriptive string from metadata.
const targetAdd = `((itemData.damage ? itemData.damage.map(d => d.dice + ' ' + (d.type||'')).join(', ') : '') || itemData.desc_zh || itemData.desc || '')`;

const newAdd = `(
  (Array.isArray(itemData.entries_zh) && itemData.entries_zh.length > 0) ? itemData.entries_zh.join('\\n') : 
  ((Array.isArray(itemData.entries) && itemData.entries.length > 0) ? itemData.entries.join('\\n') : 
  (
    [
      itemData.category ? \`分類: \${itemData.category}\` : null,
      itemData.ac ? \`AC: \${itemData.ac}\` : null,
      itemData.damage ? \`傷害: \${itemData.damage.map(d => d.dice + ' ' + (d.type||'')).join(', ')}\` : null,
      itemData.properties && itemData.properties.length ? \`屬性: \${itemData.properties.join(', ')}\` : null,
      itemData.requires_attunement ? '⚠ 需要調諧' : null
    ].filter(Boolean).join(' | ') || itemData.desc_zh || itemData.desc || ''
  ))
)`;

// Note: Target is just the fallback part of the previous string
const fullTarget = `desc: (Array.isArray(itemData.entries_zh) && itemData.entries_zh.length > 0) ? itemData.entries_zh.join('\\n') : ((Array.isArray(itemData.entries) && itemData.entries.length > 0) ? itemData.entries.join('\\n') : ((itemData.damage ? itemData.damage.map(d => d.dice + ' ' + (d.type||'')).join(', ') : '') || itemData.desc_zh || itemData.desc || ''))`;

const fullNew = `desc: ${newAdd}`;

html = html.replace(fullTarget, fullNew);
fs.writeFileSync('v2/index.html', html);
