// Commander Lab v0.3.4 — legal commander guard + development Test Card slot
(() => {
  let pinnedTestCard = null;
  let pickerScrollY = 0;
  const previousOpenCard = openCard;
  const previousRender = renderGame;

  function oracle(card){
    return cardOracle(card) || '';
  }

  function isLegalSingleCommander(card){
    if(!card) return false;
    const type = card.type_line || '';
    if(/Legendary Creature/i.test(type)) return true;
    if(/can be your commander/i.test(oracle(card))) return true;
    return false;
  }

  function commanderReason(card){
    if(!card) return 'Choose a commander first.';
    return 'Commander Lab currently accepts a legendary creature, or a card whose rules text explicitly says it can be your commander.';
  }

  function addModalAction(parent,label,cls,fn,disabled=false){
    const b=document.createElement('button');
    b.className=`btn ${cls||'secondary'}`;
    b.textContent=label;
    b.disabled=disabled;
    b.onclick=()=>{
      if(disabled)return;
      fn();
      document.getElementById('cardDialog')?.close();
    };
    parent.appendChild(b);
    return b;
  }

  function addModalReason(parent,text){
    const d=document.createElement('div');
    d.className='test-tool-reason';
    d.textContent=text;
    parent.appendChild(d);
  }

  function setCommander(card){
    state.commander=card;
    renderCommanderPreview();
    const start=document.getElementById('startBtn');
    if(start)start.disabled=false;
    if(typeof setStatus==='function')setStatus(`${card.name} selected as commander.`,'good');
  }

  function pinTestCard(card){
    pinnedTestCard=card;
    renderTestSlot();
    if(typeof setStatus==='function')setStatus(`${card.name} pinned to the Test Card slot.`,'good');
  }

  function openDeckCard(card){
    state.selected={c:card,zone:'deck'};
    document.getElementById('modalImg').src=cardImage(card);
    document.getElementById('modalTitle').textContent=card.name;
    document.getElementById('modalText').textContent=`${card.type_line||''}\n${oracle(card)}`;
    const actions=document.getElementById('modalActions');
    actions.innerHTML='';

    const legal=isLegalSingleCommander(card);
    addModalAction(actions,'Set Commander','green',()=>setCommander(card),!legal);
    if(!legal)addModalReason(actions,commanderReason(card));
    addModalAction(actions,'Pin as Test Card','secondary',()=>pinTestCard(card));
    addModalReason(actions,'Test Card is development-only. It lets you load a test copy into your hand without changing the library.');
    document.getElementById('cardDialog').showModal();
  }

  function ensureTestSlot(){
    let area=document.getElementById('testCardArea');
    if(area)return area;
    const commander=document.getElementById('gameCommander');
    if(!commander)return null;
    area=document.createElement('div');
    area.id='testCardArea';
    area.className='test-card-area';
    commander.insertAdjacentElement('afterend',area);
    return area;
  }

  function renderTestSlot(){
    const area=ensureTestSlot();
    if(!area)return;
    area.innerHTML='';

    const head=document.createElement('div');
    head.className='test-card-head';
    const title=document.createElement('div');
    title.className='test-card-title';
    title.textContent='TEST CARD · DEV TOOL';
    const change=document.createElement('button');
    change.className='test-card-change';
    change.textContent=pinnedTestCard?'Change':'Choose';
    change.onclick=showTestPicker;
    head.append(title,change);
    area.appendChild(head);

    if(!pinnedTestCard){
      const empty=document.createElement('button');
      empty.className='test-card-empty';
      empty.textContent='Choose any card from this deck to test it without waiting to draw it.';
      empty.onclick=showTestPicker;
      area.appendChild(empty);
      return;
    }

    const pinned=document.createElement('button');
    pinned.className='test-card-pinned';
    const img=document.createElement('img');
    img.src=cardImage(pinnedTestCard);
    img.alt=pinnedTestCard.name;
    const meta=document.createElement('div');
    meta.className='test-card-meta';
    const strong=document.createElement('strong');
    strong.textContent=pinnedTestCard.name;
    const small=document.createElement('small');
    small.textContent='Tap to load a test copy into your hand and open it using the normal rules engine.';
    const badge=document.createElement('span');
    badge.className='test-card-badge';
    badge.textContent='Does not alter library';
    meta.append(strong,small,badge);
    pinned.append(img,meta);
    pinned.onclick=loadPinnedTestCopy;
    area.appendChild(pinned);
  }

  function loadPinnedTestCopy(){
    if(!pinnedTestCard)return showTestPicker();
    const copy=instance(pinnedTestCard,`test-${Date.now()}`);
    copy._isTestCopy=true;
    state.hand.push(copy);
    log(`[Test] Loaded ${copy.name} into your hand from the Test Card slot.`);
    renderGame();
    setTimeout(()=>openCard(copy,'hand'),40);
  }

  function uniqueDeckCards(){
    const seen=new Set(),cards=[];
    for(const card of state.deck||[]){
      const key=card.id||card.name;
      if(seen.has(key))continue;
      seen.add(key);cards.push(card);
    }
    return cards;
  }

  function ensureTestPicker(){
    let overlay=document.getElementById('testCardPicker');
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.id='testCardPicker';
    overlay.innerHTML=`
      <div class="test-picker-panel" role="dialog" aria-modal="true" aria-labelledby="testPickerTitle">
        <div class="test-picker-head">
          <div class="test-picker-kicker">Development Tool</div>
          <h3 id="testPickerTitle">Choose a Test Card</h3>
          <p>Pin any card in the loaded deck. Tapping the Test Card slot will load a test copy into your hand.</p>
        </div>
        <div class="test-picker-grid" id="testPickerGrid"></div>
        <button type="button" class="test-picker-close" id="testPickerClose">Back</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#testPickerClose').onclick=closeTestPicker;
    overlay.addEventListener('click',event=>{if(event.target===overlay)closeTestPicker()});
    return overlay;
  }

  function showTestPicker(){
    const overlay=ensureTestPicker();
    const grid=overlay.querySelector('#testPickerGrid');
    grid.innerHTML='';
    const cards=uniqueDeckCards();
    cards.forEach(card=>{
      const b=document.createElement('button');
      b.className='test-picker-card';
      const img=document.createElement('img');img.src=cardImage(card);img.alt=card.name;img.loading='lazy';
      const name=document.createElement('span');name.textContent=card.name;
      b.append(img,name);
      b.onclick=()=>{pinTestCard(card);closeTestPicker()};
      grid.appendChild(b);
    });
    pickerScrollY=window.scrollY||window.pageYOffset||0;
    document.body.style.position='fixed';
    document.body.style.top=`-${pickerScrollY}px`;
    document.body.style.left='0';document.body.style.right='0';document.body.style.width='100%';
    overlay.classList.add('open');
    grid.scrollTop=0;
  }

  function closeTestPicker(){
    const overlay=document.getElementById('testCardPicker');
    if(overlay)overlay.classList.remove('open');
    document.body.style.position='';document.body.style.top='';document.body.style.left='';document.body.style.right='';document.body.style.width='';
    requestAnimationFrame(()=>window.scrollTo(0,pickerScrollY));
  }

  // Deck Lab gets two explicit jobs now: choose a legal commander, or pin a test card.
  openCard=function(card,zone){
    if(zone==='deck')return openDeckCard(card);
    return previousOpenCard(card,zone);
  };

  renderGame=function(){
    previousRender();
    renderTestSlot();
  };

  // Guard the real game start too, including decklists that declare an illegal
  // card under a Commander heading.
  const start=document.getElementById('startBtn');
  if(start){
    const previousStart=start.onclick;
    start.onclick=function(event){
      if(!isLegalSingleCommander(state.commander)){
        if(typeof setStatus==='function')setStatus(commanderReason(state.commander),'bad');
        document.getElementById('deckLab')?.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      return typeof previousStart==='function'?previousStart.call(this,event):undefined;
    };
  }

  // Keep the start button honest when an invalid Commander line is loaded.
  const preview=document.getElementById('commanderPreview');
  if(preview){
    const observer=new MutationObserver(()=>{
      const button=document.getElementById('startBtn');
      if(!button)return;
      if(state.commander && !isLegalSingleCommander(state.commander))button.disabled=true;
    });
    observer.observe(preview,{childList:true,subtree:true});
  }

  renderTestSlot();
})();
