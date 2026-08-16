// Commander Lab v0.3.6 — manual correction actions for tapped permanents
(() => {
  const previousOpenCard = openCard;

  function addManualUntap(card){
    if(!card?._tapped) return;
    const actions = document.getElementById('modalActions');
    if(!actions || actions.querySelector('[data-manual-untap]')) return;

    const button = document.createElement('button');
    button.className = 'btn secondary';
    button.dataset.manualUntap = 'true';
    button.textContent = 'Untap · Manual';
    button.onclick = () => {
      card._tapped = false;
      card._attacking = false;
      card._attackTappedByRules = false;
      log(`[Manual] Untapped ${card.name}.`);
      renderGame();
      document.getElementById('cardDialog')?.close();
    };

    actions.prepend(button);

    const note = document.createElement('div');
    note.className = 'rules-action-reason';
    note.textContent = 'Manual correction/testing action — not a normal free untap in Magic.';
    actions.insertBefore(note, button.nextSibling);
  }

  openCard = function(card, zone){
    const result = previousOpenCard(card, zone);
    if(zone === 'battlefield' && card?._tapped){
      addManualUntap(card);
    }
    return result;
  };
})();
