const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const root = process.cwd();
const out = path.join(root, 'qa-results');
const routes = [
  ['homepage', '/index.html'],
  ['general-pediatrics', '/general-pediatrics/index.html'],
  ['growth', '/growth-hormone/index.html'],
  ['doctor', '/doctor/index.html'],
  ['contact', '/contact/index.html'],
  ['privacy', '/privacy/index.html'],
];
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-375', width: 375, height: 812 },
];
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };

async function audit(page) {
  return page.evaluate(() => {
    const rect = e => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height, right: r.right, bottom: r.bottom + window.scrollY };
    };
    const visible = e => {
      const s = getComputedStyle(e);
      return e.getClientRects().length && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0;
    };
    const label = e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().replace(/\s+/g, '.') : '');
    const headings = [...document.querySelectorAll('main h1,main h2,main h3')].filter(visible).map(e => {
      const s = getComputedStyle(e);
      return { element: label(e), text: e.textContent.trim(), rect: rect(e), font: s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight, marginTop: s.marginTop, marginBottom: s.marginBottom };
    });
    const paragraphs = [...document.querySelectorAll('main p,main blockquote,main dt,main dd')].filter(visible).map(e => {
      const s = getComputedStyle(e);
      return { element: label(e), text: e.textContent.trim().slice(0,90), rect: rect(e), fontSize: s.fontSize, lineHeight: s.lineHeight, marginTop: s.marginTop, marginBottom: s.marginBottom };
    });
    const overflow = [...document.querySelectorAll('main h1,main h2,main h3,main p,main blockquote,main dt,main dd,main figure,main .button,main svg,footer')].filter(visible).filter(e => {
      const r = e.getBoundingClientRect();
      return r.left < -1 || r.right > window.innerWidth + 1;
    }).map(e => ({ element: label(e), text: e.textContent.trim().slice(0,70), rect: rect(e) }));
    const overlaps = [];
    for (const h of document.querySelectorAll('main h1,main h2,main h3')) {
      if (!visible(h)) continue;
      const next = h.nextElementSibling;
      if (!next || !visible(next)) continue;
      const a = h.getBoundingClientRect(), b = next.getBoundingClientRect();
      if (Math.min(a.right,b.right) > Math.max(a.left,b.left) + 1 && b.top < a.bottom - 1 && b.bottom > a.top + 1) {
        overlaps.push({ heading: h.textContent.trim(), next: label(next), amount: a.bottom - b.top });
      }
    }
    const markers = [...document.querySelectorAll('.doctor-story-text,.growth-bring-copy h2,.section-intro h2,.knowledge-head h2')].map(e => ({ element: label(e), rect: rect(e), before: (()=> {const s=getComputedStyle(e,'::before'); return { content:s.content, position:s.position, height:s.height, marginBottom:s.marginBottom };})(), after: (()=> {const s=getComputedStyle(e,'::after'); return { content:s.content, position:s.position, height:s.height, marginTop:s.marginTop, top:s.top };})() }));
    const mark = document.querySelector('.growth-trend-mark');
    const trend = mark ? { group:rect(mark), parent:rect(mark.parentElement), svg:rect(mark.querySelector('svg')), text:rect(mark.querySelector('p')), circles:[...mark.querySelectorAll('circle')].map(e=>rect(e)), oldDot:getComputedStyle(mark.parentElement,'::after').content, transforms:[...mark.querySelectorAll('*')].map(e=>getComputedStyle(e).transform).filter(v=>v!=='none') } : null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      fontReady: document.fonts.status === 'loaded' && document.fonts.check('400 16px "IBM Plex Sans Thai"','เติบโตคลินิก') && document.fonts.check('600 16px "IBM Plex Sans Thai"','การเจริญเติบโต'),
      headings, paragraphs, overflow, overlaps, markers, trend,
      images: [...document.images].filter(e=>!e.closest('[hidden]')).map(e=>({src:e.currentSrc,complete:e.complete,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight})),
      sections: [...document.querySelectorAll('main > section')].map(e=>({element:label(e),rect:rect(e),paddingTop:getComputedStyle(e).paddingTop,paddingBottom:getComputedStyle(e).paddingBottom})),
    };
  });
}

(async () => {
  await fs.mkdir(out, {recursive:true});
  const server = http.createServer(async (req,res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filename = path.resolve(root, '.' + pathname);
      if (!filename.startsWith(root + path.sep)) {res.writeHead(403);res.end();return;}
      const bytes = await fs.readFile(filename);
      res.writeHead(200, {'Content-Type':mime[path.extname(filename)]||'application/octet-stream'});res.end(bytes);
    } catch {res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
  let browser;
  const results = [];
  let failed = false;
  try {
    browser = await chromium.launch({headless:true});
    for (const viewport of viewports) {
      const context = await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,isMobile:viewport.width<600,hasTouch:viewport.width<600});
      for (const [name,route] of routes) {
        const page = await context.newPage();
        const errors = [], failedRequests = [], badResponses = [];
        page.on('pageerror', e=>errors.push(e.message));
        page.on('console', m=> {if(m.type()==='error') errors.push(m.text());});
        page.on('requestfailed', r=>failedRequests.push({url:r.url(),failure:r.failure()}));
        page.on('response', r=> {if(r.status()>=400 && !r.url().endsWith('/favicon.ico')) badResponses.push({url:r.url(),status:r.status()});});
        await page.goto('http://127.0.0.1:8765'+route,{waitUntil:'networkidle'});
        await page.evaluate(()=>document.fonts.ready);
        // Scroll real pages so lazy photographs load before full-page screenshots.
        const height = await page.evaluate(()=>document.documentElement.scrollHeight);
        for (let y=0; y<height; y+=viewport.height*.7) {
          await page.evaluate(v=>window.scrollTo(0,v),y);
          await page.waitForTimeout(45);
        }
        await page.waitForFunction(()=>[...document.images].filter(i=>!i.closest('[hidden]')).every(i=>i.complete), undefined, {timeout:15000});
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.waitForTimeout(450);
        const report = await audit(page);
        report.page = name; report.route = route; report.size = viewport.name;
        report.errors = errors; report.failedRequests = failedRequests; report.badResponses = badResponses;
        report.sourceCommit = process.env.GITHUB_SHA || null;
        report.pass = report.viewport.width===viewport.width && report.viewport.height===viewport.height && report.documentWidth<=viewport.width && report.fontReady && !report.overflow.length && !report.overlaps.length && !errors.length && !failedRequests.length && !badResponses.length && report.images.every(i=>i.complete&&i.naturalWidth>0);
        await page.screenshot({path:path.join(out,name+'-'+viewport.name+'.png'),fullPage:true,animations:'disabled'});
        if (name==='doctor') await page.locator('.doctor-story-academic').screenshot({path:path.join(out,'doctor-academic-'+viewport.name+'.png'),animations:'disabled'});
        if (name==='growth') await page.locator('.growth-trend').screenshot({path:path.join(out,'growth-trend-'+viewport.name+'.png'),animations:'disabled'});
        if (name==='homepage') {
          report.servicePanels = [];
          for (const key of ['well','growth','sick']) {
            await page.locator('.care-tab[data-key="'+key+'"]').click();
            await page.waitForTimeout(450);
            await page.waitForFunction(()=>[...document.images].filter(i=>!i.closest('[hidden]')).every(i=>i.complete), undefined, {timeout:15000});
            const p = await audit(page);
            report.servicePanels.push({key,documentWidth:p.documentWidth,overflow:p.overflow,overlaps:p.overlaps,images:p.images});
            if (p.documentWidth>viewport.width || p.overflow.length || p.overlaps.length || !p.images.every(i=>i.complete&&i.naturalWidth>0)) report.pass = false;
            if(key!=='sick') await page.locator('.care-explorer').screenshot({path:path.join(out,'home-care-'+key+'-'+viewport.name+'.png'),animations:'disabled'});
          }
        }
        results.push(report);
        console.log(name+' '+viewport.name+' '+(report.pass?'PASS':'REVIEW')+' height='+report.documentHeight+' overflow='+report.overflow.length);
        failed ||= !report.pass;
        await fs.writeFile(path.join(out,'render-audit.json'),JSON.stringify({browser:browser.version(),generatedAt:new Date().toISOString(),results},null,2));
        await page.close();
      }
      await context.close();
    }
    const hashes = {};
    for (const filename of ['index.html','general-pediatrics/index.html','growth-hormone/index.html','doctor/index.html','contact/index.html','privacy/index.html','css/spacing.css']) {
      hashes[filename] = crypto.createHash('sha256').update(await fs.readFile(path.join(root,filename))).digest('hex');
    }
    await fs.writeFile(path.join(out,'rendered-source-sha256.json'),JSON.stringify(hashes,null,2));
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
  if(failed) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
