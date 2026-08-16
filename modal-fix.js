// Commander Lab v0.1.3 — iPhone card modal + background scroll lock
(() => {
  let lockedScrollY = 0;
  let locked = false;

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

  function applyFix(){
    const dialog = document.getElementById('cardDialog');
    const back = document.getElementById('closeModal');
    if(!dialog || !back) return;

    back.textContent = 'Back';
    back.setAttribute('aria-label','Back to game');

    const nativeShowModal = dialog.showModal.bind(dialog);
    dialog.showModal = function(){
      lockBackground();
      nativeShowModal();
      dialog.scrollTop = 0;
    };

    dialog.addEventListener('close', unlockBackground);
    dialog.addEventListener('cancel', () => requestAnimationFrame(unlockBackground));

    dialog.addEventListener('click', event => {
      if(event.target === dialog) dialog.close();
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyFix);
  else applyFix();
})();
