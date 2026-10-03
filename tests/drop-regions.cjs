const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
 try {
  const page = await browser.newPage({ viewport: {width:1366,height:768} });
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  for (const game of ['garden','fruit']) {
   for (const [x,y] of [[.5,.15],[.15,.5],[.85,.5],[.5,.5],[.5,.85]]) {
    await page.locator('[data-game="'+game+'"]').click();
    if(game==='garden') await page.locator('[data-garden-step="3"]').click();
    const source = page.locator(game==='garden'?'#garden-can':'.fruit-item');
    const target = page.locator(game==='garden'?'[data-plant="0"]':'#basket');
    const a=await source.boundingBox(),b=await target.boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
    await page.mouse.down();
    await page.mouse.move(b.x+b.width*x,b.y+b.height*y,{steps:8});
    assert.ok(await target.evaluate((el, cls)=>el.classList.contains(cls), game==='garden'?'is-over':'is-target'), game+' must highlight at '+x+','+y);
    assert.equal(await page.locator(game==='garden'?'.garden-plant.is-done':'.fruit-item.correct').count(),0,'Holding alone must not finish');
    await page.mouse.up();
    assert.equal(await page.locator(game==='garden'?'.garden-plant.is-done':'.fruit-item.correct').count(),1,game+' must accept release at '+x+','+y);
    await page.locator('#'+game+'-screen [data-home]').click();
   }
  }
  console.log('PASS: both games accept upper, middle, lower, left and right target regions; require release.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
