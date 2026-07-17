const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const watchFind = `        watch([isEditMode, activeModule, selectedChar], ([edit, mod, char]) => {
          if (edit && mod === 'skills' && char) {
            if (!char.skills) char.skills = {};
            coreRules.SKILLS.forEach(s => {
              if (!char.skills[s.zh]) char.skills[s.zh] = { proficient: false, override: null };
            });
          }`;

const watchReplace = `        watch([isEditMode, activeModule, selectedChar, () => coreRules.SKILLS], ([edit, mod, char, rulesSkills]) => {
          if (mod === 'skills' && char) {
            if (!char.skills) char.skills = {};
            if (rulesSkills && rulesSkills.length) {
              rulesSkills.forEach(s => {
                if (!char.skills[s.zh]) char.skills[s.zh] = { proficient: false, override: null };
              });
            }
          }`;

html = html.replace(watchFind, watchReplace);
fs.writeFileSync('v2/index.html', html);
