const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// There is a duplicate declaration!
// 1242:        const isWorldEditMode = ref(false);
// 1243:        const worldEditTemp = Vue.reactive({ name: '', location: '', time: '', quest: '' });
// 1244:        const isWorldEditMode = ref(false);
// 1245:        const worldEditTemp = Vue.reactive({ name: '', location: '', time: '', quest: '' });

const dupRegex = /const isWorldEditMode = ref\(false\);\s*const worldEditTemp = Vue\.reactive\(\{ name: '', location: '', time: '', quest: '' \}\);\s*const isWorldEditMode = ref\(false\);\s*const worldEditTemp = Vue\.reactive\(\{ name: '', location: '', time: '', quest: '' \}\);/g;

html = html.replace(dupRegex, `const isWorldEditMode = ref(false);\n        const worldEditTemp = Vue.reactive({ name: '', location: '', time: '', quest: '' });`);

// Build bump
html = html.replace(/Build 0717\.07/, "Build 0717.08");

fs.writeFileSync('v2/index.html', html);
