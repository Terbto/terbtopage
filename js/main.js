(() => {
  const $ = (s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const header=$('.site-header'); const menu=$('.menu-btn'); const nav=$('.nav-links');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onScroll=()=>{const y=scrollY; header?.classList.toggle('scrolled',y>24); const max=Math.max(1,document.documentElement.scrollHeight-innerHeight); const p=Math.min(1,y/max); const fill=$('.world-rail .progress'); if(fill) fill.style.height=(p*100)+'%';};
  addEventListener('scroll',onScroll,{passive:true}); onScroll();
  if(menu&&nav){menu.addEventListener('click',()=>{const open=!nav.classList.contains('open');nav.classList.toggle('open',open);menu.setAttribute('aria-expanded',String(open));document.body.classList.toggle('menu-open',open)});$$('a',nav).forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open')}));}
  $$('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  if(!reduced){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});$$('.reveal').forEach(el=>io.observe(el));}else{$$('.reveal').forEach(el=>el.classList.add('in'));}

  const pattern=$('.pattern-chapter'); const path=$('.pattern-viz .active');
  if(pattern&&path){path.style.strokeDasharray='1';path.style.strokeDashoffset='1';const draw=()=>{const r=pattern.getBoundingClientRect();const span=r.height+innerHeight;const progress=Math.min(1,Math.max(0,(innerHeight-r.top)/span));path.style.strokeDashoffset=String(1-progress)};addEventListener('scroll',draw,{passive:true});draw();if(reduced)path.style.strokeDashoffset='0';}

  const memory=$$('.memory-word'); if(memory.length&&!reduced){const moveWords=()=>{memory.forEach((el,i)=>{const r=el.getBoundingClientRect();const center=r.top+r.height/2;const delta=(center-innerHeight/2)/innerHeight;const dir=i%2?1:-1;el.style.transform=`translateX(${Math.max(-38,Math.min(38,delta*dir*50))}px)`})};addEventListener('scroll',moveWords,{passive:true});moveWords();}

  const topics={
    short:{title:'เด็กตัวเตี้ย / โตช้า',body:'ความสูงหนึ่งครั้งบอกได้ไม่ทั้งหมด สิ่งสำคัญคือแนวโน้มการเติบโต อายุของเด็ก ความสูงของครอบครัว และการเปลี่ยนแปลงเมื่อเทียบกับตัวเองในอดีต'},
    early:{title:'สาวหรือหนุ่มก่อนวัย',body:'เมื่อร่างกายเริ่มเปลี่ยนเร็วกว่าที่คาด การประเมินต้องดูอายุ ลำดับการเปลี่ยนแปลง ความเร็วในการโต และข้อมูลอื่นร่วมกัน ไม่ใช่อาศัยอาการเพียงข้อเดียว'},
    late:{title:'วัยรุ่นช้า',body:'เด็กแต่ละคนเริ่มเข้าสู่วัยรุ่นไม่พร้อมกัน แต่เมื่อการเปลี่ยนแปลงมาช้ากว่าช่วงวัยที่ควรพบ อาจมีเหตุผลให้ประเมินพัฒนาการทางเพศและการเจริญเติบโตเพิ่มเติม'},
    thyroid:{title:'ไทรอยด์ในเด็ก',body:'อาการของไทรอยด์ในเด็กอาจซ้อนกับอาการทั่วไปได้ จึงต้องพิจารณาการเจริญเติบโต อาการร่วม และผลตรวจที่เหมาะสมในบริบทของเด็กแต่ละคน'},
    weight:{title:'น้ำหนักและฮอร์โมน',body:'น้ำหนักที่เปลี่ยนเร็วควรดูพร้อมกับส่วนสูง พฤติกรรมการกิน การนอน การเคลื่อนไหว และสัญญาณทางร่างกายอื่น เพื่อแยกสิ่งที่เกิดจากวิถีชีวิตออกจากภาวะที่ควรตรวจเพิ่มเติม'}
  };
  const topicTitle=$('[data-topic-title]'),topicBody=$('[data-topic-body]'),topicContent=$('.topic-content');
  $$('.topic-btn').forEach((btn,idx)=>btn.addEventListener('click',()=>{const d=topics[btn.dataset.topic];if(!d||!topicContent)return;$$('.topic-btn').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-selected',String(b===btn))});topicContent.classList.add('out');setTimeout(()=>{topicTitle.textContent=d.title;topicBody.textContent=d.body;topicContent.classList.remove('out')},reduced?0:220);}));
})();
