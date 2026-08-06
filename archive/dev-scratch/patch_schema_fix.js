const fs = require('fs');
let js = fs.readFileSync('shared/character-schema.js', 'utf8');

// I also need to make sure uid is defined for other usages inside character-schema.js if any, but defaultChar is the main one.
// Let's check where it throws.
