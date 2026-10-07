/* Hi-Pass Foreign Guide V5.4.5
 * No vehicle number is sent to a server or written to persistent storage.
 * History state stores only screen, language, position and navigation index.
 */
(() => {
  'use strict';
  const D = window.HIPASS_GUIDE_I18N;
  if (!D) return;
  const SCREENS = ['language', 'menu', 'guide', 'translate', 'contact', 'faq'];
  const LANGS = ['ko', 'en', 'zh', 'vi', 'ru', 'uz', 'mn', 'my', 'ne'];
  const APP_ID = 'hipass-foreign-guide';
  const $ = id => document.getElementById(id);
  const all = sel => Array.from(document.querySelectorAll(sel));
  const LETTERS = {
    private: ['가','나','다','라','마','거','너','더','러','머','버','서','어','저','고','노','도','로','모','보','소','오','조','구','누','두','루','무','부','수','우','주'],
    rental: ['하','허','호'], business: ['바','사','아','자','배']
  };
  let lang = 'ko', current = null, currentIndex = 0, rendering = false;
  let plateGroup = 'private', selected = '', revision = 0, lastSignature = '';
  let copiedValue = '', busy = false, status = null, manual = false;
  let scrollTimer = 0, renderToken = 0;
  const text = (group, key) => D[group]?.[lang]?.[key] ?? D[group]?.ko?.[key] ?? '';

  function setStatus(group, key, error = false) {
    status = key ? {group, key, error} : null;
    const el = $('helperStatus');
    el.textContent = status ? text(group, key) : '';
    el.classList.toggle('is-error', !!error);
  }
  function refreshStatus() {
    if (status) setStatus(status.group, status.key, status.error);
  }
  function setExpanded(id, target, expanded) {
    const b = $(id); if (!b) return;
    b.setAttribute('aria-controls', target);
    b.setAttribute('aria-expanded', String(expanded));
  }
  function applyLanguage(value) {
    lang = LANGS.includes(value) ? value : 'ko';
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang === 'uz' ? 'uz-Latn' : lang;
    for (const [attr, group] of [['data-i18n','T'],['data-hkey','H'],['data-xi18n','X'],['data-ukey','U'],['data-nkey','N']]) {
      all(`[${attr}]`).forEach(el => { el.textContent = (el.dataset.uprefix || '') + text(group, el.getAttribute(attr)); });
    }
    all('[data-ulabel]').forEach(el => el.setAttribute('aria-label', text('U', el.dataset.ulabel)));
    all('[data-ualt]').forEach(el => el.setAttribute('alt', text('U', el.dataset.ualt)));
    $('miniLang').value = lang;
    $('homeMenuLabel').textContent = D.UI_MENU[lang];
    $('interpretStatus').textContent = D.INTERPRET_STATUS[lang];
    const korean = lang === 'ko', logo = korean ? 'assets/kec-logo-ko.png' : 'assets/kec-logo-en.png';
    for (const id of ['brandLogo','footerLogo']) {
      $(id).setAttribute('src', logo);
      $(id).alt = korean ? '한국도로공사' : 'Korea Expressway Corporation';
    }
    $('hqLabel').style.display = korean ? '' : 'none';
    $('footerOrg').textContent = korean ? '한국도로공사 수도권본부' : 'Korea Expressway Corporation';
    document.title = text('T','mainTitle');
    const meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = text('T','mainSub');
    $('floatingChat').setAttribute('aria-label', text('X','chatTitle'));
    all('a[target="_blank"]').forEach(el => el.setAttribute('title', text('N','newTab')));
    updateToggle(); updatePlate(false); refreshStatus();
  }

  // Unicode decimal digits are normalized without losing leading zeros.
  const ZEROS = [0x30,0xff10,0x0966,0x1040,0x1090,0x0660,0x06f0,0x09e6];
  function normalizeDigits(value) {
    let result = '', invalid = false;
    for (const ch of String(value || '')) {
      const cp = ch.codePointAt(0), zero = ZEROS.find(z => cp >= z && cp <= z + 9);
      if (zero !== undefined) result += String(cp - zero);
      else if (!/[\s\u200b\u200c\u200d\ufeff]/u.test(ch)) invalid = true;
    }
    return {value: result, invalid};
  }
  function valueOfPlate() {
    const f = $('plateFront').value, r = $('plateRear').value;
    if (!/^\d{2,3}$/.test(f) || !/^\d{4}$/.test(r) || !LETTERS[plateGroup].includes(selected)) return '';
    return f + selected + r;
  }
  function updatePlate(changed = true) {
    const f = $('plateFront').value, r = $('plateRear').value;
    const signature = `${plateGroup}|${f}|${selected}|${r}`;
    if (changed && signature !== lastSignature) {
      revision++;
      if (copiedValue || busy) setStatus('N','changed');
      else setStatus('', '');
      manual = false;
    }
    lastSignature = signature;
    const complete = valueOfPlate();
    $('plateHangulDisplay').textContent = selected || '—';
    $('platePreviewText').textContent = complete || `${f || '__'} ${selected || '—'} ${r || '____'}`;
    $('previewLabel').textContent = complete ? text('H','preview') : text('N','inProgress');
    $('platePreviewText').classList.toggle('is-complete', !!complete);
    $('manualPlateValue').value = complete;
    $('manualCopyArea').hidden = !manual || !complete;
    $('manualPlateValue').setAttribute('aria-label', text('H','preview'));
    all('[data-plate-letter]').forEach(b => {
      const active = b.dataset.plateLetter === selected;
      b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active));
    });
    all('[data-plate-group]').forEach(b => {
      const active = b.dataset.plateGroup === plateGroup;
      b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active));
    });
    for (const id of ['plateFront','plateRear']) $(id).removeAttribute('aria-invalid');
  }
  function renderLetters() {
    const fragment = document.createDocumentFragment();
    LETTERS[plateGroup].forEach(ch => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'plate-letter'; b.textContent = ch;
      b.lang = 'ko'; b.dataset.plateLetter = ch; b.setAttribute('aria-pressed','false');
      fragment.appendChild(b);
    });
    $('plateLetterGrid').replaceChildren(fragment);
  }
  function updateToggle() {
    const open = $('helperPanel').classList.contains('open');
    $('helperToggle').textContent = text('H', open ? 'closeBtn' : 'openBtn');
    setExpanded('helperToggle','helperPanel',open);
  }
  function handleNumericInput(el) {
    const cap = el.id === 'plateFront' ? 3 : 4;
    const normalized = normalizeDigits(el.value);
    el.value = normalized.value.slice(0,cap);
    updatePlate();
    if (normalized.invalid || normalized.value.length > cap) {
      setStatus('H','validation',true); el.setAttribute('aria-invalid','true');
    }
  }
  function handlePaste(e) {
    if (!e.clipboardData) return;
    const el = e.currentTarget, cap = el.id === 'plateFront' ? 3 : 4;
    const n = normalizeDigits(e.clipboardData.getData('text'));
    e.preventDefault();
    const start = el.selectionStart ?? 0, end = el.selectionEnd ?? el.value.length;
    const candidate = el.value.slice(0,start) + n.value + el.value.slice(end);
    if (n.invalid || candidate.length > cap) {setStatus('H','validation',true);el.setAttribute('aria-invalid','true');return;}
    el.value = candidate; updatePlate();
    const caret = start + n.value.length; el.setSelectionRange(caret,caret);
  }
  function legacyCopy(v) {
    const previous = document.activeElement;
    const ta = document.createElement('textarea'); ta.value = v;
    ta.setAttribute('readonly',''); ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0;font-size:16px';
    document.body.appendChild(ta);
    let ok = false;
    try {ta.focus({preventScroll:true});ta.select();ta.setSelectionRange(0,v.length);ok = document.execCommand('copy');}
    catch (_) {ok = false;}
    finally {ta.remove();if (previous instanceof HTMLElement) previous.focus({preventScroll:true});}
    return ok;
  }
  async function copyPlate() {
    if (busy) return;
    const v = valueOfPlate();
    if (!v) {
      setStatus('H','validation',true);
      if (!/^\d{2,3}$/.test($('plateFront').value)) $('plateFront').setAttribute('aria-invalid','true');
      if (!/^\d{4}$/.test($('plateRear').value)) $('plateRear').setAttribute('aria-invalid','true');
      return;
    }
    const snapshot = revision;
    busy = true; $('copyPlateBtn').disabled = true; $('copyPlateBtn').setAttribute('aria-busy','true');
    let ok = false;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        try {await navigator.clipboard.writeText(v);ok = true;} catch (_) { /* Manual fallback below. */ }
      }
      // Do not write an old snapshot after an asynchronous permission prompt if the number changed.
      if (!ok && snapshot === revision) ok = legacyCopy(v);
      if (ok) copiedValue = v;
      if (snapshot !== revision || v !== valueOfPlate()) {setStatus('N','changed');return;}
      manual = !ok;
      updatePlate(false);
      setStatus('H',ok ? 'copied' : 'copyFail',!ok);
      if (manual) {$('manualPlateValue').focus({preventScroll:true});$('manualPlateValue').select();}
    } finally {
      busy = false; $('copyPlateBtn').disabled = false; $('copyPlateBtn').removeAttribute('aria-busy');
    }
  }

  function readRoute() {
    const m = location.hash.match(/^#(language|menu|guide|translate|contact|faq)-(ko|en|zh|vi|ru|uz|mn|my|ne)$/);
    if (m) return {screen:m[1],lang:m[2]};
    const legacy = location.hash.match(/^#(ko|en|zh|vi|ru|uz|mn|my|ne)$/);
    return legacy ? {screen:'menu',lang:legacy[1]} : {screen:'language',lang:'ko'};
  }
  const routeHash = r => `#${r.screen}-${r.lang}`;
  const ownState = s => !!s && s.app === APP_ID && SCREENS.includes(s.screen) && LANGS.includes(s.lang) && Number.isInteger(s.index);
  function makeState(r, index, y=0) {return {app:APP_ID,screen:r.screen,lang:r.lang,index,scrollY:Math.max(0,y || 0)};}
  function replaceHistory(state, hash) {
    try {history.replaceState(state,'',hash);} catch (_) { /* file:// preview: screen still works */ }
  }
  function saveScroll() {
    if (!current || rendering || location.hash !== routeHash(current)) return;
    replaceHistory(makeState(current,currentIndex,window.scrollY),routeHash(current));
  }
  function render(route,y=0,focus=true) {
    const token = ++renderToken; rendering = true;current = {...route};
    applyLanguage(route.lang);
    all('.screen').forEach(el => el.classList.toggle('active',el.id === 'screen-'+route.screen));
    const first = route.screen === 'language', onMenu = route.screen === 'menu';
    $('backBtn').style.display = first ? 'none' : 'grid';
    $('miniLang').style.display = first ? 'none' : 'block';
    $('homeMenuBtn').style.display = first || onMenu ? 'none' : 'block';
    $('floatingChat').style.display = first ? 'none' : 'flex';
    $('footer').classList.toggle('hidden',first);
    const heading = document.querySelector('#screen-'+route.screen+' h1, #screen-'+route.screen+' h2');
    if (focus && heading) {heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
    const restore = () => {if (token === renderToken) window.scrollTo({top:Math.max(0,y),behavior:'instant'});};
    restore();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== renderToken) return;
      restore(); rendering = false; saveScroll();
    }));
  }
  function navigate(screen, language=lang, replace=false) {
    const next = {screen:SCREENS.includes(screen) ? screen : 'language',lang:LANGS.includes(language) ? language : 'ko'};
    if (current && routeHash(current) === routeHash(next)) return;
    saveScroll();
    if (replace) replaceHistory(makeState(next,currentIndex,0),routeHash(next));
    else {
      currentIndex++;
      try {history.pushState(makeState(next,currentIndex,0),'',routeHash(next));}
      catch (_) {currentIndex=0;replaceHistory(makeState(next,0,0),routeHash(next));}
    }
    render(next,0,true);
  }
  function restoreFromHistory() {
    const r=readRoute(), s=history.state;
    // popstate and hashchange can both fire for one traversal.
    if (current && routeHash(current)===routeHash(r) && ownState(s) && currentIndex===s.index) return;
    if (ownState(s) && s.screen===r.screen && s.lang===r.lang) {currentIndex=s.index;render(r,s.scrollY,false);}
    else {currentIndex=0;replaceHistory(makeState(r,0,0),routeHash(r));render(r,0,false);}
  }
  function onBack() {
    if (ownState(history.state) && currentIndex>0) {saveScroll();history.back();}
    else navigate(current.screen==='menu' ? 'language' : 'menu',lang,true);
  }

  // Delegate only recognized local route/selection controls, never external links.
  document.addEventListener('click', e => {
    if (!(e.target instanceof Element)) return;
    const language=e.target.closest('[data-lang]');
    if (language) {navigate('menu',language.dataset.lang);return;}
    const go=e.target.closest('[data-go]');if (go) {navigate(go.dataset.go);return;}
    const tab=e.target.closest('[data-plate-group]');
    if (tab) {
      const group=tab.dataset.plateGroup;
      if (group===plateGroup || !LETTERS[group]) return;
      plateGroup=group;selected='';renderLetters();updatePlate();return;
    }
    const letter=e.target.closest('[data-plate-letter]');
    if (letter && LETTERS[plateGroup].includes(letter.dataset.plateLetter)) {
      selected=letter.dataset.plateLetter;updatePlate();return;
    }
    const platform=e.target.closest('[data-platform-tab]');
    if (platform) {
      const key=platform.dataset.platformTab;
      all('[data-platform-tab]').forEach(b=>{const active=b===platform;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
      all('[data-platform-card]').forEach(c=>c.classList.toggle('active',c.dataset.platformCard===key));
    }
  });
  for (const id of ['plateFront','plateRear']) {
    $(id).addEventListener('input',e=>handleNumericInput(e.currentTarget));
    $(id).addEventListener('paste',handlePaste);
  }
  $('helperToggle').addEventListener('click',()=>{$('helperPanel').classList.toggle('open');updateToggle();});
  $('copyPlateBtn').addEventListener('click',copyPlate);
  $('manualPlateValue').addEventListener('click',e=>e.currentTarget.select());
  $('backBtn').addEventListener('click',onBack);
  $('homeMenuBtn').addEventListener('click',()=>navigate('menu'));
  $('miniLang').addEventListener('change',e=>{
    saveScroll();const y=window.scrollY;
    const next={screen:current.screen,lang:e.currentTarget.value};
    replaceHistory(makeState(next,currentIndex,y),routeHash(next));render(next,y,false);
  });
  $('showPhones').addEventListener('click',()=>{
    const list=$('phoneList'),open=list.style.display==='none';
    list.style.display=open?'block':'none';setExpanded('showPhones','phoneList',open);
  });
  window.addEventListener('popstate',restoreFromHistory);
  window.addEventListener('hashchange',restoreFromHistory);
  window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(saveScroll,80);},{passive:true});
  window.addEventListener('pagehide',saveScroll);
  window.addEventListener('pageshow',e=>{if(e.persisted){const s=history.state;if(ownState(s)){currentIndex=s.index;render({screen:s.screen,lang:s.lang},s.scrollY,false);}}});
  document.addEventListener('focusin',()=>document.body.classList.toggle('is-editing',!!document.activeElement?.matches('.plate-input')));
  document.addEventListener('focusout',()=>requestAnimationFrame(()=>document.body.classList.toggle('is-editing',!!document.activeElement?.matches('.plate-input'))));
  try {history.scrollRestoration='manual';} catch (_) {}
  renderLetters();setExpanded('showPhones','phoneList',false);
  const initial=readRoute(), saved=history.state;
  currentIndex=ownState(saved)&&saved.screen===initial.screen&&saved.lang===initial.lang?saved.index:0;
  const initialY=ownState(saved)&&saved.screen===initial.screen&&saved.lang===initial.lang?saved.scrollY:0;
  replaceHistory(makeState(initial,currentIndex,initialY),routeHash(initial));
  render(initial,initialY,false);
})();
