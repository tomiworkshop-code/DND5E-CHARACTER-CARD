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
  const content = dom.window.document.body.innerHTML;
  if (content.includes('VUE ERROR')) {
    console.log(dom.window.document.body.textContent.trim());
  } else {
    console.log('No error overlay.');
  }
}, 3000);
