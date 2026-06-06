function buildSidebar(){
  const groups={};
  ALL_KEYS.forEach(k=>{
    const g=COMP_META[k].group;
    if(!groups[g])groups[g]=[];
    groups[g].push(k);
  });
  const out=[];
  Object.entries(groups).forEach(([g,keys])=>{
    out.push(`<div class="sb-group">`);
    out.push(`<div class="sb-group-label"><span>${g}</span><span>${keys.reduce((s,k)=>s+WEIGHTS[k],0)}%</span></div>`);
    keys.forEach(k=>{
      const glyph=COMP_GLYPH[k]||'·';
      const link=COMP_LINK[k]||'#';
      out.push(`<label class="sb-item" data-k="${k}">
        <input type="checkbox" checked data-k="${k}">
        <span style="display:flex;align-items:center;gap:.3rem;min-width:0;overflow:hidden">
          <span style="font-size:.75rem;flex-shrink:0;color:var(--muted);width:1.2rem;text-align:center">${glyph}</span>
          <span style="display:flex;align-items:baseline;gap:.28rem;min-width:0;overflow:hidden">
            <a href="${link}" target="_blank" rel="noopener" onclick="e=>{e.stopPropagation()}" style="color:inherit;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex-shrink:1" title="${COMP_META[k].label}">${COMP_META[k].label}</a>
            <span style="color:var(--accent);font-size:.6rem;flex-shrink:0;font-variant-numeric:tabular-nums">${WEIGHTS[k]}%</span>
          </span>
        </span>
      </label>`);
    });
    out.push(`</div>`);
  });
  document.getElementById('sb-groups').innerHTML=out.join('');

  document.querySelectorAll('.sb-item input').forEach(cb=>{
    cb.addEventListener('change',e=>{
      const k=e.target.dataset.k;
      if(e.target.checked)enabled.add(k); else enabled.delete(k);
      e.target.closest('label').classList.toggle('disabled',!e.target.checked);
      recomputeAll();
    });
  });
  document.getElementById('sb-all').onclick=()=>{
    ALL_KEYS.forEach(k=>enabled.add(k));
    document.querySelectorAll('.sb-item input').forEach(cb=>{cb.checked=true;cb.closest('label').classList.remove('disabled')});
    recomputeAll();
  };
  document.getElementById('sb-none').onclick=()=>{
    enabled.clear();enabled.add('cc'); // keep at least one
    document.querySelectorAll('.sb-item input').forEach(cb=>{
      cb.checked=(cb.dataset.k==='cc');
      cb.closest('label').classList.toggle('disabled',!cb.checked);
    });
    recomputeAll();
  };
  document.getElementById('sb-reset').onclick=document.getElementById('sb-all').onclick;
}

function recalcScoreFiltered(r){
  const filt={};
  for(const [k,v] of Object.entries(r._avail||{})){
    if(enabled.has(k))filt[k]=v;
  }
  if(Object.keys(filt).length===0)return null;
  const totalW=Object.keys(filt).reduce((s,k)=>s+WEIGHTS[k],0);
  return Object.entries(filt).reduce((s,[k,v])=>s+v*WEIGHTS[k]/totalW,0);
}

let rankMode='top';
function buildRanking(){
  const arr=[];
  for(const [num,r] of Object.entries(byNum)){
    if(!showLowData && r.nComp<8)continue;
    const s=recalcScoreFiltered(r);
    if(s!==null)arr.push({num,r,s});
  }
  arr.sort((a,b)=>b.s-a.s);
  const list=rankMode==='top'?arr.slice(0,25):arr.slice(-25).reverse();
  const out=[];
  list.forEach((d,i)=>{
    const rank=rankMode==='top'?i+1:arr.length-i;
    const lowComp=d.r.nComp<8;
    out.push(`<div class="rp-row${lowComp?' low-comp':''}" data-num="${d.num}">
      <span class="rp-rank">${rank}</span>
      <span class="rp-name" title="${lowComp?d.r.nComp+' components only':''}">${d.r.name}</span>
      <span class="rp-score" style="color:${tc(d.s)}">${d.s.toFixed(1)}</span>
    </div>`);
  });
  document.getElementById('rp-list').innerHTML=out.join('');
}

// Use event delegation since .rp-tab elements may not exist at script load
document.addEventListener('click',e=>{
  const tab=e.target.closest('.rp-tab');
  if(!tab)return;
  document.querySelectorAll('.rp-tab').forEach(x=>x.classList.remove('active'));
  tab.classList.add('active');
  rankMode=tab.dataset.mode;
  buildRanking();
});

function recomputeAll(){
  // Returns hex score colour or null (null lets CSS var(--map-no-data) show through)
  const fillFor=r=>{
    if(!r)return null;
    const s=recalcScoreFiltered(r);
    return s===null?null:tc(s);
  };
  const numKey=d=>(d.id<0?String(d.id):String(d.id).padStart(3,'0'));
  d3.selectAll('path.ctry').style('fill',d=>fillFor(byNum[numKey(d)]));
  d3.selectAll('path.globe-ctry').style('fill',d=>fillFor(byNum[numKey(d)]));
  d3.selectAll('.microdot-layer circle').style('fill',function(){
    const iso3=d3.select(this).attr('data-iso');
    const r=byISO[iso3];
    return r?fillFor(r):null;
  });
  buildRanking();
  buildInlineRankings();
}


// ── Inline rankings (Section 02)
let rankTabMode='all';
let showLowData=false;
let rankSearchFilter='';
let mobileShowAll=false;

function setRankTab(mode){
  rankTabMode=mode;
  mobileShowAll=false;
  ['all','top','bot'].forEach(t=>{
    const el=document.getElementById('rank-tab-'+t);
    if(el)el.classList.toggle('active',t===mode);
  });
  buildInlineRankings();
}

function buildInlineRankings(){
  const container=document.getElementById('rank-inline');
  if(!container)return;
  const cnt=document.getElementById('rank-live-count');

  const arr=[];
  for(const [num,r] of Object.entries(byNum)){
    if(!showLowData && r.nComp<8)continue;
    const s=recalcScoreFiltered(r);
    if(s!==null)arr.push({num,r,s});
  }
  arr.sort((a,b)=>b.s-a.s);

  let list = rankTabMode==='top' ? arr.slice(0,25)
           : rankTabMode==='bot' ? arr.slice(-25).reverse()
           : arr;

  const q=rankSearchFilter.trim().toLowerCase();
  if(q) list=list.filter(d=>d.r.name.toLowerCase().includes(q));

  const totalFiltered=list.length;
  const isMobile=window.innerWidth<=900;
  let truncated=false;
  if(isMobile&&!mobileShowAll&&rankTabMode==='all'&&!rankSearchFilter.trim()){
    if(list.length>25){list=list.slice(0,25);truncated=true;}
  }

  if(cnt)cnt.textContent=`${totalFiltered} of ${arr.length} countries`;

  const rows=list.map((d,i)=>{
    const rank=arr.indexOf(d)+1;
    const lowComp=d.r.nComp<8;
    const desc=DESC[d.r.iso3]||'';
    const flagEmoji=d.r.iso3?flag(d.r.iso3):'';
    return `<div class="rank-row-full${lowComp?' low-comp':''}" data-iso="${d.r.iso3}">
      <span style="color:var(--muted);font-variant-numeric:tabular-nums">${rank}</span>
      <span style="color:var(--text)">${flagEmoji}${d.r.name}</span>
      <span style="text-align:right;font-variant-numeric:tabular-nums;font-weight:500;color:${tc(d.s)}">${d.s.toFixed(1)}</span>
      <span style="text-align:right;font-variant-numeric:tabular-nums;color:var(--muted);font-size:.7rem">${d.r.nComp}/13</span>
      ${desc?`<div class="rr-detail">${desc}</div>`:''}
    </div>`;
  });
  let html=rows.join('');
  if(truncated)html+=`<div class="rank-show-all"><button onclick="mobileShowAll=true;buildInlineRankings()">Show all ${totalFiltered} countries ↓</button></div>`;
  container.innerHTML=html;
  applyTwemoji(container);

  container.querySelectorAll('.rank-row-full').forEach(row=>{
    row.addEventListener('click',()=>row.classList.toggle('open'));
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  const srch=document.getElementById('rank-search');
  if(srch)srch.addEventListener('input',e=>{
    rankSearchFilter=e.target.value;
    buildInlineRankings();
  });
});


// Single wheel on hero scrolls straight to map
(function(){
  const hero=document.getElementById('hero');
  if(!hero)return;
  let scrolled=false;
  hero.addEventListener('wheel',function(e){
    if(scrolled)return;
    scrolled=true;
    e.preventDefault();
    document.getElementById('sec-map').scrollIntoView({behavior:'smooth'});
    setTimeout(()=>{scrolled=false;},1200);
  },{passive:false});
})();

// ── Nav smooth scroll (event delegation)
document.addEventListener('click', function(e) {
  const link = e.target.closest('.tn-link[data-target]');
  if (!link) return;
  e.preventDefault();
  const target = document.getElementById(link.dataset.target);
  if (target) target.scrollIntoView({behavior: 'smooth', block: 'start'});
});
// Update active link on scroll
const _sections = ['sec-map','sec-rankings','sec-methodology','sec-about'];
const _navLinks = {};
document.querySelectorAll('.tn-link[data-target]').forEach(l => { _navLinks[l.dataset.target] = l; });
function _updateNav() {
  let active = 'sec-map';
  for (const id of _sections) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top < 150) active = id;
  }
  Object.entries(_navLinks).forEach(([id, link]) => {
    link.classList.toggle('active', id === active);
  });
}
window.addEventListener('scroll', _updateNav, {passive: true});


// Low-data toggle handlers
document.addEventListener('change', function(e){
  if(e.target.id==='rp-lowdata-cb'||e.target.id==='inline-lowdata-cb'){
    showLowData=e.target.checked;
    ['rp-lowdata-cb','inline-lowdata-cb'].forEach(id=>{
      if(id!==e.target.id){const el=document.getElementById(id);if(el)el.checked=showLowData;}
    });
    buildRanking();
    buildInlineRankings();
  }
});

// ── Globe view
let globeInitialised=false;
let globeRotating=null;
let _startGlobe=null; // set by _buildGlobe once rot/redraw are in scope

function setView(mode){
  document.getElementById('tab-flat').classList.toggle('active',mode==='flat');
  document.getElementById('tab-globe').classList.toggle('active',mode==='globe');
  const msvg=document.getElementById('msvg');
  const gc=document.getElementById('globe-container');
  const zc=document.getElementById('zctrls');
  if(mode==='flat'){
    msvg.style.display='block';
    gc.style.display='none';
    if(zc)zc.style.display='flex';
    stopGlobeRotation();
  } else {
    msvg.style.display='none';
    gc.style.display='block';
    if(zc)zc.style.display='none';
    if(!globeInitialised) initGlobeMap();
    else startGlobeRotation();
  }
}

function startGlobeRotation(){
  if(!globeInitialised||globeRotating||!_startGlobe)return;
  _startGlobe();
}
function stopGlobeRotation(){
  if(globeRotating){cancelAnimationFrame(globeRotating);globeRotating=null;}
}

function initGlobeMap(){
  if(globeInitialised)return;
  globeInitialised=true;
  setTimeout(()=>_buildGlobe(),50);
}
function _buildGlobe(){
  const gc=document.getElementById('globe-container');
  const W=gc.clientWidth||960,H=gc.clientHeight||(gc.clientWidth*(490/960))||490;
  const R=Math.min(W,H)/2-10;
  const gsvg=d3.select('#globe-svg').attr('viewBox',`0 0 ${W} ${H}`);
  gsvg.append('rect').attr('width',W).attr('height',H).attr('fill','var(--bg)');

  const gProj=d3.geoOrthographic().scale(R).translate([W/2,H/2]).clipAngle(90);
  const gPath=d3.geoPath().projection(gProj);
  let rot=[0,-25];

  gsvg.append('circle').attr('cx',W/2).attr('cy',H/2).attr('r',R)
    .style('fill','var(--map-ocean)');

  const grat=gsvg.append('path').datum(d3.geoGraticule()())
    .style('fill','none').style('stroke','var(--map-graticule)').attr('stroke-width',.4);

  fetch('https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@1/world/50m.json')
    .then(r=>r.json()).then(world=>{
      const landFeat=topojson.feature(world,world.objects.land);
      const countryFeats=topojson.feature(world,world.objects.countries).features;

      const countries=gsvg.append('g');
      countries.selectAll('path').data(countryFeats).join('path')
        .attr('class','globe-ctry')
        .attr('d',gPath)
        .style('fill',d=>{const n=d.id<0?String(d.id):String(d.id).padStart(3,'0');return byNum[n]?tc(byNum[n].score):null;})
        .style('cursor','pointer')
        .on('mousemove',function(ev){
          const n=d3.select(this).datum().id;
          const nk=n<0?String(n):String(n).padStart(3,'0');
          const iso3=N2I[nk];
          const r=byNum[nk];
          const name=r?.name||(iso3&&WGI[iso3]?.n)||iso3||TERRITORY[nk]?.name||('Region #'+nk);
          showTip(ev,r,name,nk);
        })
        .on('mouseleave',()=>tip.style.opacity='0');

      const dfGlobe=gsvg.append('g').attr('class','df-globe');
      DEFACTO_POLYGONS.forEach(df=>{
        dfGlobe.append('path')
          .datum({type:'Feature',geometry:df.geometry})
          .attr('d',gPath)
          .style('fill','var(--map-no-data)')
          .attr('stroke','rgba(200,120,48,.6)')
          .attr('stroke-width',.8)
          .attr('stroke-dasharray','3,2')
          .style('cursor','help')
          .on('mousemove',ev=>{
            document.getElementById('tn').innerHTML='<span style="font-style:italic">'+df.name+'</span>';
            document.getElementById('tsc').innerHTML='<span style="color:var(--muted);font-size:.6rem;text-transform:uppercase;letter-spacing:.08em">No index data available</span>';
            document.getElementById('tsummary').textContent=df.info;
            document.getElementById('trows').innerHTML='';
            document.getElementById('tfoot').textContent='Not included in CTI — boundaries shown for reference';
            const tw=270,pad=10;
            let tx=ev.clientX+16,ty=ev.clientY+14;
            if(tx+tw>window.innerWidth-pad)tx=ev.clientX-tw-10;
            if(ty+200>window.innerHeight-pad)ty=ev.clientY-210;
            tip.style.left=Math.max(pad,tx)+'px';tip.style.top=Math.max(pad,ty)+'px';tip.style.opacity='1';
          })
          .on('mouseleave',()=>tip.style.opacity='0');
      });

      const globeBorders=gsvg.append('path')
        .datum(topojson.mesh(world,world.objects.countries,(a,b)=>a!==b))
        .style('fill','none')
        .style('stroke','var(--map-border)')
        .attr('stroke-width',.25);

      const coast=gsvg.append('path').datum(landFeat)
        .style('fill','none').style('stroke','var(--map-coast)').attr('stroke-width',.45);

      const GLOBE_MICRODOTS=[
        {iso3:'MCO',xy:[7.40,43.73]},
        {iso3:'VAT',xy:[12.45,41.90]},
        {iso3:'SMR',xy:[12.46,43.94]},
        {iso3:'SGP',xy:[103.82,1.35]},
        {iso3:'LIE',xy:[9.55,47.16]},
        {iso3:'HKG',xy:[114.18,22.32]},
        {iso3:'MLT',xy:[14.44,35.9]},
        {iso3:'BHR',xy:[50.55,26.07]},
        {iso3:'MDV',xy:[73.5,3.2]},
        {iso3:'AND',xy:[1.52,42.5]},
      ];
      const gmdG=gsvg.append('g').attr('class','globe-microdot-layer');
      const gmdCircles=GLOBE_MICRODOTS.map(ms=>{
        const r=byISO[ms.iso3];
        return {
          ms,
          circle: gmdG.append('circle')
            .attr('r',3.5)
            .style('fill',r?tc(r.score):null)
            .style('stroke','var(--map-micro-stroke)')
            .attr('stroke-width',.8)
            .style('cursor',r?'pointer':'help')
            .on('mousemove',ev=>showTip(ev,r,r?r.name:ms.iso3,null))
            .on('mouseleave',()=>tip.style.opacity='0')
        };
      });

      function redraw(){
        gProj.rotate(rot);
        countries.selectAll('path').attr('d',gPath);
        dfGlobe.selectAll('path').attr('d',gPath);
        globeBorders.attr('d',gPath);
        coast.attr('d',gPath);
        grat.attr('d',gPath);
        const center=[-rot[0],-rot[1]];
        gmdCircles.forEach(({ms,circle})=>{
          const dist=d3.geoDistance(ms.xy,center);
          if(dist<Math.PI/2){
            const xy=gProj(ms.xy);
            if(xy)circle.attr('cx',xy[0]).attr('cy',xy[1]).attr('visibility','visible');
            else circle.attr('visibility','hidden');
          } else {
            circle.attr('visibility','hidden');
          }
        });
      }

      _startGlobe=()=>{
        function frame(){rot[0]+=0.15;redraw();globeRotating=requestAnimationFrame(frame);}
        globeRotating=requestAnimationFrame(frame);
      };

      gsvg.call(d3.drag()
        .on('start',()=>stopGlobeRotation())
        .on('drag',ev=>{
          rot=[rot[0]+ev.dx*0.4, Math.max(-90,Math.min(90,rot[1]-ev.dy*0.4))];
          redraw();
        })
      );
      gsvg.on('wheel.zoom',ev=>{
        ev.preventDefault();
        var delta=ev.deltaY>0?0.85:1.15;
        var newScale=Math.max(80,Math.min(R*4,gProj.scale()*delta));
        gProj.scale(newScale);
        gsvg.select('circle').attr('r',newScale);
        redraw();
      },{passive:false});

      const grBtn=document.getElementById('globe-reset');
      if(grBtn) grBtn.onclick=function(){
        rot=[0,-25]; gProj.scale(R); gsvg.select('circle').attr('r',R);
        stopGlobeRotation();
        startGlobeRotation();
        redraw();
      };
      const gzIn=document.getElementById('globe-zin');
      if(gzIn) gzIn.onclick=function(){
        var ns=Math.min(R*4,gProj.scale()*1.4); gProj.scale(ns); gsvg.select('circle').attr('r',ns); redraw();
      };
      const gzOut=document.getElementById('globe-zout');
      if(gzOut) gzOut.onclick=function(){
        var ns=Math.max(80,gProj.scale()/1.4); gProj.scale(ns); gsvg.select('circle').attr('r',ns); redraw();
      };

      startGlobeRotation();
      redraw();
    });
}


// ── Hero rotating quotes
(function(){
  const QUOTES=[
    {
      html:'Widespread distrust in a society imposes a kind of <em>tax</em> on all forms of economic activity — a tax that high-trust societies do not have to pay.',
      attr:'Francis Fukuyama',work:'Trust: The Social Virtues and the Creation of Prosperity, 1995'
    },
    {
      html:'Virtually every commercial transaction has within itself an element of <em>trust</em>. Much of the economic backwardness in the world can be explained by the lack of <em>mutual confidence</em>.',
      attr:'Kenneth Arrow',work:'The Limits of Organization, 1974'
    },
    {
      html:'Without the general <em>trust</em> that people have in each other, <em>society itself</em> would disintegrate.',
      attr:'Georg Simmel',work:'Sociology, 1908'
    },
    {
      html:'The health of a democratic society may be measured by the quality of functions performed by <em>private citizens</em>.',
      attr:'Alexis de Tocqueville',work:'Democracy in America, 1835'
    }
  ];
  let idx=Math.floor(Math.random()*QUOTES.length);
  function applyQuote(q,fade){
    const el=document.getElementById('hero-quote');
    const tEl=document.getElementById('hero-quote-text');
    const aEl=document.getElementById('hero-quote-attr');
    if(!el||!tEl||!aEl)return;
    if(fade){
      el.classList.add('fading');
      setTimeout(()=>{
        tEl.innerHTML='‘'+q.html+'’';
        aEl.innerHTML='— '+q.attr+' <span class="hero-quote-work">· '+q.work+'</span>';
        el.classList.remove('fading');
      },560);
    } else {
      tEl.innerHTML='‘'+q.html+'’';
      aEl.innerHTML='— '+q.attr+' <span class="hero-quote-work">· '+q.work+'</span>';
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    // Lock container height to the tallest quote so nothing shifts on rotation
    const el=document.getElementById('hero-quote');
    const tEl=document.getElementById('hero-quote-text');
    const aEl=document.getElementById('hero-quote-attr');
    if(el&&tEl&&aEl){
      el.style.visibility='hidden';
      let maxH=0;
      QUOTES.forEach(q=>{
        tEl.innerHTML='‘'+q.html+'’';
        aEl.innerHTML='— '+q.attr+' <span class="hero-quote-work">· '+q.work+'</span>';
        maxH=Math.max(maxH,el.offsetHeight);
      });
      el.style.minHeight=maxH+'px';
      tEl.innerHTML='';
      aEl.innerHTML='';
      el.style.visibility='';
    }
    applyQuote(QUOTES[idx],false);
    setInterval(()=>{ idx=(idx+1)%QUOTES.length; applyQuote(QUOTES[idx],true); },20000);
  });
})();

// ── Hero score gradient bar
(function(){
  function drawScoreBar(){
    const cv=document.getElementById('hero-score-canvas');
    if(!cv)return;
    cv.width=cv.offsetWidth||520;
    const ctx=cv.getContext('2d');
    const grad=ctx.createLinearGradient(0,0,cv.width,0);
    grad.addColorStop(0,'#9a2010');
    grad.addColorStop(0.5,'#c87830');
    grad.addColorStop(1,'#4a90e8');
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,cv.width,6);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',drawScoreBar);
  } else {
    setTimeout(drawScoreBar,100);
  }
  window.addEventListener('resize',drawScoreBar);
})();

// ── Hero stat counters
function animateCounter(el, target, suffix, duration){
  if(!el) return;
  const isFloat = target % 1 !== 0;
  const start = performance.now();
  function tick(now){
    const p = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - p, 3);
    const val = target * ease;
    el.textContent = (isFloat ? val.toFixed(0) : Math.round(val)) + (suffix||'');
    if(p < 1) requestAnimationFrame(tick);
    else el.textContent = (isFloat ? target.toFixed(0) : target) + (suffix||'');
  }
  requestAnimationFrame(tick);
}
document.addEventListener('DOMContentLoaded', function(){
  const obs = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      obs.disconnect();
      setTimeout(()=>animateCounter(document.getElementById('hero-n-countries'),174,'',900),100);
      setTimeout(()=>animateCounter(document.querySelector('.hero-stat-block:nth-child(3) .hero-stat-n'),94,'%',1100),300);
    });
  },{threshold:0.3});
  const heroEl=document.querySelector('.hero-section');
  if(heroEl) obs.observe(heroEl);
});
buildSidebar();

// ── Panel toggles (Filters / Rankings)
(function(){
  const app=document.getElementById('app');
  const btnF=document.getElementById('toggle-filters');
  const btnR=document.getElementById('toggle-rankings');
  const SB='cti-sb',RP='cti-rp';
  let sbOn,rpOn;
  try{
    // null (first visit) → false = hidden by default for map-first layout
    sbOn=localStorage.getItem(SB)==='1';
    rpOn=localStorage.getItem(RP)==='1';
  }catch(e){sbOn=false;rpOn=false;}
  function apply(){
    if(!app)return;
    app.classList.toggle('sb-off',!sbOn);
    app.classList.toggle('rp-off',!rpOn);
    if(btnF){
      btnF.classList.toggle('active',sbOn);
      btnF.textContent=sbOn?'⊟ Filters':'⊞ Filters';
    }
    if(btnR){
      btnR.classList.toggle('active',rpOn);
      btnR.textContent=rpOn?'Rankings ⊟':'Rankings ⊞';
    }
  }
  if(btnF)btnF.addEventListener('click',()=>{
    sbOn=!sbOn;try{localStorage.setItem(SB,sbOn?'1':'0');}catch(e){}apply();
  });
  if(btnR)btnR.addEventListener('click',()=>{
    rpOn=!rpOn;try{localStorage.setItem(RP,rpOn?'1':'0');}catch(e){}apply();
  });
  apply();
})();

// Close modals on overlay click or Escape
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open');});
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
});

// ── Hero rotating globe (small decorative sphere in hero section)
function initGlobe(world){
  const W=180,H=180;
  const svg=d3.select('#hero-globe-svg');
  const proj=d3.geoOrthographic().scale(82).translate([W/2,H/2]).clipAngle(90);
  const gp2=d3.geoPath().projection(proj);
  let rot=20;
  let heroGlobeVisible=true;
  let heroRafId=null;
  const grat=svg.append('path').datum(d3.geoGraticule()())
    .style('fill','none').style('stroke','var(--hero-graticule)').attr('stroke-width',.4);
  const land=svg.append('path')
    .datum(topojson.feature(world,world.objects.countries))
    .style('fill','var(--hero-land)').style('stroke','var(--hero-graticule)').attr('stroke-width',.3);
  function animate(){
    if(!heroGlobeVisible){heroRafId=null;return;}
    proj.rotate([rot,-20]);
    grat.attr('d',gp2); land.attr('d',gp2);
    rot+=0.18;
    heroRafId=requestAnimationFrame(animate);
  }
  const heroEl=document.getElementById('hero');
  if(heroEl){
    new IntersectionObserver(entries=>{
      heroGlobeVisible=entries[0].isIntersecting;
      if(heroGlobeVisible&&!heroRafId) heroRafId=requestAnimationFrame(animate);
    },{threshold:0.01}).observe(heroEl);
  }
  heroRafId=requestAnimationFrame(animate);
}

fetch('https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@1/world/50m.json')
  .then(r=>r.json())
  .then(world=>{
    const W=960,H=490;
    const svg=d3.select('#msvg').attr('viewBox',`0 0 ${W} ${H}`).attr('preserveAspectRatio','xMidYMid meet');
    const svgEl=document.getElementById('msvg');
    let _pendingT=null,_zoomRaf=null;
    const zoom=d3.zoom().scaleExtent([1,12]).translateExtent([[0,0],[W,H]])
      .on('start',()=>{svg.style('cursor','grabbing');svgEl.classList.add('zooming');})
      .on('end',()=>{svg.style('cursor','default');svgEl.classList.remove('zooming');})
      .on('zoom',(ev)=>{
        _pendingT=ev.transform;
        if(!_zoomRaf)_zoomRaf=requestAnimationFrame(()=>{
          g.attr('transform',_pendingT);
          _zoomRaf=null;
        });
      });
    svg.call(zoom).on('dblclick.zoom',null);
    const g=svg.append('g').style('will-change','transform');
    g.append('rect').attr('width',W).attr('height',H).style('fill','var(--map-ocean)').attr('rx',5);

    const proj=d3.geoNaturalEarth1().scale(153).translate([W/2,H/2+18]);
    const gp=d3.geoPath().projection(proj);
    const feats=topojson.feature(world,world.objects.countries).features;

    g.selectAll('path.ctry')
      .data(feats)
      .join('path').attr('class','ctry').attr('d',gp)
      .style('fill',d=>{const n=d.id<0?String(d.id):String(d.id).padStart(3,'0');const r=byNum[n];return r?tc(r.score):null;})
      .style('cursor',d=>{const n=d.id<0?String(d.id):String(d.id).padStart(3,'0');return byNum[n]?'pointer':'help';})
      .on('mousemove',function(ev,d){
        if(d.id==null||d.id===undefined){
          document.getElementById('tn').textContent='Disputed boundary';
          document.getElementById('tsc').innerHTML='<span style="color:var(--muted)">No index data</span>';
          document.getElementById('tsummary').textContent='This area has competing territorial claims and is not assigned a country code in the TopoJSON source. It cannot be measured by the CTI.';
          document.getElementById('tsummary').classList.remove('loading');
          document.getElementById('trows').innerHTML='';
          document.getElementById('tfoot').textContent='';
          const _tw=270,_pad=10;
          let _tx=ev.clientX+16,_ty=ev.clientY+14;
          if(_tx+_tw>window.innerWidth-_pad)_tx=ev.clientX-_tw-10;
          if(_ty+200>window.innerHeight-_pad)_ty=ev.clientY-200-10;
          tip.style.left=Math.max(_pad,_tx)+'px';tip.style.top=Math.max(_pad,_ty)+'px';
          tip.style.opacity='1';
          return;
        }
        const n=d.id<0?String(d.id):String(d.id).padStart(3,'0');
        const iso3=N2I[n];
        const resolvedName=byNum[n]?.name||(iso3&&WGI[iso3]?.n)||iso3||('Unknown #'+n);
        showTip(ev,byNum[n],resolvedName,n);
      })
      .on('mouseleave',()=>{tip.style.opacity='0';clearTimeout(summaryTimer);});

    // ── De facto state overlays — non-scaling-stroke keeps width constant at any zoom
    const dfG=g.append('g').attr('class','defacto-layer');
    DEFACTO_POLYGONS.forEach(df=>{
      dfG.append('path')
        .datum({type:'Feature',geometry:df.geometry})
        .attr('d',gp)
        .style('fill','var(--map-no-data)')
        .attr('stroke','rgba(200,120,48,.55)')
        .attr('stroke-width',.7)
        .attr('stroke-dasharray','3,2.5')
        .attr('stroke-linejoin','round')
        .attr('vector-effect','non-scaling-stroke')
        .style('cursor','help')
        .on('mousemove',function(ev){
          document.getElementById('tn').innerHTML='<span style="font-style:italic">'+df.name+'</span>';
          document.getElementById('tsc').innerHTML='<span style="color:var(--muted);text-transform:uppercase;font-size:.6rem;letter-spacing:.08em">No index data available</span>';
          document.getElementById('tsummary').textContent=df.info;
          document.getElementById('tsummary').classList.remove('loading');
          document.getElementById('trows').innerHTML='';
          document.getElementById('tfoot').textContent='Not included in CTI — boundaries shown for reference';
          const tw=270,th=200,pad=10;
          let tx=ev.clientX+16,ty=ev.clientY+14;
          if(tx+tw>window.innerWidth-pad)tx=ev.clientX-tw-10;
          if(ty+th>window.innerHeight-pad)ty=ev.clientY-th-10;
          tip.style.left=Math.max(pad,tx)+'px';tip.style.top=Math.max(pad,ty)+'px';tip.style.opacity='1';
        })
        .on('mouseleave',()=>tip.style.opacity='0');
    });

    // ── Country borders — single mesh path instead of per-country strokes (Firefox perf)
    g.append('path')
      .datum(topojson.mesh(world,world.objects.countries,(a,b)=>a!==b))
      .style('fill','none')
      .style('stroke','var(--map-border)')
      .attr('stroke-width',.35)
      .attr('vector-effect','non-scaling-stroke')
      .attr('d',gp);

    // ── Coastline — non-scaling-stroke keeps it hair-thin at any zoom
    g.append('path')
      .datum(topojson.feature(world,world.objects.land))
      .style('fill','none')
      .style('stroke','var(--map-coast)')
      .attr('stroke-width',.4)
      .attr('stroke-linejoin','round')
      .attr('vector-effect','non-scaling-stroke')
      .attr('d',gp);

    g.append('path').datum(d3.geoGraticule()())
      .style('fill','none').style('stroke','var(--map-graticule)').attr('stroke-width',.5).attr('d',gp);

    // ── Dot markers for micro-states invisible at world scale
    // Placed inside g so zoom transform applies automatically; radius stays proportional
    const MICRODOTS=[
      {iso3:'MCO',xy:[7.40,43.73]},
      {iso3:'VAT',xy:[12.45,41.90]},
      {iso3:'SMR',xy:[12.46,43.94]},
      {iso3:'SGP',xy:[103.82,1.35]},
      {iso3:'LIE',xy:[9.55,47.16]},
      {iso3:'HKG',xy:[114.18,22.32]},
      {iso3:'MLT',xy:[14.44,35.9]},
      {iso3:'BHR',xy:[50.55,26.07]},
      {iso3:'MDV',xy:[73.5,3.2]},
      {iso3:'AND',xy:[1.52,42.5]},
    ];
    const mdG=g.append('g').attr('class','microdot-layer').style('pointer-events','all');
    MICRODOTS.forEach(ms=>{
      const r=byISO[ms.iso3];
      const xy=proj(ms.xy);
      if(!xy||isNaN(xy[0]))return;
      mdG.append('circle')
        .attr('data-iso',ms.iso3)
        .attr('cx',xy[0]).attr('cy',xy[1])
        .attr('r',8/12)
        .style('fill',r?tc(r.score):null)
        .style('stroke','var(--map-micro-stroke)')
        .attr('stroke-width',.8)
        .attr('vector-effect','non-scaling-stroke')
        .style('cursor',r?'pointer':'help')
        .on('mousemove',ev=>showTip(ev,r,r?r.name:ms.iso3,null))
        .on('mouseleave',()=>tip.style.opacity='0');
    });

    buildRanking();
    document.getElementById('zin').onclick=()=>svg.transition().duration(300).call(zoom.scaleBy,1.6);
    document.getElementById('zout').onclick=()=>svg.transition().duration(300).call(zoom.scaleBy,1/1.6);
    document.getElementById('zrst').onclick=()=>svg.transition().duration(400).call(zoom.transform,d3.zoomIdentity);
    initGlobe(world);
    buildInlineRankings();
    const _hN=document.getElementById('hero-n-countries');
    if(_hN)_hN.textContent=Object.keys(byNum).length;
  })
  .catch(e=>document.getElementById('status').textContent='Map error: '+e.message);

// ── Theme toggle
(function(){
  const html=document.documentElement;
  const btn=document.getElementById('theme-toggle');
  const mq=window.matchMedia('(prefers-color-scheme: dark)');
  let stored=null;
  try{stored=localStorage.getItem('cti-theme');}catch(e){}

  function applyTheme(t){
    if(t==='light'){
      html.setAttribute('data-theme','light');
      if(btn)btn.setAttribute('aria-label','Switch to dark mode');
    } else {
      html.removeAttribute('data-theme');
      if(btn)btn.setAttribute('aria-label','Switch to light mode');
    }
  }
  // stored preference > system preference
  applyTheme(stored||(mq.matches?'dark':'light'));

  // Follow system changes only when user hasn't set an explicit preference
  mq.addEventListener('change',function(e){
    let s=null;try{s=localStorage.getItem('cti-theme');}catch(e2){}
    if(!s)applyTheme(e.matches?'dark':'light');
  });

  if(btn) btn.addEventListener('click',function(){
    const next=html.getAttribute('data-theme')==='light'?'dark':'light';
    applyTheme(next);
    try{localStorage.setItem('cti-theme',next);}catch(e){}
  });
})();
