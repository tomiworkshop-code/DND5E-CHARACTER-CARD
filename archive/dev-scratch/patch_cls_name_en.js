const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// The only thing that hasn't been fixed with `?` is cls.name_en inside the v-model.
// Vue doesn't like optional chaining in v-model.
// Let's add a v-if to the entire select or ensure `cls` is always initialized.
// Looking at lines 473-475
html = html.replace(/<select v-model="cls\.name_en"/g, '<select v-if="cls" v-model="cls.name_en"');
// same for selectedChar.name etc
html = html.replace(/<input v-model="selectedChar\.name"/g, '<input v-if="selectedChar" v-model="selectedChar.name"');
html = html.replace(/<input type="text" v-model="selectedChar\.familiar\.name"/g, '<input v-if="selectedChar && selectedChar.familiar" type="text" v-model="selectedChar.familiar.name"');

fs.writeFileSync('v2/index.html', html);
