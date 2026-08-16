// Commander Lab v0.2.1 — core rules test layer with automatic mana payment
(() => {
  const PHASES=['Untap','Upkeep','Draw','Main 1','Combat','Main 2','End'];
  const MANA=['W','U','B','R','G','C'];
  const rules={active:false,phaseIndex:3,landPlayed:false,opponentLife:40,commanderCasts:0,commanderLocation:'command',mana:{W:0,U:0,B:0,R:0,G:0,C:0},combatResolved:false};
  const original={openCard,renderGame,startGame};

  const isCreature=c=>!!c?.type_line?.includes('Creature');
  const isLand=c=>!!c?.type_line?.includes('Land');
  const isInstant=c=>!!c?.type_line?.includes('Instant');
  const isSorcery=c=>!!c?.type_line?.includes('Sorcery');
  const isPermanent=c=>!!c && !isInstant(c) && !isSorcery(c) && !isLand(c);
  const hasKeyword=(c,k)=>Array.isArray(c?.keywords)&&c.keywords.includes(k);
  const phase=()=>PHASES[rules.phaseIndex];
  const inMain=()=>phase()==='Main 1'||phase()==='Main 2';
  const clearMana=()=>MANA.forEach(k=>rules.mana[k]=0);

  function toast(msg){
    let el=document.getElementById('rulesToast');
    if(!el){el=document.createElement('div');el.id='rulesToast';document.body.append(el)}
    el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),2100);
  }

  function manaText(){return MANA.map(k=>`${k}:${rules.mana[k]}`).join(' ')}
  function logRules(msg){log(`[Rules] ${msg}`)}

  function parseCost(card,extraGeneric=0){
    const text=card?.mana_cost||'';const cost={generic:extraGeneric,W:0,U:0,B:0,R:0,G:0,C:0,unsupported:[]};
    for(const m of text.matchAll(/\{([^}]+)\}/g)){
      const s=m[1];
      if(/^\d+$/.test(s))cost.generic+=Number(s);
      else if(MANA.includes(s))cost[s]++;
      else cost.unsupported.push(s);
    }
    return cost;
  }
  function costLabel(card,extraGeneric=0){
    const base=card?.mana_cost||'{0}';return extraGeneric?`${base} + {${extraGeneric}} commander tax`:base;
  }
  function canPoolPay(cost,pool){
    if(cost.unsupported.length)return false;
    const test={...pool};
    for(const k of MANA){if(test[k]<cost[k])return false;test[k]-=cost[k]}
    return MANA.reduce((s,k)=>s+test[k],0)>=cost.generic;
  }
  function canPay(cost){return canPoolPay(cost,rules.mana)}
  function pay(cost){
    for(const k of MANA)rules.mana[k]-=cost[k];
    let n=cost.generic;for(const k of ['C','W','U','B','R','G']){const take=Math.min(n,rules.mana[k]);rules.mana[k]-=take;n-=take;if(!n)break}
  }

  function manaAbilities(card){
    const abilities=[];const oracle=cardOracle(card)||'';
    const add=(label,delta)=>{if(!abilities.some(a=>a.label===label))abilities.push({label,delta})};
    if(card?.type_line?.includes('Plains'))add('Tap: +W',{W:1});
    if(card?.type_line?.includes('Island'))add('Tap: +U',{U:1});
    if(card?.type_line?.includes('Swamp'))add('Tap: +B',{B:1});
    if(card?.type_line?.includes('Mountain'))add('Tap: +R',{R:1});
    if(card?.type_line?.includes('Forest'))add('Tap: +G',{G:1});
    for(const m of oracle.matchAll(/\{T\}: Add ((?:\{[WUBRGC]\})+)/g)){
      const symbols=[...m[1].matchAll(/\{([WUBRGC])\}/g)].map(x=>x[1]);const delta={};symbols.forEach(s=>delta[s]=(delta[s]||0)+1);add(`Tap: +${symbols.join('')}`,delta);
    }
    if(/Add one mana of any color in your commander's color identity/i.test(oracle)){
      const ids=state.commander?.color_identity?.length?state.commander.color_identity:['C'];ids.forEach(k=>add(`Tap: +${k}`,{[k]:1}));
    }else if(/Add one mana of any color/i.test(oracle)){
      ['W','U','B','R','G'].forEach(k=>add(`Tap: +${k}`,{[k]:1}));
    }
    return abilities;
  }
  function canUseTapAbility(c){
    if(c._tapped)return false;
    if(isCreature(c) && c._enteredTurn===state.turn && !hasKeyword(c,'Haste'))return false;
    return true;
  }
  function tapForMana(c,ability){
    if(!canUseTapAbility(c)){toast('That permanent cannot tap for mana right now.');return}
    c._tapped=true;for(const [k,v] of Object.entries(ability.delta))rules.mana[k]=(rules.mana[k]||0)+v;
    logRules(`${c.name} tapped for ${ability.label.replace('Tap: +','')}. Mana pool: ${manaText()}`);renderGame();
  }

  function addDelta(pool,delta){for(const [k,v] of Object.entries(delta))pool[k]=(pool[k]||0)+v}
  function abilityTotal(ab){return Object.values(ab.delta).reduce((s,v)=>s+v,0)}
  function availableManaSources(){
    return state.battlefield
      .filter(c=>canUseTapAbility(c))
      .map(c=>({card:c,abilities:manaAbilities(c)}))
      .filter(s=>s.abilities.length);
  }
  function chooseForColor(sources,used,color){
    const choices=[];
    for(const source of sources){
      if(used.has(source.card._instance))continue;
      for(const ability of source.abilities){
        if(!(ability.delta[color]>0))continue;
        const flexibility=source.abilities.length;
        const extra=Math.max(0,abilityTotal(ability)-(ability.delta[color]||0));
        const score=flexibility*100+extra*8-(ability.delta[color]||0)*10;
        choices.push({source,ability,score});
      }
    }
    choices.sort((a,b)=>a.score-b.score||a.source.card.name.localeCompare(b.source.card.name));
    return choices[0]||null;
  }
  function chooseForGeneric(sources,used){
    const choices=[];
    for(const source of sources){
      if(used.has(source.card._instance))continue;
      for(const ability of source.abilities){
        const total=abilityTotal(ability);if(!total)continue;
        const flexibility=source.abilities.length;
        const colorless=ability.delta.C||0;
        const score=-total*100+flexibility*10-colorless*2;
        choices.push({source,ability,score});
      }
    }
    choices.sort((a,b)=>a.score-b.score||a.source.card.name.localeCompare(b.source.card.name));
    return choices[0]||null;
  }
  function genericAvailableAfterSpecific(pool,cost){
    const rest={...pool};
    for(const k of MANA){if(rest[k]<cost[k])return -1;rest[k]-=cost[k]}
    return MANA.reduce((s,k)=>s+rest[k],0);
  }
  function planAutoPay(cost){
    if(cost.unsupported.length)return null;
    const pool={...rules.mana};
    if(canPoolPay(cost,pool))return [];
    const sources=availableManaSources(),used=new Set(),plan=[];

    for(const color of MANA){
      while(pool[color]<cost[color]){
        const pick=chooseForColor(sources,used,color);if(!pick)return null;
        used.add(pick.source.card._instance);plan.push({card:pick.source.card,ability:pick.ability});addDelta(pool,pick.ability.delta);
      }
    }

    while(genericAvailableAfterSpecific(pool,cost)<cost.generic){
      const pick=chooseForGeneric(sources,used);if(!pick)return null;
      used.add(pick.source.card._instance);plan.push({card:pick.source.card,ability:pick.ability});addDelta(pool,pick.ability.delta);
    }
    return canPoolPay(cost,pool)?plan:null;
  }
  function autoPay(cost){
    const plan=planAutoPay(cost);if(plan===null)return null;
    for(const step of plan){
      step.card._tapped=true;addDelta(rules.mana,step.ability.delta);
    }
    if(plan.length){
      const names=plan.map(s=>s.card.name).join(', ');
      logRules(`Auto-tapped ${plan.length} mana source${plan.length===1?'':'s'}: ${names}.`);
    }
    pay(cost);return plan;
  }

  function canCastTiming(card){return isInstant(card)||inMain()}
  function castFromHand(c){
    const cost=parseCost(c);
    if(!canCastTiming(c)){toast('That spell cannot be cast in this phase in v0.2.');return}
    if(cost.unsupported.length){toast(`v0.2 cannot auto-pay ${cost.unsupported.map(x=>`{${x}}`).join(' ')} costs yet.`);return}
    const plan=autoPay(cost);if(plan===null){toast(`Not enough available mana. Need ${c.mana_cost||'{0}'}.`);return}
    const i=state.hand.findIndex(x=>x._instance===c._instance);if(i<0)return;state.hand.splice(i,1);
    if(isInstant(c)||isSorcery(c)){state.graveyard.push(c);logRules(`Cast ${c.name} for ${c.mana_cost||'{0}'}; it went to the graveyard. Card effects are not automated yet.`)}
    else{c._enteredTurn=state.turn;c._summoningSick=isCreature(c)&&!hasKeyword(c,'Haste');state.battlefield.push(c);logRules(`Cast ${c.name} for ${c.mana_cost||'{0}'}.`)}
    renderGame();
  }
  function playLand(c){
    if(!inMain()){toast('You can play a land only during a main phase.');return}
    if(rules.landPlayed){toast('You already played a land this turn.');return}
    const i=state.hand.findIndex(x=>x._instance===c._instance);if(i<0)return;state.hand.splice(i,1);c._enteredTurn=state.turn;state.battlefield.push(c);rules.landPlayed=true;logRules(`Played land: ${c.name}.`);renderGame();
  }
  function castCommander(){
    if(rules.commanderLocation!=='command'){toast('Your commander is not in the command zone.');return}
    if(!inMain() && !hasKeyword(state.commander,'Flash')){toast('Commander timing is restricted to a main phase in this test.');return}
    const tax=rules.commanderCasts*2,cost=parseCost(state.commander,tax);
    if(cost.unsupported.length){toast('This commander has a mana cost v0.2 cannot auto-pay yet.');return}
    const plan=autoPay(cost);if(plan===null){toast(`Not enough available mana. Need ${costLabel(state.commander,tax)}.`);return}
    const ci=instance(state.commander,`cmd-${rules.commanderCasts}`);ci._isCommander=true;ci._enteredTurn=state.turn;ci._summoningSick=isCreature(ci)&&!hasKeyword(ci,'Haste');state.battlefield.push(ci);rules.commanderCasts++;rules.commanderLocation='battlefield';logRules(`Cast commander ${state.commander.name}. Commander tax next time: {${rules.commanderCasts*2}}.`);renderGame();
  }
  function returnCommander(c){
    const i=state.battlefield.findIndex(x=>x._instance===c._instance);if(i>=0)state.battlefield.splice(i,1);rules.commanderLocation='command';logRules(`${state.commander.name} returned to the command zone for testing.`);renderGame();
  }

  function eligibleAttacker(c){return isCreature(c)&&!c._tapped&&(c._enteredTurn!==state.turn||hasKeyword(c,'Haste'))}
  function toggleAttack(c){
    if(phase()!=='Combat'){toast('Declare attackers during Combat.');return}
    if(c._attacking){c._attacking=false;if(c._attackTappedByRules)c._tapped=false;c._attackTappedByRules=false;renderGame();return}
    if(!eligibleAttacker(c)){toast(c._enteredTurn===state.turn?'That creature has summoning sickness.':'That creature cannot attack right now.');return}
    c._attacking=true;if(!hasKeyword(c,'Vigilance')){c._tapped=true;c._attackTappedByRules=true}rules.combatResolved=false;logRules(`${c.name} declared as an attacker.`);renderGame();
  }
  function resolveCombat(auto=false){
    const attackers=state.battlefield.filter(c=>c._attacking);if(!attackers.length){if(!auto)toast('No attackers declared.');return}
    let damage=0,unknown=[];for(const c of attackers){const p=Number(c.power);if(Number.isFinite(p))damage+=p;else unknown.push(c.name)}
    rules.opponentLife=Math.max(0,rules.opponentLife-damage);attackers.forEach(c=>{c._attacking=false;c._attackTappedByRules=false});rules.combatResolved=true;
    logRules(`${auto?'Auto-resolved':'Resolved'} combat for ${damage} printed-power damage${unknown.length?` (${unknown.length} variable-power attacker ignored)`:''}. Training opponent: ${rules.opponentLife} life.`);renderGame();
    if(rules.opponentLife<=0)toast('Training opponent defeated!');
  }

  function advancePhase(){
    if(!rules.active)return;
    if(phase()==='Combat' && state.battlefield.some(c=>c._attacking))resolveCombat(true);
    clearMana();rules.phaseIndex++;
    if(rules.phaseIndex>=PHASES.length){rules.phaseIndex=0;state.turn++;rules.landPlayed=false;rules.combatResolved=false;state.battlefield.forEach(c=>{c._tapped=false;c._attacking=false;c._attackTappedByRules=false});logRules(`Turn ${state.turn}: untap step.`)}
    if(phase()==='Draw'){draw(false);logRules(`Draw step: drew a card.`)}
    if(phase()==='Main 1')logRules(`Main phase. Land play available: ${rules.landPlayed?'no':'yes'}.`);
    renderGame();
  }

  function addAction(parent,label,cls,fn,disabled=false){const b=document.createElement('button');b.className=`btn ${cls||'secondary'}`;b.textContent=label;b.disabled=disabled;b.onclick=()=>{if(disabled)return;fn();document.getElementById('cardDialog').close()};parent.append(b);return b}
  function addReason(parent,text){const d=document.createElement('div');d.className='rules-action-reason';d.textContent=text;parent.append(d)}
  function rulesOpenCard(c,zone){
    state.selected={c,zone};$('#modalImg').src=cardImage(c);$('#modalTitle').textContent=c.name;$('#modalText').textContent=`${c.type_line||''}\n${cardOracle(c)}`;const a=$('#modalActions');a.innerHTML='';
    if(zone==='hand'){
      if(isLand(c)){
        const ok=inMain()&&!rules.landPlayed;addAction(a,'Play Land','green',()=>playLand(c),!ok);if(!ok)addReason(a,!inMain()?'Land plays require a main phase.':'One land has already been played this turn.');
      }else{
        const cost=parseCost(c),timing=canCastTiming(c),plan=planAutoPay(cost),unsupported=cost.unsupported.length>0;addAction(a,`Cast ${c.mana_cost||'{0}'} · Auto-pay`,'green',()=>castFromHand(c),!timing||plan===null||unsupported);
        if(unsupported)addReason(a,`Unsupported mana symbol(s): ${cost.unsupported.map(x=>`{${x}}`).join(' ')}.`);else if(!timing)addReason(a,'This spell is not legal in the current phase.');else if(plan===null)addReason(a,'Not enough untapped mana sources are available.');else if(plan.length)addReason(a,`Will automatically tap ${plan.length} mana source${plan.length===1?'':'s'}.`);else addReason(a,'Uses mana already floating in your pool.');
      }
    }else if(zone==='battlefield'){
      const abs=manaAbilities(c);if(abs.length){if(canUseTapAbility(c))abs.forEach(ab=>addAction(a,ab.label,'green',()=>tapForMana(c,ab)));else addReason(a,c._tapped?'This permanent is tapped.':'Summoning sickness prevents this tap ability.')}
      if(isCreature(c) && phase()==='Combat')addAction(a,c._attacking?'Cancel Attack':'Attack','secondary',()=>toggleAttack(c),!c._attacking&&!eligibleAttacker(c));
      if(c._isCommander)addAction(a,'Return to Command Zone','secondary',()=>returnCommander(c));
      if(!abs.length && !(isCreature(c)&&phase()==='Combat') && !c._isCommander)addReason(a,'No automated battlefield action for this card yet.');
    }else if(zone==='commander-zone'){
      const tax=rules.commanderCasts*2,cost=parseCost(state.commander,tax),plan=planAutoPay(cost),ok=rules.commanderLocation==='command'&&inMain()&&plan!==null&&!cost.unsupported.length;addAction(a,`Cast ${costLabel(state.commander,tax)} · Auto-pay`,'green',castCommander,!ok);
      if(rules.commanderLocation!=='command')addReason(a,'Commander is currently on the battlefield.');else if(!inMain())addReason(a,'Cast this creature commander during a main phase.');else if(plan===null)addReason(a,'Not enough untapped mana sources are available.');else if(plan.length)addReason(a,`Will automatically tap ${plan.length} mana source${plan.length===1?'':'s'}.`);
    }else return original.openCard(c,zone);
    $('#cardDialog').showModal();
  }

  function decorateCards(){
    document.querySelectorAll('#battlefield .mtg-card').forEach((node,i)=>{const c=state.battlefield[i];if(!c)return;if(c._attacking)node.classList.add('rules-attacker');if(isCreature(c)&&c._enteredTurn===state.turn&&!hasKeyword(c,'Haste'))node.classList.add('rules-sick')});
  }
  function ensureRulesUI(){
    if(document.getElementById('rulesPanel'))return;
    const panel=document.createElement('div');panel.id='rulesPanel';panel.className='rules-panel';panel.innerHTML=`<div class="rules-top"><div class="rules-stat"><div class="k">Training Opponent</div><div class="v" id="rulesOppLife">40 life</div></div><div class="rules-stat"><div class="k">Land Play</div><div class="v" id="rulesLand">Available</div></div></div><div class="rules-phase"><div><strong id="rulesPhase">Main 1</strong><br><span id="rulesPhaseHint">Cast sorceries and play a land.</span></div><button class="tool" id="rulesNext">Next Phase</button></div><div class="tiny">Mana Pool</div><div class="mana-row" id="manaRow"></div><div class="rules-actions"><button class="tool" id="resolveCombat" style="display:none">Resolve Attack</button></div><div class="rules-note">v0.2.1 auto-taps mana sources when you cast. Manual mana tapping remains available for advanced plays. Individual card rules text, triggered abilities, spell effects, blockers, the stack, and opponent AI are not automated yet.</div>`;
    document.querySelector('.game-top').after(panel);document.getElementById('rulesNext').onclick=advancePhase;document.getElementById('resolveCombat').onclick=()=>resolveCombat(false);
    const phaseTiny=document.querySelector('.turnbox .tiny:last-of-type');if(phaseTiny)phaseTiny.style.display='none';const nt=document.getElementById('nextTurn');if(nt)nt.style.display='none';['drawBtn','untapBtn','shuffleBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none'});
  }
  function phaseHint(){switch(phase()){case'Untap':return'Permanents untap automatically.';case'Upkeep':return'Upkeep triggers are not automated yet.';case'Draw':return'A card is drawn automatically.';case'Main 1':case'Main 2':return'Play a land and tap Cast — mana sources are selected automatically.';case'Combat':return'Tap an eligible creature, choose Attack, then Resolve Attack.';case'End':return'Mana empties when you leave the phase.';default:return''}}
  function updateRulesUI(){
    ensureRulesUI();$('#rulesOppLife').textContent=`${rules.opponentLife} life`;$('#rulesLand').textContent=rules.landPlayed?'Used':'Available';$('#rulesLand').className=`v ${rules.landPlayed?'rules-bad':'rules-good'}`;$('#rulesPhase').textContent=phase();$('#rulesPhaseHint').textContent=phaseHint();
    const row=$('#manaRow');row.innerHTML='';MANA.forEach(k=>{const d=document.createElement('div');d.className='mana-chip';d.dataset.zero=rules.mana[k]?0:1;d.innerHTML=`${k} <b>${rules.mana[k]}</b>`;row.append(d)});const rb=$('#resolveCombat');const n=state.battlefield.filter(c=>c._attacking).length;rb.style.display=phase()==='Combat'?'block':'none';rb.textContent=n?`Resolve Attack (${n})`:'Resolve Attack';rb.disabled=!n;
    decorateCards();
  }

  function rulesRenderGame(){original.renderGame();if(rules.active)updateRulesUI()}
  function rulesStartGame(){
    rules.active=false;original.startGame();rules.active=true;rules.phaseIndex=3;rules.landPlayed=false;rules.opponentLife=40;rules.commanderCasts=0;rules.commanderLocation='command';clearMana();state.battlefield.forEach(c=>{c._enteredTurn=0;c._summoningSick=false});logRules('v0.2.1 Rules Test started in Main 1. Play one land, then tap the card you want to cast — mana sources auto-pay when possible.');renderGame();
  }

  openCard=function(c,zone){if(rules.active&&['hand','battlefield','commander-zone'].includes(zone))return rulesOpenCard(c,zone);return original.openCard(c,zone)};
  renderGame=rulesRenderGame;startGame=rulesStartGame;
  const start=document.getElementById('startBtn');if(start)start.onclick=startGame;
  const back=document.getElementById('backBtn');if(back){const old=back.onclick;back.onclick=()=>{rules.active=false;const rp=document.getElementById('rulesPanel');if(rp)rp.remove();['drawBtn','untapBtn','shuffleBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=''});const nt=document.getElementById('nextTurn');if(nt)nt.style.display='';if(old)old()}}
})();