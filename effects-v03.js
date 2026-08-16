// Commander Lab v0.3.0 — first reusable card-effect slice
(() => {
  const previousRender = renderGame;
  let knownBattlefield = new Set();
  let effectQueue = [];
  let pickerOpen = false;
  let pickerScrollY = 0;

  function cardKey(card, index=0){
    return card?._instance || `${card?.name || 'card'}-${index}`;
  }

  function ensurePicker(){
    let overlay = document.getElementById('effectTargetOverlay');
    if(overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'effectTargetOverlay';
    overlay.innerHTML = `
      <div class="effect-picker" role="dialog" aria-modal="true" aria-labelledby="effectPickerTitle">
        <div class="effect-picker-head">
          <div class="effect-picker-kicker" id="effectPickerKicker">Triggered Ability</div>
          <div class="effect-picker-title" id="effectPickerTitle">Choose a target</div>
          <div class="effect-picker-prompt" id="effectPickerPrompt"></div>
        </div>
        <div class="effect-picker-list" id="effectPickerList"></div>
        <div class="effect-picker-foot" id="effectPickerFoot">Tap one legal target to continue.</div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function lockPickerBackground(){
    pickerScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${pickerScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  function unlockPickerBackground(){
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    requestAnimationFrame(() => window.scrollTo(0, pickerScrollY));
  }

  function closePicker(){
    const overlay = document.getElementById('effectTargetOverlay');
    if(overlay) overlay.classList.remove('open');
    pickerOpen = false;
    unlockPickerBackground();
    setTimeout(runNextEffect, 30);
  }

  function chooseTarget({kicker='Triggered Ability', title='Choose a target', prompt='', cards=[], foot='Tap one legal target to continue.', onChoose}){
    if(!cards.length){
      if(typeof onChoose === 'function') onChoose(null);
      return;
    }

    const overlay = ensurePicker();
    const list = overlay.querySelector('#effectPickerList');
    overlay.querySelector('#effectPickerKicker').textContent = kicker;
    overlay.querySelector('#effectPickerTitle').textContent = title;
    overlay.querySelector('#effectPickerPrompt').textContent = prompt;
    overlay.querySelector('#effectPickerFoot').textContent = foot;
    list.innerHTML = '';

    cards.forEach(card => {
      const button = document.createElement('button');
      button.className = 'effect-target';
      button.setAttribute('aria-label', `Choose ${card.name}`);
      const img = document.createElement('img');
      img.src = cardImage(card);
      img.alt = card.name;
      img.loading = 'eager';
      const name = document.createElement('div');
      name.className = 'effect-target-name';
      name.textContent = card.name;
      button.append(img, name);
      button.onclick = () => {
        if(!pickerOpen) return;
        const result = onChoose(card);
        if(result === false) return;
        closePicker();
      };
      list.appendChild(button);
    });

    pickerOpen = true;
    lockPickerBackground();
    overlay.classList.add('open');
    list.scrollTop = 0;
  }

  function queueEffect(effect){
    effectQueue.push(effect);
    if(!pickerOpen) setTimeout(runNextEffect, 90);
  }

  function runNextEffect(){
    if(pickerOpen || !effectQueue.length) return;
    const next = effectQueue.shift();
    if(typeof next === 'function') next();
  }

  function resolveEternalWitness(source){
    const candidates = [...state.graveyard];
    if(!candidates.length){
      log('[Effect] Eternal Witness entered, but there was no card in your graveyard to target.');
      return;
    }

    chooseTarget({
      kicker:'Eternal Witness · ETB',
      title:'Choose a card in your graveyard',
      prompt:'When Eternal Witness enters, return target card from your graveyard to your hand.',
      cards:candidates,
      foot:`${candidates.length} legal target${candidates.length===1?'':'s'} · tap one to return it to your hand`,
      onChoose(target){
        const index = state.graveyard.findIndex(c => cardKey(c) === cardKey(target));
        if(index < 0) return false;
        const [returned] = state.graveyard.splice(index,1);
        state.hand.push(returned);
        log(`[Effect] Eternal Witness returned ${returned.name} from your graveyard to your hand.`);
        renderGame();
        return true;
      }
    });
  }

  function handleEnters(card){
    if(card?.name === 'Eternal Witness'){
      queueEffect(() => resolveEternalWitness(card));
    }
  }

  function scanBattlefield(){
    const next = new Set();
    state.battlefield.forEach((card,index) => {
      const key = cardKey(card,index);
      next.add(key);
      if(!knownBattlefield.has(key)) handleEnters(card);
    });
    knownBattlefield = next;
  }

  renderGame = function(){
    previousRender();
    setTimeout(scanBattlefield,0);
  };

  const startButton = document.getElementById('startBtn');
  if(startButton){
    const currentStart = startButton.onclick;
    startButton.onclick = function(event){
      knownBattlefield = new Set();
      effectQueue = [];
      pickerOpen = false;
      if(typeof currentStart === 'function') return currentStart.call(this,event);
    };
  }

  // Sync with any battlefield state that already exists when this layer loads.
  setTimeout(scanBattlefield,0);
})();
