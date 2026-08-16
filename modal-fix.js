// Commander Lab v0.3.4 — iPhone modal scroll lock + visible hand swipe navigation
(() => {
  let lockedScrollY = 0;
  let locked = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let trackingSwipe = false;

  function lockBackground(){
    if(locked) return;
    locked = true;
    lockedScrollY = window.scrollY || window.pageYOffset || 0;

    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  function unlockBackground(){
    if(!locked) return;
    locked = false;

    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';

    requestAnimationFrame(() => window.scrollTo(0, lockedScrollY));
  }

  function handCards(){
    if(typeof state === 'undefined' || !Array.isArray(state.hand)) return [];
    return state.hand;
  }

  function selectedHandCard(){
    if(typeof state === 'undefined' || state.selected?.zone !== 'hand') return null;
    return state.selected.c || null;
  }

  function sameCard(a,b){
    if(!a || !b) return false;
    if(a._instance && b._instance) return a._instance === b._instance;
    return a === b || (a.id && b.id && a.id === b.id);
  }

  function moveWithinHand(direction){
    const cards = handCards();
    const current = selectedHandCard();
    if(cards.length < 2 || !current || typeof openCard !== 'function') return false;

    let index = cards.findIndex(card => sameCard(card,current));
    if(index < 0) return false;
    index = (index + direction + cards.length) % cards.length;
    openCard(cards[index],'hand');
    return true;
  }

  function ensureHandNav(dialog){
    let nav = document.getElementById('handSwipeNav');
    if(nav) return nav;
    nav = document.createElement('div');
    nav.id = 'handSwipeNav';
    nav.className = 'hand-swipe-nav';
    nav.innerHTML = `
      <button type="button" class="hand-nav-arrow hand-nav-left" aria-label="Previous card">‹</button>
      <div class="hand-swipe-label">Swipe</div>
      <button type="button" class="hand-nav-arrow hand-nav-right" aria-label="Next card">›</button>`;
    dialog.appendChild(nav);
    nav.querySelector('.hand-nav-left').onclick = event => {
      event.preventDefault();event.stopPropagation();moveWithinHand(-1);
    };
    nav.querySelector('.hand-nav-right').onclick = event => {
      event.preventDefault();event.stopPropagation();moveWithinHand(1);
    };
    return nav;
  }

  function updateHandNav(dialog){
    const nav = ensureHandNav(dialog);
    const show = typeof state !== 'undefined' && state.selected?.zone === 'hand' && handCards().length > 1;
    nav.classList.toggle('show', !!show);
  }

  function applyFix(){
    const dialog = document.getElementById('cardDialog');
    const back = document.getElementById('closeModal');
    if(!dialog || !back) return;

    back.textContent = 'Back';
    back.setAttribute('aria-label','Back to game');
    ensureHandNav(dialog);

    const nativeShowModal = dialog.showModal.bind(dialog);
    dialog.showModal = function(){
      updateHandNav(dialog);
      // Card-to-card hand swipes refresh this same open dialog instead of
      // closing/reopening it, which avoids flicker and preserves game scroll.
      if(dialog.open){
        dialog.scrollTop = 0;
        return;
      }
      lockBackground();
      nativeShowModal();
      dialog.scrollTop = 0;
    };

    dialog.addEventListener('close', () => {
      const nav=document.getElementById('handSwipeNav');if(nav)nav.classList.remove('show');
      unlockBackground();
    });
    dialog.addEventListener('cancel', () => requestAnimationFrame(unlockBackground));

    dialog.addEventListener('click', event => {
      if(event.target === dialog) dialog.close();
    });

    dialog.addEventListener('touchstart', event => {
      if(event.touches.length !== 1 || state?.selected?.zone !== 'hand'){
        trackingSwipe = false;
        return;
      }
      if(event.target.closest('button')){
        trackingSwipe = false;
        return;
      }
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      trackingSwipe = true;
    },{passive:true});

    dialog.addEventListener('touchend', event => {
      if(!trackingSwipe || !event.changedTouches.length){
        trackingSwipe = false;
        return;
      }
      trackingSwipe = false;
      const dx = event.changedTouches[0].clientX - touchStartX;
      const dy = event.changedTouches[0].clientY - touchStartY;
      if(Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;

      // Swipe left = next card; swipe right = previous card.
      moveWithinHand(dx < 0 ? 1 : -1);
    },{passive:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyFix);
  else applyFix();
})();
