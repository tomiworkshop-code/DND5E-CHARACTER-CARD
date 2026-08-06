const fs = require('fs');

// 1. Update shared/character-schema.js
let schema = fs.readFileSync('shared/character-schema.js', 'utf8');

schema = schema.replace(/const SCHEMA_VERSION = \d+;/, 'const SCHEMA_VERSION = 5;');
schema = schema.replace(/"feats","familiar"/, '"feats","familiars"');
schema = schema.replace(/"familiar","background","abilities"/, '"familiars","background","abilities"');

schema = schema.replace(/familiar: null,/, 'familiars: [],');

const oldMergeFamiliar = `      } else if(k==="familiar"){
        if(saved.familiar && typeof saved.familiar === "object"){
          const f = defaultFamiliar();
          for(const fk in saved.familiar){
            if(fk==="hp" || fk==="abilities"){ f[fk] = Object.assign(f[fk]||{}, saved.familiar[fk]); }
            else { f[fk] = saved.familiar[fk]; }
          }
          out.familiar = f;
        } else { out.familiar = null; }`;

const newMergeFamiliar = `      } else if(k==="familiars"){
        if(Array.isArray(saved.familiars)){
          out.familiars = saved.familiars.map(fam => {
            const f = defaultFamiliar();
            for(const fk in fam){
              if(fk==="hp" || fk==="abilities"){ f[fk] = Object.assign(f[fk]||{}, fam[fk]); }
              else { f[fk] = fam[fk]; }
            }
            return f;
          });
        }
      } else if(k==="familiar"){ // V4 migration
        if(saved.familiar && typeof saved.familiar === "object" && Object.keys(saved.familiar).length > 0){
           const f = defaultFamiliar();
           for(const fk in saved.familiar){
             if(fk==="hp" || fk==="abilities"){ f[fk] = Object.assign(f[fk]||{}, saved.familiar[fk]); }
             else { f[fk] = saved.familiar[fk]; }
           }
           if (f.name || f.type || f.ac !== 10 || (f.hp && f.hp.max > 1)) {
              if (!out.familiars) out.familiars = [];
              out.familiars.push(f);
           }
        }`;

schema = schema.replace(oldMergeFamiliar, newMergeFamiliar);
fs.writeFileSync('shared/character-schema.js', schema);

// 2. Update shared/store.js
let store = fs.readFileSync('shared/store.js', 'utf8');
store = store.replace(/familiar: ch\.familiar \? \{\s*speed: ch\.familiar\.speed,\s*ac: ch\.familiar\.ac,\s*hp: ch\.familiar\.hp,\s*abilities: ch\.familiar\.abilities,\s*attacks: ch\.familiar\.attacks\s*\} : null/g, 
  `familiars: (ch.familiars || []).map(function(f) { return { speed: f.speed, ac: f.ac, hp: f.hp, abilities: f.abilities, attacks: f.attacks, senses: f.senses, resistances: f.resistances, skills: f.skills }; })`);

store = store.replace(/familiar: ch\.familiar \? \{\s*name: ch\.familiar\.name,\s*type: ch\.familiar\.type,\s*notes: ch\.familiar\.notes\s*\} : null/g, 
  `familiars: (ch.familiars || []).map(function(f) { return { name: f.name, type: f.type, notes: f.notes, story: f.story }; })`);

const oldStoreCompose = `    if (identity.identity.familiar || instance.mechanical.familiar || instance.narrative.familiar) {
      c.familiar = C.defaultFamiliar();
      if (instance.narrative.familiar) c.familiar = C.mergeChar(c.familiar, instance.narrative.familiar);
      if (instance.mechanical.familiar) c.familiar = C.mergeChar(c.familiar, instance.mechanical.familiar);
    }`;

const newStoreCompose = `    c.familiars = [];
    var maxLen = Math.max((identity.identity.familiars || []).length, (instance.mechanical.familiars || []).length, (instance.narrative.familiars || []).length);
    for (var i=0; i<maxLen; i++) {
       var f = C.defaultFamiliar();
       if (instance.narrative.familiars && instance.narrative.familiars[i]) f = C.mergeChar(f, instance.narrative.familiars[i]);
       if (instance.mechanical.familiars && instance.mechanical.familiars[i]) f = C.mergeChar(f, instance.mechanical.familiars[i]);
       c.familiars.push(f);
    }`;

store = store.replace(oldStoreCompose, newStoreCompose);

store = store.replace(/instance\.narrative\.familiar\)/g, 'instance.narrative.familiars)');

fs.writeFileSync('shared/store.js', store);
console.log('Schema and Store patched.');
