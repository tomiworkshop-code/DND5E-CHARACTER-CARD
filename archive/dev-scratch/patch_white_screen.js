const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// Fix `CLASSES.value` issue in subclassDef, selectedSubclassDesc, getClassName, getSubclassName 
// since CLASSES is a computed property, we need to access its value inside the setup function correctly.
// However, since it's used inside the template, we should provide the raw reactive object or handle it gracefully.
// Actually, in the template, we call subclassDef(cls), which runs inside the setup scope.

html = html.replace(/const def = CLASSES\.value\.find/g, 'const def = (coreRules.CLASSES || []).find');

fs.writeFileSync('v2/index.html', html);
