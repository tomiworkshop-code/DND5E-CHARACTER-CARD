const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('v2/index.html', 'utf8');

const dom = new JSDOM(html, { 
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + __dirname + '/v2/index.html',
  beforeParse(window) {
    window.fetch = async (url) => {
      let p = url.replace('../data/', 'data/');
      if (fs.existsSync(p)) {
        return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
      }
      return { ok: true, json: async () => ({}) };
    };
    window.console.error = (...args) => console.error('JSDOM ERROR:', ...args);
  }
});

setTimeout(() => {
  const errDiv = dom.window.document.querySelector('h1');
  if (errDiv && errDiv.textContent === 'VUE ERROR') {
    console.error("VUE INIT ERROR:", dom.window.document.body.textContent);
    return;
  }
  const btn = Array.from(dom.window.document.querySelectorAll('button')).find(b => b.textContent.includes('創建新角色'));
  if (btn) {
    btn.click();
    setTimeout(() => {
      const errDiv2 = dom.window.document.querySelector('h1');
      if (errDiv2 && errDiv2.textContent === 'VUE ERROR') {
        console.error("VUE CLICK ERROR:", dom.window.document.body.textContent);
      } else {
        console.log("No Vue errors. Current view title:", dom.window.document.querySelector('h2').textContent);
      }
    }, 500);
  }
}, 2000);
