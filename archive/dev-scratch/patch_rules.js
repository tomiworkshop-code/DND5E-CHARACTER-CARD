const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

// remove inline constants
const lines = html.split('\n');
const startIdx = lines.findIndex(l => l.includes('const CLASSES = ['));
const endIdx = lines.findIndex(l => l.includes('const BACKGROUNDS = ['));
// Actually find the end of BACKGROUNDS array
let realEndIdx = endIdx;
while(realEndIdx < lines.length && !lines[realEndIdx].includes('];')) {
    realEndIdx++;
}
realEndIdx++; // include the '];' line

lines.splice(startIdx, realEndIdx - startIdx);
html = lines.join('\n');

// inject fetch logic and reactive states for rules
const setupTarget = `      setup() {`;
const setupReplacement = `      setup() {
        const coreRules = Vue.reactive({ CLASSES:[], SKILLS:[], CONDITIONS:[], COMMON_LANGUAGES:[], ARMOR_OPTIONS:[], WEAPON_OPTIONS:[], TOOL_OPTIONS:[], RACES:[], ALIGNMENTS:[], BACKGROUNDS:[] });
        
        Vue.onMounted(async () => {
          try {
            const res = await fetch('../data/core-rules.json');
            if(res.ok) {
              const data = await res.json();
              Object.assign(coreRules, data);
            }
          } catch(e) { console.error('Failed to load core-rules.json', e); }
        });`;
html = html.replace(setupTarget, setupReplacement);

// replace returned constants with computed properties
const retTarget = `          selectedWorldKey,
          CLASSES,
          SKILLS,
          CONDITIONS,
          COMMON_LANGUAGES,
          ARMOR_OPTIONS,
          WEAPON_OPTIONS,
          TOOL_OPTIONS,
          RACES,
          ALIGNMENTS,
          BACKGROUNDS,
          activeModule,`;

const retReplacement = `          selectedWorldKey,
          CLASSES: Vue.computed(() => coreRules.CLASSES),
          SKILLS: Vue.computed(() => coreRules.SKILLS),
          CONDITIONS: Vue.computed(() => coreRules.CONDITIONS),
          COMMON_LANGUAGES: Vue.computed(() => coreRules.COMMON_LANGUAGES),
          ARMOR_OPTIONS: Vue.computed(() => coreRules.ARMOR_OPTIONS),
          WEAPON_OPTIONS: Vue.computed(() => coreRules.WEAPON_OPTIONS),
          TOOL_OPTIONS: Vue.computed(() => coreRules.TOOL_OPTIONS),
          RACES: Vue.computed(() => coreRules.RACES),
          ALIGNMENTS: Vue.computed(() => coreRules.ALIGNMENTS),
          BACKGROUNDS: Vue.computed(() => coreRules.BACKGROUNDS),
          activeModule,`;
html = html.replace(retTarget, retReplacement);

// Fix v-model issue with subclassDef
html = html.replace(/CLASSES\.find/g, 'CLASSES.value.find');

fs.writeFileSync('v2/index.html', html);
