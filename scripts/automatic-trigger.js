import {collectFullCharacterData} from './details-export.js';
const ID='foundry-pf2e-export';
const BASE='https://durval-world.sparked.network/integration/foundry/auto-sync';
let busy=false, lastWarning=0;
const CONFIG_ID='DWAutoSyncConfig';
Hooks.once('init',()=> {
  game.settings.register(ID,'automaticSyncEnabled',{name:'Automatic sync for all GMs',hint:'Any connected GM can handle pending sync requests. Manual Deploy and Review stay available.',scope:'world',config:true,type:Boolean,default:true});
  game.settings.register(ID,'automaticSyncKey',{name:'Automatic sync setup key',hint:'Enter once to configure every GM. The saved key is shared through the GM-only Durval automatic sync configuration journal; other GMs can leave this field empty.',scope:'client',config:true,restricted:true,type:String,default:'',onChange:value=>{if(game.ready && game.user?.isGM && value)void saveSharedKey(value).catch(()=>ui.notifications.warn('Could not save shared automatic sync setup.'));}});
});
function sharedConfig() {
  const entry=game.journal.get(CONFIG_ID);
  if(entry && entry.getFlag(ID,'automaticSyncConfig')!==true)throw new Error('Automatic sync configuration ID is already in use. Contact an Admin.');
  return entry;
}
async function saveSharedKey(value) {
  if(!game.user?.isGM)return;
  const key=String(value).trim();
  if(!/^[A-Za-z0-9_-]{32,200}$/.test(key))throw new Error('Invalid automatic sync setup key');
  const entry=sharedConfig();
  if(entry) {
    const page=entry.pages.find(p=>p.name==='Connection key');
    if(!page)throw new Error('Automatic sync configuration page is missing');
    await page.update({'text.content':key});
  } else {
    await JournalEntry.create({_id:CONFIG_ID,name:'Durval automatic sync configuration (GM only)',ownership:{default:0},flags:{[ID]:{automaticSyncConfig:true}},pages:[{name:'Connection key',type:'text',ownership:{default:0},text:{content:key}}]},{keepId:true,renderSheet:false});
  }
}
async function request(path,key,body) {
  const response=await fetch(BASE+path,{method:body?'POST':'GET',credentials:'omit',redirect:'error',headers:{Authorization:`Bearer ${key}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(body?120000:15000)});
  if(!response.ok)throw new Error('Automatic sync connection unavailable');
  return response.json();
}
export async function check() {
  if(busy || !game.user?.isGM || game.system.id!=='pf2e')return;
  if(!game.settings.get(ID,'automaticSyncEnabled'))return;
  busy=true;
  try {
    // Migrate the already-entered 1.0.18 key once; fresh GM browsers need no setup.
    if(!sharedConfig()) {
      const previous=game.settings.get(ID,'automaticSyncKey');
      if(!previous)return;
      await saveSharedKey(previous);
    }
    const key=sharedConfig()?.pages.find(p=>p.name==='Connection key')?.text.content?.trim();
    if(!key)return;
    const state=await request('/status',key);
    if(state.last_status==='uncertain')throw new Error('Automatic sync needs receipt verification; contact an Admin.');
    if(!state.pending || state.last_status==='running')return;
    const actors=collectFullCharacterData();
    if(!actors?.length)return;
    const result=await request('/run',key,{actors,fingerprint:state.fingerprint,cutoff:state.cutoff});
    if(['uncertain','retry'].includes(result.status))throw new Error('Automatic sync could not complete; pending requests remain visible. Contact an Admin if this persists.');
  } catch(error) {
    if(Date.now()-lastWarning>300000) {ui.notifications.warn(error.message || 'Automatic sync could not complete.');lastWarning=Date.now();}
  } finally {busy=false;}
}
Hooks.once('ready',()=>{
  // Login picks up old pending work; periodic checks handle requests arriving later.
  setTimeout(()=>void check(),10000);
  setInterval(()=>void check(),30000);
  window.addEventListener('online',()=>void check());
});
