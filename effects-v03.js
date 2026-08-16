// Commander Lab v0.3.3 — reusable targeting/effect slice + commander-slot test spell support
(() => {
  const previousRender = renderGame;
  let knownBattlefield = new Set();
  let knownGraveyard = new Set();
  let effectQueue = [];
  let pickerOpen = false;
  let pickerScrollY = 0;

  function cardKey(card, index=0){
    return card?._instance || `${card?.name || 'card'}-${index}`;
  }

  function isInstantOrSorcery(card){
    const type = card?.type_line || '';
    return type.includes('Instant') || type.includes('Sorcery');
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

  function beastTokenImage(){
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680" viewBox="0 0 488 680">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#153f2d"/><stop offset="1" stop-color="#071d15"/></linearGradient></defs>
      <rect width="488" height="680" rx="32" fill="#09110d"/><rect x="18" y="18" width="452" height="644" rx="24" fill="url(#g)" stroke="#6fd09a" stroke-width="8"/>
      <circle cx="244" cy="280" r="126" fill="#2b7650" opacity=".55"/><path d="M125 345c25-84 67-145 119-184 49 43 91 100 119 184-34-30-68-44-101-43-13 0-25 2-37 6-35-10-68 2-100 37z" fill="#c7e7cc" opacity=".9"/>
      <text x="42" y="82" fill="#e8f7ed" font-family="-apple-system,BlinkMacSystemFont,Arial" font-size="38" font-weight="800">BEAST</text>
      <text x="42" y="505" fill="#d6eadb" font-family="-apple-system,BlinkMacSystemFont,Arial" font-size="25">Token Creature — Beast</text>
      <text x="374" y="620" text-anchor="middle" fill="#f3fff6" font-family="-apple-system,BlinkMacSystemFont,Arial" font-size="54" font-weight="900">3/3</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function createBeastToken(){
    return {
      id:`commander-lab-beast-token-${Date.now()}-${Math.random()}`,
      name:'Beast Token',
      type_line:'Token Creature — Beast',
      oracle_text:'',
      mana_cost:'',
      power:'3',
      toughness:'3',
      colors:['G'],
      color_identity:['G'],
      keywords:[],
      image_uris:{normal:beastTokenImage()},
      _instance:`token-beast-${Date.now()}-${Math.random()}`,
      _tapped:false,
      _isToken:true,
      _enteredTurn:state.turn,
      _summoningSick:true
    };
  }

  function resolveBeastWithin(spell){
    // Until opponent permanents exist in the app, the supported target pool is your battlefield.
    // Commander replacement handling is a later rules slice, so actual commanders are excluded.
    const candidates = state.battlefield.filter(card => !card?._isCommander);
    if(!candidates.length){
      log('[Effect] Beast Within resolved with no currently supported permanent target.');
      return;
    }

    chooseTarget({
      kicker:'Beast Within · Spell',
      title:'Choose a permanent to destroy',
      prompt:'Destroy target permanent. Its controller creates a 3/3 green Beast creature token.',
      cards:candidates,
      foot:`${candidates.length} supported target${candidates.length===1?'':'s'} · tap one to destroy it`,
      onChoose(target){
        const index = state.battlefield.findIndex(c => cardKey(c) === cardKey(target));
        if(index < 0) return false;
        const [destroyed] = state.battlefield.splice(index,1);
        if(!destroyed._isToken) state.graveyard.push(destroyed);
        const beast = createBeastToken();
        state.battlefield.push(beast);
        log(`[Effect] Beast Within destroyed ${destroyed.name}. You created a 3/3 green Beast token.`);
        renderGame();
        return true;
      }
    });
  }

  function resolveCommanderSlotTestSpell(card){
    const index = state.battlefield.findIndex(c => cardKey(c) === cardKey(card));
    if(index < 0) return;

    const [spell] = state.battlefield.splice(index,1);
    spell._testSlotSpellEffectHandled = true;
    state.graveyard.push(spell);
    log(`[Test] ${spell.name} was cast from the commander slot as a test spell and moved to the graveyard.`);
    renderGame();

    if(spell.name === 'Beast Within'){
      resolveBeastWithin(spell);
    }
  }

  function handleEnters(card){
    // During development we allow an instant/sorcery to be placed in the commander slot
    // as a shortcut for testing. The core commander layer currently puts everything it
    // casts onto the battlefield, so correct that here and resolve it as a spell instead.
    if(card?._isCommander && isInstantOrSorcery(card)){
      queueEffect(() => resolveCommanderSlotTestSpell(card));
      return;
    }

    if(card?.name === 'Eternal Witness'){
      queueEffect(() => resolveEternalWitness(card));
    }
  }

  function handleGraveyardArrival(card){
    if(card?._testSlotSpellEffectHandled) return;
    if(card?.name === 'Beast Within'){
      queueEffect(() => resolveBeastWithin(card));
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

  function scanGraveyard(){
    const next = new Set();
    state.graveyard.forEach((card,index) => {
      const key = cardKey(card,index);
      next.add(key);
      if(!knownGraveyard.has(key)) handleGraveyardArrival(card);
    });
    knownGraveyard = next;
  }

  function scanZones(){
    scanBattlefield();
    scanGraveyard();
  }

  renderGame = function(){
    previousRender();
    setTimeout(scanZones,0);
  };

  const startButton = document.getElementById('startBtn');
  if(startButton){
    const currentStart = startButton.onclick;
    startButton.onclick = function(event){
      knownBattlefield = new Set();
      knownGraveyard = new Set();
      effectQueue = [];
      pickerOpen = false;
      if(typeof currentStart === 'function') return currentStart.call(this,event);
    };
  }

  // Sync with any state already present when this layer loads, without treating it as a new effect event.
  knownBattlefield = new Set(state.battlefield.map((card,index)=>cardKey(card,index)));
  knownGraveyard = new Set(state.graveyard.map((card,index)=>cardKey(card,index)));
})();
