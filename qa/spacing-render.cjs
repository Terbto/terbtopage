const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const root = process.cwd();
const out = path.join(root, 'qa-results');
const reviewBase = (process.env.REVIEW_BASE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const checkedSourceFiles = ['index.html','general-pediatrics/index.html','growth-hormone/index.html','doctor/index.html','contact/index.html','privacy/index.html','css/spacing.css','css/home-final.css','css/brand-refresh.css'];
const routes = [
  ['homepage', '/index.html'],
  ['general', '/general-pediatrics/index.html'],
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
    const overflow = [...document.querySelectorAll('main h1,main h2,main h3,main p,main blockquote,main dt,main dd,main figure,main .button,main svg,main .heading-emoji,main .heading-label,main .text-link__arrow,footer')].filter(visible).filter(e => {
      const r = e.getBoundingClientRect();
      return r.left < -1 || r.right > document.documentElement.clientWidth + 1;
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
    const t = document.querySelector('.age-timeline');
    let timeline = null;
    if (t && visible(t)) {
      const panel=t.closest('.care-panel'), copy=panel.querySelector('.care-copy'), ps=getComputedStyle(panel), cols=ps.gridTemplateColumns.split(' ').map(parseFloat);
      const group=rect(t), panelRect=rect(panel), copyRect=rect(copy), heading=rect(copy.querySelector('h3'));
      const expectedCenterX=panelRect.x+parseFloat(ps.paddingLeft)+(cols.length===2?cols[0]+parseFloat(ps.columnGap)+cols[1]/2:cols[0]/2);
      const connector=getComputedStyle(t.querySelector('ol'),'::before');
      const dots=[...t.querySelectorAll('.age-timeline-dot')].map(e=>({rect:rect(e),color:getComputedStyle(e).backgroundColor}));
      const labels=[...t.querySelectorAll('li > span:last-child')].map(e=>({text:e.textContent,rect:rect(e),font:getComputedStyle(e).fontFamily,fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,visible:visible(e)}));
      const caption=t.querySelector('p');
      timeline={group,panel:panelRect,copy:copyRect,heading,expectedCenterX,centerOffsetX:group.x+group.width/2-expectedCenterX,centerOffsetY:group.y+group.height/2-copyRect.y-copyRect.height/2,connector:{height:connector.height,top:connector.top,transform:connector.transform,color:connector.backgroundColor},dots,labels,caption:{text:caption.textContent,rect:rect(caption),font:getComputedStyle(caption).fontFamily,visible:visible(caption)},oldShapes:t.querySelectorAll('b,i').length};
      timeline.pass=Math.abs(timeline.centerOffsetX)<1 && (cols.length!==2||Math.abs(timeline.centerOffsetY)<1) && (window.innerWidth<900||group.height<=heading.height+1) && connector.transform==='none' && connector.height==='1px' && Math.max(...dots.map(d=>d.rect.y))-Math.min(...dots.map(d=>d.rect.y))<1 && labels.map(l=>l.text).join('|')==='ทารก|เด็กเล็ก|เด็กโต' && labels.every(l=>l.visible) && caption.textContent==='ติดตามสุขภาพและวัคซีนตามช่วงวัย' && visible(caption) && timeline.oldShapes===0;
    }
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      clientWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      fontReady: document.fonts.status === 'loaded' && document.fonts.check('400 16px "IBM Plex Sans Thai"','เติบโตคลินิก') && document.fonts.check('600 16px "IBM Plex Sans Thai"','การเจริญเติบโต'),
      headings, paragraphs, overflow, overlaps, markers, trend, timeline,
      images: [...document.images].filter(e=>!e.closest('[hidden]')).map(e=>({src:e.currentSrc,complete:e.complete,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight,rect:rect(e)})),
      groups: [...document.querySelectorAll('.doctor-story-academic,.arrival-grid,.well-child-intro,.parent-question-copy')].map(e=>({element:label(e),rect:rect(e),gap:getComputedStyle(e).gap,paddingInline:getComputedStyle(e).paddingInline,children:[...e.children].map(c=>({element:label(c),rect:rect(c)}))})),
      sections: [...document.querySelectorAll('main > section')].map(e=>({element:label(e),rect:rect(e),paddingTop:getComputedStyle(e).paddingTop,paddingBottom:getComputedStyle(e).paddingBottom})),
    };
  });
}

async function linkState(link, state) {
  return link.evaluate((a, state) => {
    const label=a.querySelector('.text-link__label'), arrow=a.querySelector('.text-link__arrow');
    const ar=a.getBoundingClientRect(), lr=label.getBoundingClientRect(), rr=arrow.getBoundingClientRect();
    const s=getComputedStyle(a), ls=getComputedStyle(label), rs=getComputedStyle(arrow);
    const decoratedAncestors=[];
    for(let e=a;e;e=e.parentElement) {
      if(getComputedStyle(e).textDecorationLine.includes('underline')) decoratedAncestors.push(e.tagName+'.'+e.className);
    }
    const shouldUnderline=Boolean(a.closest('.care-copy,.faq-content'));
    const labelRange=document.createRange(); labelRange.selectNodeContents(label);
    const lines=[...labelRange.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({x:r.x,y:r.y,width:r.width,height:r.height}));
    const result={state,text:label.textContent,href:a.getAttribute('href'),parentDecoration:s.textDecorationLine,labelDecoration:ls.textDecorationLine,arrowDecoration:rs.textDecorationLine,decoratedAncestors,gap:rr.left-lr.right,display:s.display,flexWrap:s.flexWrap,align:s.alignItems,labelLines:lines.length,parentHeight:ar.height,arrowTop:rr.top,labelTop:lr.top,labelFits:label.scrollWidth<=label.clientWidth+1,shouldUnderline,hover:a.matches(':hover'),focus:a.matches(':focus'),focusVisible:a.matches(':focus-visible'),active:a.matches(':active'),arrowHidden:arrow.getAttribute('aria-hidden')==='true'};
    result.pass=s.textDecorationLine==='none' && rs.textDecorationLine==='none' && !decoratedAncestors.length && ls.textDecorationLine.includes('underline')===shouldUnderline && result.gap>=6 && result.gap<=10 && result.labelFits && result.arrowHidden && s.flexWrap==='nowrap' && s.alignItems==='baseline' && Math.abs(result.arrowTop-result.labelTop)<2 && rr.right<=document.documentElement.clientWidth+1 && (state!=='hover'||result.hover) && (state!=='focus'||result.focus) && (state!=='active'||result.active);
    return result;
  }, state);
}

async function checkLinkStates(page, session, name, size, capture=false) {
  const results=[];
  const links=page.locator('a.symbol-link:visible');
  const count=await links.count();
  for(let i=0;i<count;i++) {
    const link=links.nth(i);
    await page.mouse.move(1,1);
    await page.keyboard.press('Escape');
    results.push(await linkState(link,'default'));
    await link.hover();
    results.push(await linkState(link,'hover'));
    if(capture&&i===0) await link.screenshot({path:path.join(out,'text-link-hover-'+size+'.png'),animations:'disabled'});
    await page.mouse.move(1,1);
    await page.keyboard.press('Tab');
    await link.focus();
    results.push(await linkState(link,'focus'));
    if(capture&&i===0) await link.screenshot({path:path.join(out,'text-link-focus-'+size+'.png'),animations:'disabled'});
    await link.hover();
    await page.mouse.down();
    results.push(await linkState(link,'active'));
    if(capture&&i===0) await link.screenshot({path:path.join(out,'text-link-active-'+size+'.png'),animations:'disabled'});
    // Release outside the link so this check never opens an external destination.
    await page.mouse.move(1,1); await page.mouse.up();
    const documentNode=(await session.send('DOM.getDocument')).root.nodeId;
    const selector='a.symbol-link';
    const allNodes=(await session.send('DOM.querySelectorAll',{nodeId:documentNode,selector})).nodeIds;
    const index=await link.evaluate(a=>[...document.querySelectorAll('a.symbol-link')].indexOf(a));
    await session.send('CSS.forcePseudoState',{nodeId:allNodes[index],forcedPseudoClasses:['visited']});
    const visited=await linkState(link,'visited'); visited.method='Chromium forced visited pseudo-state';
    results.push(visited);
    await session.send('CSS.forcePseudoState',{nodeId:allNodes[index],forcedPseudoClasses:[]});
  }
  return {name,size,visibleLinks:count,results,pass:results.every(r=>r.pass)};
}

async function details(page, session) {
  const visual=await page.evaluate(()=>{
    const visible=e=>e.getClientRects().length&&getComputedStyle(e).display!=='none'&&!e.closest('[hidden]');
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height,right:r.right,bottom:r.bottom+scrollY};};
    const emoji=[...document.querySelectorAll('.heading-with-emoji')].filter(visible).map(h=>{
      const e=h.querySelector('.heading-emoji'), label=h.querySelector('.heading-label');
      const er=rect(e),lr=rect(label),s=getComputedStyle(e),hs=getComputedStyle(h);
      const range=document.createRange();range.selectNodeContents(label);
      const lines=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);
      const result={emoji:e.textContent,text:label.textContent,heading:rect(h),emojiRect:er,labelRect:lr,gap:lr.x-er.right,sizeRatio:parseFloat(s.fontSize)/parseFloat(hs.fontSize),headingLineHeight:hs.lineHeight,labelLines:lines.length,decoration:s.textDecorationLine,hidden:e.getAttribute('aria-hidden')};
      result.pass=result.gap>=8-0.1&&result.gap<=12+0.1&&result.sizeRatio>=.7&&result.sizeRatio<=.74&&s.textDecorationLine==='none'&&result.hidden==='true'&&e.closest('h2,h3')!==null&&er.x>=0&&er.right<=document.documentElement.clientWidth&&er.bottom<=lr.y+parseFloat(hs.lineHeight)+1&&label.scrollWidth<=label.clientWidth+1;
      return result;
    });
    const nonTextIcons=[...document.querySelectorAll('a svg,a img,a .heading-emoji')].filter(visible).map(e=>({tag:e.tagName,parent:e.closest('a').getAttribute('class'),parentDecoration:getComputedStyle(e.closest('a')).textDecorationLine,decoration:getComputedStyle(e).textDecorationLine}));
    const unstructured=[...document.querySelectorAll('a')].filter(a=>/[↗→➜➡➔➞↖↘←↓↑]/u.test(a.textContent)&&!a.classList.contains('symbol-link')).map(a=>a.textContent);
    const crops={};
    for(const [name,selector] of Object.entries({care:'.care-explorer',knowledge:'.knowledge-head',doctorAcademic:'.doctor-story-academic',growthTrend:'.growth-trend',arrival:'.arrival'})) {
      const e=document.querySelector(selector);if(e&&visible(e))crops[name]=rect(e);
    }
    return {emoji,nonTextIcons,unstructured,crops,pass:emoji.every(e=>e.pass)&&nonTextIcons.every(e=>e.parentDecoration==='none'&&e.decoration==='none')&&!unstructured.length};
  });
  const rootNode=(await session.send('DOM.getDocument')).root.nodeId;
  visual.actualFonts=[];
  for(const selector of ['main h1','.heading-label']) {
    const nodes=(await session.send('DOM.querySelectorAll',{nodeId:rootNode,selector})).nodeIds;
    for(const nodeId of nodes) {
      const fonts=(await session.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;
      if(fonts.length)visual.actualFonts.push({selector,nodeId,fonts});
    }
  }
  visual.fontPass=visual.actualFonts.length>0&&visual.actualFonts.every(entry=>entry.fonts.some(f=>f.familyName.startsWith('IBM Plex Sans Thai')&&f.isCustomFont&&f.glyphCount>0));
  visual.pass&&=visual.fontPass;
  return visual;
}

(async () => {
  await fs.mkdir(out,{recursive:true});
  const sourceHashes={};
  for(const filename of checkedSourceFiles)sourceHashes[filename]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,filename))).digest('hex');
  const server=http.createServer(async(req,res)=>{
    try {
      let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname.endsWith('/'))pathname+='index.html';
      const filename=path.resolve(root,'.'+pathname);
      if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      const bytes=await fs.readFile(filename);
      res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream'});res.end(bytes);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
  let browser;let failed=false;const results=[];
  try {
    browser=await chromium.launch({headless:true});
    for(const viewport of viewports) {
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,isMobile:viewport.width<600,hasTouch:viewport.width<600});
      for(const [name,route] of routes) {
        const page=await context.newPage(),errors=[],failedRequests=[],badResponses=[],observedSources=[],pendingHashes=[];
        page.on('pageerror',e=>errors.push(e.message));
        page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
        page.on('requestfailed',r=>failedRequests.push({url:r.url(),failure:r.failure()}));
        page.on('response',r=>{
          if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))badResponses.push({url:r.url(),status:r.status()});
          const sourceUrl=r.url().split('?')[0];
          const filename=checkedSourceFiles.find(f=>reviewBase+'/'+f===sourceUrl);
          if(filename)pendingHashes.push(r.body().then(bytes=>{
            const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
            observedSources.push({path:filename,url:r.url(),status:r.status(),sha256,matchesReviewedSource:sha256===sourceHashes[filename]});
          }));
        });
        await page.goto(reviewBase+route,{waitUntil:'networkidle'});
        await page.evaluate(()=>document.fonts.ready);
        const height=await page.evaluate(()=>document.documentElement.scrollHeight);
        for(let y=0;y<height;y+=viewport.height*.7){await page.evaluate(v=>window.scrollTo(0,v),y);await page.waitForTimeout(45);}
        await page.waitForFunction(()=>[...document.images].filter(i=>!i.closest('[hidden]')).every(i=>i.complete),undefined,{timeout:15000});
        await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(350);
        const report=await audit(page);
        const session=await context.newCDPSession(page);await session.send('DOM.enable');await session.send('CSS.enable');
        report.page=name;report.route=route;report.size=viewport.name;report.sourceCommit=process.env.GITHUB_SHA||null;report.publishedCommit=process.env.PUBLISHED_COMMIT||null;report.reviewedBaseUrl=reviewBase;
        report.details=await details(page,session);
        await page.screenshot({path:path.join(out,name+'-'+viewport.name+'.png'),fullPage:true,animations:'disabled'});
        report.linkStates=[await checkLinkStates(page,session,name,viewport.name,false)];
        report.servicePanels=[];
        if(name==='homepage') {
          for(const key of ['well','growth','sick']) {
            await page.locator('.care-tab[data-key="'+key+'"]').click();await page.waitForTimeout(350);
            await page.waitForFunction(()=>[...document.images].filter(i=>!i.closest('[hidden]')).every(i=>i.complete),undefined,{timeout:15000});
            await page.evaluate(()=>window.scrollTo(0,0));
            const panelReport=await audit(page);
            panelReport.details=await details(page,session);
            report.servicePanels.push({key,clientWidth:panelReport.clientWidth,documentWidth:panelReport.documentWidth,overflow:panelReport.overflow,overlaps:panelReport.overlaps,timeline:panelReport.timeline,details:panelReport.details});
            await page.screenshot({path:path.join(out,'homepage-'+key+'-'+viewport.name+'.png'),fullPage:true,animations:'disabled'});
            report.linkStates.push(await checkLinkStates(page,session,name+'-'+key,viewport.name,false));
            if(key==='sick') {
              const link=page.locator('#care-sick a.symbol-link');
              const states=[];
              await link.hover();states.push(await linkState(link,'hover'));
              await link.screenshot({path:path.join(out,'text-link-hover-'+viewport.name+'.png'),animations:'disabled'});
              await page.mouse.move(1,1);await page.keyboard.press('Tab');await link.focus();states.push(await linkState(link,'focus'));
              await link.screenshot({path:path.join(out,'text-link-focus-'+viewport.name+'.png'),animations:'disabled'});
              await link.hover();await page.mouse.down();states.push(await linkState(link,'active'));
              await link.screenshot({path:path.join(out,'text-link-active-'+viewport.name+'.png'),animations:'disabled'});
              await page.mouse.move(1,1);await page.mouse.up();
              report.exampleStates=states;
            }
          }
        }
        await Promise.all(pendingHashes);
        report.errors=errors;report.failedRequests=failedRequests;report.badResponses=badResponses;report.observedSources=observedSources;
        const sourcePass=observedSources.some(s=>s.path===route.slice(1))&&observedSources.every(s=>s.matchesReviewedSource);
        report.pass=sourcePass&&report.viewport.width===viewport.width&&report.viewport.height===viewport.height&&report.documentWidth<=report.clientWidth&&report.fontReady&&!report.overflow.length&&!report.overlaps.length&&!errors.length&&!failedRequests.length&&!badResponses.length&&report.images.every(i=>i.complete&&i.naturalWidth>0)&&report.details.pass&&report.linkStates.every(s=>s.pass)&&report.servicePanels.every(p=>p.documentWidth<=p.clientWidth&&!p.overflow.length&&!p.overlaps.length&&p.details.pass&&(p.key!=='well'||p.timeline?.pass));
        results.push(report);failed||=!report.pass;
        console.log(name+' '+viewport.name+' '+(report.pass?'PASS':'REVIEW')+' width='+report.documentWidth+'/'+report.clientWidth+' arrowStates='+report.linkStates.reduce((n,s)=>n+s.results.length,0)+' emoji='+report.details.emoji.length);
        await fs.writeFile(path.join(out,'render-audit.json'),JSON.stringify({browser:browser.version(),generatedAt:new Date().toISOString(),results},null,2));
        await session.detach();await page.close();
      }
      await context.close();
    }
    await fs.writeFile(path.join(out,'rendered-source-sha256.json'),JSON.stringify(sourceHashes,null,2));
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
  if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

