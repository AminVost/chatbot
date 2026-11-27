// Keep installed iOS layout independent of the dynamic browser viewport.
// Never infer a full-screen size from screen.height (split view / OS letterboxing).
export const MOBILE_QUERY='(max-width:800px), (max-width:1000px) and (pointer:coarse) and (max-height:600px)';
export function viewportLayout({iosStandalone=false,largeHeight,innerHeight,visualHeight,baseline=0,editable=false,wasKeyboard=false,scale=1}){
 const valid=n=>Number.isFinite(n)&&n>0;
 const inner=valid(innerHeight)?innerHeight:valid(visualHeight)?visualHeight:largeHeight;
 const visual=valid(visualHeight)?visualHeight:inner;
 const full=iosStandalone&&valid(largeHeight)?Math.max(inner,largeHeight):inner;
 const reference=Math.max(full,baseline||0);
 const keyboard=scale===1&&(editable||wasKeyboard)&&reference-visual>120;
 const height=keyboard?visual:iosStandalone?full:Math.min(inner,visual);
 return {height:Math.round(height),keyboard,baseline:keyboard?reference:full};
}
export function bindMobileViewport(onChange=()=>{}){
 const root=document.documentElement, vv=window.visualViewport, mobile=matchMedia(MOBILE_QUERY), standalone=matchMedia('(display-mode: standalone)');
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const probeBox=document.createElement('div');probeBox.setAttribute('aria-hidden','true');probeBox.style.cssText='position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;top:0;left:0';
 const probe=document.createElement('div');probe.style.height='100vh';if(CSS.supports('height','100lvh'))probe.style.height='100lvh';probeBox.append(probe);document.body.append(probeBox);
 let frame=0,baseline=0,lastWidth=0,lastHeight=0,keyboard=false,wasMobile=false;
 const isEditable=()=>{const e=document.activeElement;return !!e&&(e.matches('textarea,input:not([type=button]):not([type=submit]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=range]),[contenteditable=true]'))&&!e.readOnly&&!e.disabled};
 function sync(){
  frame=0;
  const installed=standalone.matches||navigator.standalone===true,iosStandalone=ios&&installed;
  root.classList.toggle('pwa-standalone',installed);root.classList.toggle('ios-standalone',iosStandalone);
  if(!mobile.matches){if(wasMobile){root.style.removeProperty('--app-height');root.style.removeProperty('--visual-height');root.classList.remove('keyboard-open');baseline=lastHeight=0;keyboard=false;onChange()}wasMobile=false;return}
  wasMobile=true;
  const width=window.innerWidth;if(Math.abs(width-lastWidth)>50){baseline=0;keyboard=false;lastWidth=width}
  if(vv&&Math.abs(vv.scale-1)>.02)return; // Preserve pinch zoom and accessibility.
  const r=viewportLayout({iosStandalone,largeHeight:probe.getBoundingClientRect().height,innerHeight:window.innerHeight,visualHeight:vv?.height,baseline,editable:isEditable(),wasKeyboard:keyboard,scale:1});
  baseline=r.baseline;
  const changed=lastHeight!==r.height||keyboard!==r.keyboard;
  const closed=keyboard&&!r.keyboard;keyboard=r.keyboard;lastHeight=r.height;
  root.classList.toggle('keyboard-open',keyboard);
  if(Number.isFinite(r.height)&&r.height>0){const value=r.height+'px';if(root.style.getPropertyValue('--app-height')!==value){root.style.setProperty('--app-height',value);root.style.setProperty('--visual-height',value)}}
  if(iosStandalone&&closed&&window.scrollY>0)window.scrollTo(0,0);
  if(changed)onChange();
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync)};
 let timers=[];
 const settle=()=>{schedule();timers.forEach(clearTimeout);timers=[80,250,600].map(ms=>setTimeout(schedule,ms))};
 vv?.addEventListener('resize',schedule,{passive:true});vv?.addEventListener('scroll',schedule,{passive:true});
 window.addEventListener('resize',schedule,{passive:true});window.addEventListener('orientationchange',()=>{baseline=0;settle()},{passive:true});
 window.addEventListener('pageshow',settle);document.addEventListener('visibilitychange',()=>{if(!document.hidden)settle()});
 document.addEventListener('focusin',settle);document.addEventListener('focusout',settle);
 mobile.addEventListener?.('change',settle);standalone.addEventListener?.('change',settle);
 sync();settle();
}
