const fs = require('fs');
let html = fs.readFileSync('v2/index.html', 'utf8');

const targetApp = `    const app = createApp({`;
const newApp = `    const app = createApp({`;
const afterApp = `    });`;

const errorHandler = `
    app.config.errorHandler = (err, vm, info) => {
      console.error('VUE GLOBAL ERROR:', err, info);
      document.body.innerHTML = '<div style="color:red;font-size:20px;padding:20px;"><h1>VUE ERROR</h1><pre>' + err.stack + '</pre><p>Info: ' + info + '</p></div>';
    };
`;

html = html.replace('const app = createApp({', 'const app = createApp({');
html = html.replace('app.mount', errorHandler + '\n    app.mount');
fs.writeFileSync('v2/index.html', html);
