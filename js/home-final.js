(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menu=$('.menu-button');
  const mobile=$('.mobile-nav');
  if(menu&&mobile){
    const close=()=>{menu.setAttribute('aria-expanded','false');mobile.classList.remove('is-open');document.body.style.overflow=''};
    menu.addEventListener('click',()=>{
      const open=menu.getAttribute('aria-expanded')!=='true';
      menu.setAttribute('aria-expanded',String(open));
      mobile.classList.toggle('is-open',open);
      document.body.style.overflow=open?'hidden':'';
    });
    $$('a',mobile).forEach(a=>a.addEventListener('click',close));
  }

  const tabs=$$('.care-tab');
  const panels=$$('.care-panel');
  let timer=null;
  function activate(tab,focus=false){
    const key=tab.dataset.key;
    const next=$(`[data-panel="${key}"]`);
    const current=$('.care-panel.is-active');
    if(!next||next===current) return;
    tabs.forEach(t=>{
      const active=t===tab;
      t.classList.toggle('is-active',active);
      t.setAttribute('aria-selected',String(active));
      t.tabIndex=active?0:-1;
    });
    clearTimeout(timer);
    const swap=()=>{
      panels.forEach(p=>{p.hidden=p!==next;p.classList.remove('is-active','leaving','entering')});
      next.hidden=false;
      next.classList.add('is-active');
      if(!reduced){next.classList.add('entering');requestAnimationFrame(()=>requestAnimationFrame(()=>next.classList.remove('entering')))}
      if(focus) tab.focus();
    };
    if(reduced||!current){swap();return;}
    current.classList.add('leaving');
    timer=setTimeout(swap,170);
  }
  tabs.forEach((tab,i)=>{
    tab.tabIndex=i===0?0:-1;
    tab.addEventListener('click',()=>activate(tab));
    tab.addEventListener('keydown',e=>{
      if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
      e.preventDefault();
      let n=i;
      if(e.key==='Home') n=0;
      else if(e.key==='End') n=tabs.length-1;
      else if(e.key==='ArrowRight'||e.key==='ArrowDown') n=(i+1)%tabs.length;
      else n=(i-1+tabs.length)%tabs.length;
      activate(tabs[n],true);
    });
  });

  $$('[data-page-link]').forEach(a=>a.addEventListener('click',e=>{
    if(reduced||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank') return;
    const href=a.getAttribute('href');
    if(!href||href.startsWith('#')) return;
    e.preventDefault();
    document.body.classList.add('is-leaving');
    setTimeout(()=>{window.location.href=href},210);
  }));

})();

(()=>{
  const tabs=[...document.querySelectorAll('.growth-tab')];
  if(!tabs.length) return;
  const panels=[...document.querySelectorAll('.growth-panel')];
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function activate(tab,focus=false){
    const key=tab.dataset.growthKey;
    const next=document.querySelector(`[data-growth-panel="${key}"]`);
    if(!next) return;
    tabs.forEach(t=>{const active=t===tab;t.classList.toggle('is-active',active);t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1});
    panels.forEach(p=>{p.hidden=p!==next;p.classList.remove('is-active','is-entering')});
    next.hidden=false;next.classList.add('is-active');
    if(!reduced){next.classList.add('is-entering');requestAnimationFrame(()=>requestAnimationFrame(()=>next.classList.remove('is-entering')))}
    if(focus) tab.focus();
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>activate(tab));
    tab.addEventListener('keydown',e=>{
      if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
      e.preventDefault(); let n=i;
      if(e.key==='Home') n=0; else if(e.key==='End') n=tabs.length-1; else if(e.key==='ArrowRight'||e.key==='ArrowDown') n=(i+1)%tabs.length; else n=(i-1+tabs.length)%tabs.length;
      activate(tabs[n],true);
    });
  });
})();
