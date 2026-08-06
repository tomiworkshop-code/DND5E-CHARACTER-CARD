const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('v2/index.html', 'utf8');

const dom = new JSDOM(html, { 
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + __dirname + '/v2/index.html',
  beforeParse(window) {
    window.fetch = async () => ({ ok: true, json: async () => ({}) });
  }
});

setTimeout(() => {
  const btn = Array.from(dom.window.document.querySelectorAll('button')).find(b => b.textContent.includes('創建新角色'));
  if (btn) {
    btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    setTimeout(() => {
      console.log('Current View:', dom.window.document.querySelector('h2')?.textContent);
    }, 500);
  }
}, 2000);
