const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// We will replace specific known patterns that read `.name` in the template
// to use `?.name` instead.

// selectedChar.name -> selectedChar?.name
html = html.replace(/selectedChar\.name/g, 'selectedChar?.name');

// ch.name -> ch?.name
html = html.replace(/ch\.name/g, 'ch?.name');

// progress.name -> progress?.name
html = html.replace(/progress\.name/g, 'progress?.name');

// c.name -> c?.name
html = html.replace(/c=>c\.name/g, 'c=>c?.name');

// r.name -> r?.name
html = html.replace(/r\.name/g, 'r?.name');

// b.name -> b?.name
html = html.replace(/b\.name/g, 'b?.name');

// f.name -> f?.name
html = html.replace(/f\.name/g, 'f?.name');

// sc.name -> sc?.name
html = html.replace(/sc\.name/g, 'sc?.name');

// spell.name -> spell?.name
html = html.replace(/spell\.name/g, 'spell?.name');

// selectedChar.familiar.name -> selectedChar.familiar?.name
html = html.replace(/selectedChar\.familiar\.name/g, 'selectedChar.familiar?.name');

// Fix v-models that we just broke
html = html.replace(/v-model="selectedChar\?\.name"/g, 'v-model="selectedChar.name"');
html = html.replace(/v-model="selectedChar\.familiar\?\.name"/g, 'v-model="selectedChar.familiar.name"');

// Write back
fs.writeFileSync('v2/index.html', html);
