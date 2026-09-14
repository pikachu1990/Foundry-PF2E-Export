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
  return {name,type:'deity',img:name==='Durval'?'https://durval-world.sparked.network/lore/art/durval-mortal.png':'icons/svg/angel.svg',ownership:{default:0},flags:{[ID]:{draft:true}},system:{category:'deity',description:{value:'<p>Draft deity. Configure and review the native deity details before publishing. No mechanics have been assigned.</p>',gm:''},publication:{title:'Durval’s World',authors:'',license:'OGL',remaster:true},rules:[],slug:null,traits:{otherTags:[]},font:[],attribute:[],skill:[],weapons:[],spells:{},domains:{primary:[],alternate:[]},sanctification:null}};
}
const pickers=new Map();let Manager;let manager;let createBusy=false;
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
  const rows=game.items.filter(i=>i.type==='deity').map(i=>({uuid:i.uuid,name:i.name,img:i.img,source:'World item',draft:!!i.getFlag(ID,'draft'),world:true}));
  for(const pack of game.packs){
    if(pack.documentName!=='Item'||!pack.testUserPermission(game.user,'LIMITED'))continue;
    const index=await pack.getIndex({fields:['type']});
    for(const i of index)if(i.type==='deity')rows.push({uuid:i.uuid??`Compendium.${pack.collection}.Item.${i._id}`,name:i.name,img:i.img,source:pack.title,draft:false,world:false});
  }
  return rows.sort((a,b)=>a.name.localeCompare(b.name));
}
async function createDraft(name){
  requireGM();if(createBusy)throw Error('A deity draft is already being created.');createBusy=true;
  try{const data=draftData(name);const existing=game.items.find(i=>i.type==='deity'&&i.name.trim().toLocaleLowerCase()===data.name.toLocaleLowerCase());if(existing){existing.sheet.render(true);return existing;}
    const item=await Item.create(data);item.sheet.render(true);return item;
  }finally{createBusy=false;}
}
function initialize(){
  if(game.system.id!=='pf2e')return;
  const Base=foundry.applications.api.ApplicationV2;
  Manager=class PantheonManager extends Base{
    static DEFAULT_OPTIONS={id:'durval-pantheon-manager',classes:['dw-pantheon-manager'],window:{title:'Durval’s World — Pantheon manager',resizable:true},position:{width:760,height:700}};
    async _prepareContext(){requireGM();return {rows:await gather(),policy:policy()};}
    async _renderHTML(context){
      const p=context.policy;this.rows=context.rows;
      return `<div class="dw-pantheon-content"><p>Create a deity as a private draft, edit its normal PF2e sheet, then publish it when its mechanics are ready.</p><div class="dw-pantheon-tools"><button data-act="new">Create deity draft</button><button data-act="durval">Open / create Durval draft</button><button data-act="refresh">Refresh list</button></div><label><input type="checkbox" data-core ${p.hideCore?'checked':''}> Hide official PF2e gods from the character picker</label><p class="dw-help">Individual “Show” choices override this switch. Hidden gods stay on existing characters. This filters the picker only; it is not a security restriction on compendium browsing or drag-and-drop.</p><label class="dw-search">Search deities <input type="search" data-search placeholder="Name or source" value="${escapeHTML(this.query??'')}"></label><p data-count role="status"></p><div class="dw-deity-list">${context.rows.map(r=>`<div class="dw-deity-row" data-uuid="${escapeHTML(r.uuid)}" data-name="${escapeHTML((r.name+' '+r.source).toLocaleLowerCase())}"><img src="${escapeHTML(r.img||'icons/svg/angel.svg')}" alt="" loading="lazy"><div><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML(r.source)} · ${r.draft?'Private draft':isHidden(r.uuid,p)?'Hidden from picker':'Shown in picker'}</small></div><button data-act="edit">${r.world?'Edit':'View'}</button>${r.draft?'<button data-act="publish">Publish…</button>':`<button data-act="toggle">${isHidden(r.uuid,p)?'Show':'Hide'}</button>`}</div>`).join('')}</div><details><summary>How deity mechanics work</summary><p>Use the deity’s native Details tab for divine skill, favored weapon, domains, font, sanctification, attributes and cleric spells. Drag spells onto its cleric-spell list and check each rank. Put edicts and anathema in the description.</p><p>PF2e class features consume these values. Worship alone does not grant free proficiencies or spells. Domain feats and other choices still follow PF2e rules.</p><p>Publishing shares the world deity at Observer permission. Existing characters keep their embedded copy when a source deity is edited. Changing their deity later is a separate, manual character operation.</p></details></div>`;
    }
    _replaceHTML(result,content){content.innerHTML=result;}
    _onRender(context,options){super._onRender(context,options);const root=this.element;root.querySelector('[data-search]').addEventListener('input',e=>{this.query=e.target.value;this.filter();});root.querySelector('[data-core]').addEventListener('change',e=>this.run(async()=>{requireGM();await game.settings.set(ID,'policy',{...policy(),hideCore:e.target.checked});}));root.querySelector('.dw-pantheon-content').addEventListener('click',e=>{const b=e.target.closest('button[data-act]');if(b)this.run(()=>this.action(b.dataset.act,b.closest('[data-uuid]')?.dataset.uuid));});this.filter();}
    filter(){const q=(this.query??'').trim().toLocaleLowerCase();let count=0;for(const row of this.element.querySelectorAll('.dw-deity-row')){row.hidden=!row.dataset.name.includes(q);if(!row.hidden)count++;}this.element.querySelector('[data-count]').textContent=`${count} deities`;}
    async run(fn){if(this.busy)return;this.busy=true;try{await fn();await this.render({force:true});refreshPickers();}catch(e){console.error('Durval Pantheon:',e);ui.notifications.error(e.message??'Pantheon operation failed. Refresh and check before retrying.');}finally{this.busy=false;}}
    async action(action,uuid){requireGM();const Dialog=foundry.applications.api.DialogV2;
      if(action==='refresh')return;
      if(action==='new'){const name=await Dialog.prompt({window:{title:'Create deity draft'},content:'<label>Deity name <input name="deityName" maxlength="100" required autofocus></label>',ok:{label:'Create draft',callback:(_event,button)=>button.form.elements.deityName.value},rejectClose:false});if(name)await createDraft(name);return;}
      if(action==='durval'){await createDraft('Durval');return;}
      const item=await fromUuid(uuid);if(!item||item.type!=='deity'||item.parent)throw Error('This deity source is no longer available. Refresh the list.');
      if(action==='edit'){item.sheet.render(true);return;}
      if(action==='toggle'){await game.settings.set(ID,'policy',setVisibility(policy(),uuid,isHidden(uuid,policy())));return;}
      if(action==='publish'){
        if(item.pack||!item.getFlag(ID,'draft'))throw Error('Only a world deity draft may be published here.');
        const accepted=await Dialog.confirm({window:{title:`Publish ${item.name}?`},content:'<p>Have you configured and reviewed this deity’s mechanics in its PF2e sheet?</p><p>Publishing makes it visible to players and selectable. It will not change any existing character.</p>',yes:{label:'Mechanics reviewed — publish'},no:{label:'Keep as draft'},defaultYes:false,rejectClose:false});
        if(accepted){await item.update({[`flags.${ID}.draft`]:false,'ownership.default':CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER});ui.notifications.info(`${item.name} published. Reopen an already-open deity picker to include a newly shared item.`);}return;
      }
    }
  };
  game.settings.register(ID,'policy',{scope:'world',config:false,type:Object,default:{hideCore:false,hidden:[],shown:[]},onChange:()=>{refreshPickers();}});
  game.settings.registerMenu(ID,'manager',{name:'Pantheon manager',label:'Manage deities',hint:'Create deity drafts, edit native mechanics, and show or hide gods in the character picker.',icon:'fas fa-sun',type:Manager,restricted:true});
  game.modules.get(ID).api={open:()=>{requireGM();manager??=new Manager();return manager.render({force:true});},createDraft};
}
if(typeof Hooks!=='undefined'){
  Hooks.once('init',initialize);
  Hooks.on('renderApplicationV2',(app,element)=>{if(game.system.id==='pf2e')installPicker(app,element);});
  Hooks.on('closeApplicationV2',app=>{pickers.get(app)?.observer.disconnect();pickers.delete(app);});
  Hooks.on('updateItem',()=>refreshPickers());Hooks.on('deleteItem',()=>refreshPickers());
}
