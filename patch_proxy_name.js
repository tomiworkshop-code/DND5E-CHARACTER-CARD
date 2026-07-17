const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// The error is "Cannot read properties of undefined (reading 'name')"
// Let's check where .name might be accessed on undefined.
// `item.name || item` handles string items, but what if item is completely undefined?
// `(item.name||item)` works if item is a string, but if item is undefined, `item.name` throws.
// Let's add a safe guard ? everywhere item is used.

html = html.replace(/item\.name/g, 'item?.name');
html = html.replace(/item\.desc/g, 'item?.desc');
html = html.replace(/item\.qty/g, 'item?.qty');
html = html.replace(/item\.equipped/g, 'item?.equipped');
html = html.replace(/item\.category/g, 'item?.category');

html = html.replace(/sp\.name_zh/g, 'sp?.name_zh');
html = html.replace(/sp\.name_en/g, 'sp?.name_en');
html = html.replace(/sp\.name/g, 'sp?.name');
html = html.replace(/sp\.level/g, 'sp?.level');

fs.writeFileSync('v2/index.html', html);
