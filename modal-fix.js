// Commander Lab v0.1.2 — iPhone card modal hotfix
(() => {
  function applyFix(){
    const dialog=document.getElementById('cardDialog');
    const back=document.getElementById('closeModal');
    if(!dialog||!back)return;
    back.textContent='Back';
    back.setAttribute('aria-label','Back to game');
    dialog.addEventListener('click',event=>{
      if(event.target===dialog)dialog.close();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyFix);
  else applyFix();
})();
