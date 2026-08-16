// Commander Lab v0.3.5 — compact battlefield land stacks
(() => {
  const previousRender = renderGame;
  let stackScrollY = 0;

  const isLand = card => !!card?.type_line?.includes('Land');
  const cardKey = card => card?._instance || card?.id || card?.name || 'card';

  function groupKey(card){
    return `${card?.name || 'Land'}::${card?._tapped ? 'tapped' : 'untapped'}`;
  }

  function ensureOverlay(){
    let overlay = document.getElementById('landStackOverlay');
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'landStackOverlay';
    overlay.innerHTML = `
      <div class="land-stack-panel" role="dialog" aria-modal="true" aria-labelledby="landStackTitle">
        <div class="land-stack-head">
          <div class="land-stack-kicker">LAND STACK</div>
          <h3 id="landStackTitle">Lands</h3>
          <p id="landStackSummary">Tap an individual land to open its normal actions.</p>
        </div>
        <div class="land-stack-grid" id="landStackGrid"></div>
        <button type="button" class="land-stack-close" id="landStackClose">Back</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#landStackClose').onclick = closeOverlay;
    overlay.addEventListener('click', event => { if(event.target === overlay) closeOverlay(); });
    return overlay;
  }

  function lockBackground(){
    stackScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${stackScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  function unlockBackground(){
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    requestAnimationFrame(() => window.scrollTo(0, stackScrollY));
  }

  function closeOverlay(){
    const overlay = document.getElementById('landStackOverlay');
    if(overlay) overlay.classList.remove('open');
    unlockBackground();
  }

  function openLandActions(card){
    closeOverlay();
    setTimeout(() => openCard(card,'battlefield'), 35);
  }

  function showLandStack(name){
    const copies = (state.battlefield || []).filter(card => isLand(card) && card.name === name);
    if(!copies.length) return;
    const overlay = ensureOverlay();
    const grid = overlay.querySelector('#landStackGrid');
    const untapped = copies.filter(card => !card._tapped).length;
    const tapped = copies.length - untapped;

    overlay.querySelector('#landStackTitle').textContent = `${name} · ${copies.length}`;
    overlay.querySelector('#landStackSummary').textContent = `${untapped} untapped · ${tapped} tapped · tap an individual card for its normal actions`;
    grid.innerHTML = '';

    copies
      .slice()
      .sort((a,b) => Number(a._tapped) - Number(b._tapped))
      .forEach((card,index) => {
        const button = document.createElement('button');
        button.className = `land-stack-item${card._tapped ? ' is-tapped' : ''}`;
        button.setAttribute('aria-label', `${card._tapped ? 'Tapped' : 'Untapped'} ${card.name} ${index+1}`);

        const art = document.createElement('div');
        art.className = 'land-stack-item-art';
        const img = document.createElement('img');
        img.src = cardImage(card);
        img.alt = card.name;
        img.loading = 'eager';
        art.appendChild(img);

        const meta = document.createElement('div');
        meta.className = 'land-stack-item-meta';
        const strong = document.createElement('strong');
        strong.textContent = `${card.name} ${index+1}`;
        const status = document.createElement('span');
        status.className = `land-stack-status ${card._tapped ? 'tapped' : 'ready'}`;
        status.textContent = card._tapped ? 'Tapped' : 'Untapped';
        meta.append(strong,status);
        button.append(art,meta);
        button.onclick = () => openLandActions(card);
        grid.appendChild(button);
      });

    lockBackground();
    overlay.classList.add('open');
    grid.scrollTop = 0;
  }

  function makeStackNode(cards, originalNode){
    const representative = cards[0];
    const wrapper = document.createElement('div');
    wrapper.className = `land-stack-battlefield${representative._tapped ? ' is-tapped' : ''}`;
    wrapper.dataset.landName = representative.name;

    // Reuse the card node produced by the normal battlefield renderer so the
    // app keeps the exact art/treatment and familiar tapped appearance.
    const cardNode = originalNode;
    cardNode.classList.add('land-stack-representative');
    cardNode.onclick = () => showLandStack(representative.name);
    wrapper.appendChild(cardNode);

    if(cards.length > 1){
      const shadow1 = document.createElement('div');
      shadow1.className = 'land-stack-shadow shadow-one';
      const shadow2 = document.createElement('div');
      shadow2.className = 'land-stack-shadow shadow-two';
      wrapper.prepend(shadow2,shadow1);
    }

    const badge = document.createElement('div');
    badge.className = 'land-stack-count';
    badge.textContent = String(cards.length);
    badge.setAttribute('aria-label', `${cards.length} ${representative.name}${cards.length===1?'':'s'}`);
    wrapper.appendChild(badge);

    const stateBadge = document.createElement('div');
    stateBadge.className = `land-stack-state ${representative._tapped ? 'tapped' : 'ready'}`;
    stateBadge.textContent = representative._tapped ? 'TAPPED' : 'READY';
    wrapper.appendChild(stateBadge);

    return wrapper;
  }

  function compactBattlefield(){
    const battlefield = document.getElementById('battlefield');
    if(!battlefield || !Array.isArray(state?.battlefield) || !state.battlefield.length) return;

    const originalNodes = Array.from(battlefield.children);
    if(originalNodes.length !== state.battlefield.length) return;

    const groups = new Map();
    const nonlands = [];

    state.battlefield.forEach((card,index) => {
      const node = originalNodes[index];
      if(!node) return;
      if(!isLand(card)){
        nonlands.push({card,node,index});
        return;
      }
      const key = groupKey(card);
      if(!groups.has(key)) groups.set(key,{name:card.name,tapped:!!card._tapped,cards:[],firstIndex:index,node});
      groups.get(key).cards.push(card);
    });

    if(!groups.size) return;

    const landGroups = [...groups.values()].sort((a,b) => {
      if(a.name !== b.name) return a.name.localeCompare(b.name);
      return Number(a.tapped) - Number(b.tapped);
    });

    const fragment = document.createDocumentFragment();
    landGroups.forEach(group => fragment.appendChild(makeStackNode(group.cards,group.node)));
    nonlands.sort((a,b)=>a.index-b.index).forEach(entry => fragment.appendChild(entry.node));

    battlefield.innerHTML = '';
    battlefield.appendChild(fragment);
  }

  renderGame = function(){
    previousRender();
    compactBattlefield();
  };

  // Compact any already-rendered battlefield when this layer loads.
  compactBattlefield();
})();
