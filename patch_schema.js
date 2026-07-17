const fs = require('fs');
let js = fs.readFileSync('shared/character-schema.js', 'utf8');

// 1. Add uid fallback
js = js.replace(/function defaultChar\(\)\{/g, `function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  global.uid = global.uid || uid;

  function defaultChar(){`);

// 2. Safely check SKILLS
js = js.replace(/SKILLS\.forEach/g, `if (typeof SKILLS !== 'undefined' && Array.isArray(SKILLS)) SKILLS.forEach`);

fs.writeFileSync('shared/character-schema.js', js);
console.log('Patched schema JS');
