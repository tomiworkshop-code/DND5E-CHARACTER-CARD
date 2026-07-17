const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetReturnBlock = /activeModule,\s*isEditMode,\s*availableSpells,\s*newSpellQuery,\s*spellFilterLevel,\s*filteredAvailableSpells,/;

const replacement = `activeModule,
          isEditMode, isWorldEditMode, worldEditTemp, activeRecordTab, newRecordText, recordTabs, startWorldEdit, saveWorldEdit, addWorldRecord, removeWorldRecord, availableSpells,
          newSpellQuery,
          spellFilterLevel,
          filteredAvailableSpells,`;

html = html.replace(targetReturnBlock, replacement);

// Build bump
html = html.replace(/Build 0717\.08/, "Build 0717.09");

fs.writeFileSync('v2/index.html', html);
console.log('Patched returns');
