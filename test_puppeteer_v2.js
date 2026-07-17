const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/usr/bin/google-chrome-stable'
  }).catch(() => puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }));
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.toString());
  });

  await page.goto(`file://${__dirname}/v2/index.html`, { waitUntil: 'networkidle0' });
  
  setTimeout(async () => {
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    if (bodyHTML.includes('VUE ERROR')) {
      const errText = await page.evaluate(() => document.body.textContent);
      console.log('CRASH DOM:', errText.trim());
    } else {
      console.log('App loaded fine in Puppeteer.');
    }
    await browser.close();
  }, 1000);
})();
