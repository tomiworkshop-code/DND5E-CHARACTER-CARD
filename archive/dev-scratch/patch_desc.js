const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// The JSON uses "desc", not "desc_zh" or "desc_en".
html = html.replace(/{{ f\.desc_zh \|\| f\.desc_en }}/g, '{{ f.desc || f.desc_zh || f.desc_en }}');

// Use whitespace-pre-wrap to format newlines properly
html = html.replace(/<div class="text-xs text-gray-500">{{ f\.desc/g, '<div class="text-xs text-gray-500 whitespace-pre-wrap">{{ f.desc');

fs.writeFileSync('v2/index.html', html);
