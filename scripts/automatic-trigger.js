import {collectFullCharacterData} from './details-export.js';
const ID='foundry-pf2e-export';
const BASE='https://durval-world.sparked.network/integration/foundry/auto-sync';
let busy=false, lastWarning=0;
Hooks.once('init',()=> {
  game.settings.register(ID,'automaticSyncKey',{name:'Automatic sync key',hint:'Optional: Admin-provided automation key for this GM browser. Manual Deploy and Review stay available.',scope:'client',config:true,restricted:true,type:String,default:''});
});
async function request(path,key,body) {
  const response=await fetch(BASE+path,{method:body?'POST':'GET',credentials:'omit',redirect:'error',headers:{Authorization:`Bearer ${key}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(body?120000:15000)});
  if(!response.ok)throw new Error('Automatic sync connection unavailable');
  return response.json();
}
export async function check() {
  if(busy || !game.user?.isGM || game.system.id!=='pf2e')return;
  const key=game.settings.get(ID,'automaticSyncKey');
  if(!key)return;
  busy=true;
  try {
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
