import {deityIdentity,retired,affectedCharacters} from './retirement.mjs';
import {prepareDeity,checkSpells} from './deity-data.mjs';
export const ID='durval-pantheon';
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function isHidden(uuid,policy={},draft=false){
  if(draft)return true;
  if((policy.hidden??[]).includes(uuid))return true;
  if((policy.shown??[]).includes(uuid))return false;
  return !!policy.hideCore && uuid.startsWith('Compendium.pf2e.');
}
export function setVisibility(policy,uuid,visible){
  return {...policy,hidden:[...new Set([...(policy.hidden??[]).filter(x=>x!==uuid),...(!visible?[uuid]:[])])],shown:[...new Set([...(policy.shown??[]).filter(x=>x!==uuid),...(visible?[uuid]:[])])]};
}
export function draftData(name){
  name=String(name??'').trim();if(!name||name.length>100)throw Error('Use a deity name of 1–100 characters.');
  return {name,type:'deity',img:'icons/svg/angel.svg',ownership:{default:0},flags:{[ID]:{draft:true}},system:{category:'deity',description:{value:'<p>Draft deity. Configure and review the native deity details before publishing. No mechanics have been assigned.</p>',gm:''},publication:{title:'Durval’s World',authors:'',license:'OGL',remaster:true},rules:[],slug:null,traits:{otherTags:[]},font:[],attribute:[],skill:[],weapons:[],spells:{},domains:{primary:[],alternate:[]},sanctification:null}};
}
const pickers=new Map();let reconciliation=null;let recheckRequested=false;let Manager;let manager;let createBusy=false;
const policy=()=>game.settings.get(ID,'policy');
function requireGM(){if(!game.user?.isGM)throw Error('Only a GM may manage the Pantheon.');}
function uuidDraft(uuid){const m=/^Item\.([^.]+)$/.exec(uuid);return !!(m&&game.items.get(m[1])?.getFlag(ID,'draft'));}
function refreshPickers(){for(const [app,entry]of pickers){if(!entry.root.isConnected){entry.observer.disconnect();pickers.delete(app);}else entry.apply();}}
function installPicker(app,element){
  if(app.options?.itemType!=='deity')return;
  const root=element?.querySelectorAll?element:element?.[0]??app.element;
  if(!root?.querySelectorAll)return;
  pickers.get(app)?.observer.disconnect();
  const apply=()=>{
    const current=policy();let count=0;
    for(const row of root.querySelectorAll('li[data-uuid]')){const hidden=isHidden(row.dataset.uuid,current,uuidDraft(row.dataset.uuid));row.classList.toggle('dw-pantheon-hidden',hidden);if(hidden)count++;}
    let note=root.querySelector('.dw-pantheon-filter-note');
    if(!note){note=document.createElement('p');note.className='dw-pantheon-filter-note';(root.querySelector('header.search')??root.querySelector('.window-content')??root).append(note);}
    const message=count?`${count} campaign-hidden or draft ${count===1?'deity':'deities'}. Manage choices in Module Settings → Pantheon manager.`:'';
    if(note.textContent!==message)note.textContent=message;
    note.hidden=!count;
  };
  const observer=new MutationObserver(apply);observer.observe(root,{childList:true,subtree:true});
  // PF2e retains ownership of selection and actor changes. This only hides rows.
  if(!root.dataset.dwPantheonBound){root.addEventListener('click',e=>{const row=e.target.closest('li[data-uuid]');if(row&&isHidden(row.dataset.uuid,policy(),uuidDraft(row.dataset.uuid))){e.preventDefault();e.stopImmediatePropagation();}},true);root.dataset.dwPantheonBound='true';}
  pickers.set(app,{root,observer,apply});apply();
}
async function gather(){
  const rows=game.items.filter(i=>i.type==='deity').map(i=>({uuid:i.uuid,name:i.name,img:i.img,source:'World item',slug:i.system?.slug??'',draft:!!i.getFlag(ID,'draft'),world:true}));
  for(const pack of game.packs){
    if(pack.documentName!=='Item'||!pack.testUserPermission(game.user,'LIMITED'))continue;
    const index=await pack.getIndex({fields:['type','system.slug']});
    for(const i of index)if(i.type==='deity')rows.push({uuid:i.uuid??`Compendium.${pack.collection}.Item.${i._id}`,name:i.name,img:i.img,source:pack.title,slug:i.system?.slug??'',draft:false,world:false});
  }
  return rows.sort((a,b)=>a.name.localeCompare(b.name));
}
async function createDraft(name){
  requireGM();if(createBusy)throw Error('A deity draft is already being created.');createBusy=true;
  try{const data=draftData(name);const existing=game.items.find(i=>i.type==='deity'&&i.name.trim().toLocaleLowerCase()===data.name.toLocaleLowerCase());if(existing){existing.sheet.render(true);return existing;}
    const item=await Item.create(data);item.sheet.render(true);return item;
  }finally{createBusy=false;}
}
export async function importDeity(spec){
  requireGM();if(createBusy)throw Error('A deity operation is already in progress.');createBusy=true;
  try{
    const data=prepareDeity(spec,CONFIG.PF2E);
    const existing=game.items.find(i=>i.type==='deity'&&i.getFlag(ID,'importKey')===spec.key);
    if(existing){existing.sheet.render(true);ui.notifications.info('This deity was already imported. Opened the existing entry without overwriting it.');return existing;}
    if(game.items.some(i=>i.type==='deity'&&i.name.trim().toLocaleLowerCase()===data.name.toLocaleLowerCase()))throw Error('A world deity already has this name. Edit or delete that entry first; it was not overwritten.');
    await checkSpells(data,fromUuid);
    const item=await Item.create(data);item.sheet.render(true);refreshPickers();return item;
  }finally{createBusy=false;}
}
async function changeAvailability(next){
  requireGM();const library=await gather();
  next.identities=[...new Map([...(policy().identities??[]),...library.map(r=>({uuid:r.uuid,name:r.name,slug:r.slug}))].map(i=>[i.uuid,i])).values()];next.executor=game.user.id;next.enforce=true;
  const affected=affectedCharacters(game.actors.contents,next,isHidden);
  const newlyRetired=next.hideCore&&!policy().hideCore||(next.hidden??[]).some(u=>!(policy().hidden??[]).includes(u));
  if(newlyRetired||affected.length){const names=[...new Set(affected.map(x=>x.actor.name))];const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Retire campaign deities?'},content:`<p>This clears the deity selection on <strong>${names.length} characters</strong> using retired gods and prevents new selections while this module is active.</p><ul>${names.map(n=>`<li>${escapeHTML(n)}</li>`).join('')}</ul><p>PF2e recalculates its native derived values. Character-specific spell or feat choices may still need review. A private GM recovery journal is saved before removal. Showing a god later will not reassign it.</p>`,yes:{label:'Retire and clear these deities'},no:{label:'Cancel'},defaultYes:false,rejectClose:false});if(!yes)return false;}
  await game.settings.set(ID,'policy',next);await reconcileRetirements();return true;
}
function executor(){const active=game.users?.filter(u=>u.active&&u.isGM)??[];return active.find(u=>u.id===policy().executor)?.id??active.sort((a,b)=>a.id.localeCompare(b.id))[0]?.id;}
async function reconcileRetirements(){
  if(!game.user?.isGM||game.user.id!==executor())return;
  if(reconciliation){recheckRequested=true;return reconciliation;}
  reconciliation=(async()=>{
    const current=policy();if(!current.enforce)return;
    const entries=affectedCharacters(game.actors.contents,current,isHidden);if(!entries.length)return;
    const snapshot=entries.map(({actor,item})=>({actorId:actor.id,actorName:actor.name,item:item.toObject(),status:'pending'}));
    const journal=await JournalEntry.create({name:`Pantheon recovery — ${new Date().toISOString()}`,ownership:{default:0},flags:{[ID]:{recovery:snapshot}},pages:[{name:'Retired deities',type:'text',text:{format:1,content:'<p>Private recovery record. Restore only after reviewing current character state. Each saved deity is kept in this journal’s module flags.</p><pre>'+escapeHTML(JSON.stringify(snapshot,null,2))+'</pre>'}}]});
    if(!journal)throw Error('Could not save the recovery journal; no characters were changed.');
    for(const entry of snapshot){if(game.user.id!==executor())break;const actor=game.actors.get(entry.actorId);const item=actor?.items.get(entry.item._id);if(item&&retired(item,policy(),isHidden)){await actor.deleteEmbeddedDocuments('Item',[item.id]);entry.status='removed';}else entry.status='no longer applicable';await journal.setFlag(ID,'recovery',snapshot);}
    ui.notifications.info(`Pantheon: cleared retired deities from ${new Set(entries.map(e=>e.actor.id)).size} characters. Private recovery journal saved.`);
  })();let succeeded=false;try{const result=await reconciliation;succeeded=true;return result;}finally{reconciliation=null;const again=recheckRequested;recheckRequested=false;if(succeeded&&again)setTimeout(()=>void reconcileRetirements().catch(console.error),0);}
}
function initialize(){
  if(game.system.id!=='pf2e')return;
  const Base=foundry.applications.api.ApplicationV2;
  Manager=class PantheonManager extends Base{
    static DEFAULT_OPTIONS={id:'durval-pantheon-manager',classes:['dw-pantheon-manager'],window:{title:'Durval’s World — Pantheon manager',resizable:true},position:{width:760,height:700}};
    async _prepareContext(){requireGM();return {rows:await gather(),policy:policy()};}
    async _renderHTML(context){
      const p=context.policy;this.rows=context.rows;
      return `<div class="dw-pantheon-content"><p>Create a deity as a private draft, edit its normal PF2e sheet, then publish it when its mechanics are ready.</p><div class="dw-pantheon-tools"><button data-act="new">Create deity draft</button><button data-act="import">Import prepared deity</button><button data-act="refresh">Refresh list</button><button data-act="reconcile">Recheck retirements</button></div><label><input type="checkbox" data-core ${p.hideCore?'checked':''}> Retire official PF2e gods from the campaign</label><p class="dw-help">Retiring a god clears it from existing characters and blocks new selections while this module is active. Affected characters are shown before confirmation. Show makes it available again but does not restore old worshippers.</p><label class="dw-search">Search deities <input type="search" data-search placeholder="Name or source" value="${escapeHTML(this.query??'')}"></label><p data-count role="status"></p><div class="dw-deity-list">${context.rows.map(r=>`<div class="dw-deity-row" data-uuid="${escapeHTML(r.uuid)}" data-name="${escapeHTML((r.name+' '+r.source).toLocaleLowerCase())}"><img src="${escapeHTML(r.img||'icons/svg/angel.svg')}" alt="" loading="lazy"><div><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML(r.source)} · ${r.draft?'Private draft':isHidden(r.uuid,p)?'Retired':'Shown in picker'}</small></div><button data-act="edit">${r.world?'Edit':'View'}</button>${r.world?'<button data-act="remove">Delete…</button>':''}${r.draft?'<button data-act="publish">Publish…</button>':`<button data-act="toggle">${isHidden(r.uuid,p)?'Show':'Retire…'}</button>`}</div>`).join('')}</div><details><summary>How deity mechanics work</summary><p>Use the deity’s native Details tab for divine skill, favored weapon, domains, font, sanctification, attributes and cleric spells. Drag spells onto its cleric-spell list and check each rank. Put edicts and anathema in the description.</p><p>PF2e class features consume these values. Worship alone does not grant free proficiencies or spells. Domain feats and other choices still follow PF2e rules.</p><p>Publishing shares the world deity at Observer permission. Existing characters keep their embedded copy when a source deity is edited. Changing their deity later is a separate, manual character operation.</p></details></div>`;
    }
    _replaceHTML(result,content){content.innerHTML=result;}
    _onRender(context,options){super._onRender(context,options);const root=this.element;root.querySelector('[data-search]').addEventListener('input',e=>{this.query=e.target.value;this.filter();});root.querySelector('[data-core]').addEventListener('change',e=>this.run(async()=>{requireGM();await changeAvailability({...policy(),hideCore:e.target.checked});}));root.querySelector('.dw-pantheon-content').addEventListener('click',e=>{const b=e.target.closest('button[data-act]');if(b)this.run(()=>this.action(b.dataset.act,b.closest('[data-uuid]')?.dataset.uuid));});this.filter();}
    filter(){const q=(this.query??'').trim().toLocaleLowerCase();let count=0;for(const row of this.element.querySelectorAll('.dw-deity-row')){row.hidden=!row.dataset.name.includes(q);if(!row.hidden)count++;}this.element.querySelector('[data-count]').textContent=`${count} deities`;}
    async run(fn){if(this.busy)return;this.busy=true;try{await fn();await this.render({force:true});refreshPickers();}catch(e){console.error('Durval Pantheon:',e);ui.notifications.error(e.message??'Pantheon operation failed. Refresh and check before retrying.');}finally{this.busy=false;}}
    async action(action,uuid){requireGM();const Dialog=foundry.applications.api.DialogV2;
      if(action==='refresh')return;if(action==='reconcile'){await changeAvailability(policy());return;}
      if(action==='new'){const name=await Dialog.prompt({window:{title:'Create deity draft'},content:'<label>Deity name <input name="deityName" maxlength="100" required autofocus></label>',ok:{label:'Create draft',callback:(_event,button)=>button.form.elements.deityName.value},rejectClose:false});if(name)await createDraft(name);return;}
      if(action==='import'){
        const source=await Dialog.prompt({window:{title:'Import prepared deity'},content:'<p>Select the deity JSON file prepared for you. All mechanical fields will be filled automatically. It stays private until you publish it.</p><input name="deityFile" type="file" accept=".json,application/json" required>',ok:{label:'Import deity',callback:async(_event,button)=>{const file=button.form.elements.deityFile.files[0];if(!file)throw Error('Choose a JSON file.');if(file.size>200000)throw Error('Deity file is too large.');return JSON.parse(await file.text());}},rejectClose:false});
        if(source)await importDeity(source);return;
      }
      const item=await fromUuid(uuid);if(!item||item.type!=='deity'||item.parent)throw Error('This deity source is no longer available. Refresh the list.');
      if(action==='edit'){item.sheet.render(true);return;}
      if(action==='remove'){
        if(item.pack)throw Error('Compendium deities are managed with Hide / Show, not deletion.');
        const accepted=await Dialog.confirm({window:{title:`Delete ${item.name}?`},content:'<p>This deletes the world deity source. This god will first be retired and cleared from affected characters. A JSON backup of the world source will be downloaded before deletion.</p><p>To retain the world source while removing its worshippers, cancel and use Retire instead.</p>',yes:{label:'Back up and delete world deity'},no:{label:'Cancel'},defaultYes:false,rejectClose:false});
        if(accepted){if(!await changeAvailability(setVisibility(policy(),uuid,false)))return;await reconcileRetirements();(foundry.utils?.saveDataToFile??globalThis.saveDataToFile)(JSON.stringify(item.toObject(),null,2),'application/json',`deity-backup-${item.id}.json`);await item.delete();ui.notifications.info('World deity deleted. Keep the downloaded backup. Reopen old pickers to refresh their source list.');}return;
      }
      if(action==='toggle'){await changeAvailability(setVisibility(policy(),uuid,isHidden(uuid,policy())));return;}
      if(action==='publish'){
        if(item.pack||!item.getFlag(ID,'draft'))throw Error('Only a world deity draft may be published here.');
        const accepted=await Dialog.confirm({window:{title:`Publish ${item.name}?`},content:'<p>Have you configured and reviewed this deity’s mechanics in its PF2e sheet?</p><p>Publishing makes it visible to players and selectable. It will not change any existing character.</p>',yes:{label:'Mechanics reviewed — publish'},no:{label:'Keep as draft'},defaultYes:false,rejectClose:false});
        if(accepted){await item.update({[`flags.${ID}.draft`]:false,[`flags.${ID}.sourceUuid`]:item.uuid,'ownership.default':CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER});ui.notifications.info(`${item.name} published. Reopen an already-open deity picker to include a newly shared item.`);}return;
      }
    }
  };
  game.settings.register(ID,'policy',{scope:'world',config:false,type:Object,default:{hideCore:false,hidden:[],shown:[]},onChange:()=>{refreshPickers();void reconcileRetirements().catch(e=>{console.error('Pantheon retirement:',e);ui.notifications.error('Pantheon retirement is incomplete. Open the manager and use Recheck retirements. Existing recovery records are preserved.');});}});
  game.settings.registerMenu(ID,'manager',{name:'Pantheon manager',label:'Manage deities',hint:'Create deity drafts, edit native mechanics, and show or hide gods in the character picker.',icon:'fas fa-sun',type:Manager,restricted:true});
  game.modules.get(ID).api={open:()=>{requireGM();manager??=new Manager();return manager.render({force:true});},createDraft,importDeity};
}
if(typeof Hooks!=='undefined'){
  Hooks.once('init',initialize);
  Hooks.on('renderApplicationV2',(app,element)=>{if(game.system.id==='pf2e')installPicker(app,element);});
  Hooks.on('closeApplicationV2',app=>{pickers.get(app)?.observer.disconnect();pickers.delete(app);});
  Hooks.on('preCreateItem',item=>{if(item.parent?.type==='character'&&policy().enforce&&retired(item,policy(),isHidden)){ui.notifications.warn('This deity has been retired from the campaign. Choose another deity.');return false;}});
  Hooks.on('preUpdateItem',(item,change)=>{if(item.type==='deity'&&item.parent?.type==='character'&&policy().enforce){const data=foundry.utils.mergeObject(item.toObject(),foundry.utils.expandObject(change),{inplace:false});if(retired(data,policy(),isHidden)){ui.notifications.warn('This deity has been retired from the campaign.');return false;}}});
  Hooks.once('ready',()=>{if(game.user?.isGM&&policy().enforce)void reconcileRetirements().catch(console.error);});
  Hooks.on('updateUser',()=>{if(game.user?.isGM&&policy().enforce)void reconcileRetirements().catch(console.error);});
  Hooks.on('updateItem',()=>refreshPickers());Hooks.on('deleteItem',()=>refreshPickers());
}
