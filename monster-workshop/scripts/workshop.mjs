const ID='durval-monster-workshop';
const BASE='https://durval-world.sparked.network/integration/foundry/monsters';
let busy=false,lastWarning=0;

export function resolveFolder(folders,path) {
  if(!Array.isArray(path)||!path.length||path.some(x=>typeof x!=='string'||x.trim().toLowerCase()==='players'))throw Error('An explicit NPC folder is required.');
  let parent=null;
  for(const name of path) {
    const matches=folders.filter(f=>f.type==='Actor'&&f.name===name&&(f.folder?.id??f.folder??null)===parent);
    if(matches.length!==1)throw Error(`Folder missing or ambiguous: ${name}. No NPC was imported.`);
    parent=matches[0].id;
  }
  return parent;
}

export async function deliver(job,env) {
  if(!env.user?.isGM||job.world!==env.world.id||job.actor?.type!=='npc')throw Error('Delivery account, world or NPC type is invalid.');
  if(!/^[a-zA-Z0-9]{16}$/.test(job.actor._id)||job.actor.flags?.[ID]?.delivery!==job.id)throw Error('Invalid delivery identity.');
  const folder=resolveFolder(env.folders,job.folder);
  const verify=actor=>{
    if(actor.type!=='npc'||actor.flags?.[ID]?.delivery!==job.id)throw Error('Actor ID is already in use. Nothing was overwritten.');
    const s=actor.system, expected=job.actor.system;
    if(s.details.level.value!==expected.details.level.value||s.attributes.hp.max!==expected.attributes.hp.max||s.attributes.ac.value!==expected.attributes.ac.value||actor.items.size!==job.actor.items.length)
      throw Error('NPC exists, but prepared statistics need inspection. No repeat import will be attempted.');
    // A receipt lost after creation must recover the existing Actor, never recreate it.
    return {actor_id:actor.id,status:'done'};
  };
  const prior=env.actors.get(job.actor._id);
  if(prior)return verify(prior);
  let created;
  try {created=await env.create({...structuredClone(job.actor),folder},{keepId:true,renderSheet:false});}
  catch(error) {
    const concurrent=env.actors.get(job.actor._id);
    if(concurrent)return verify(concurrent);
    throw error;
  }
  if(!created)throw Error('Foundry did not confirm NPC creation.');
  const result=verify(created);
  return result;
}

async function request(path,key,data) {
  const response=await fetch(BASE+path,{method:'POST',credentials:'omit',redirect:'error',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(response.status===403?'Monster Workshop is assigned to another account or world.':'Monster Workshop connection failed.');
  return response.json();
}

export async function check() {
  if(busy||!game.user?.isGM||game.system.id!=='pf2e'||!game.settings.get(ID,'enabled'))return;
  const key=game.settings.get(ID,'key')?.trim();
  if(!key)return;
  busy=true;
  try {
    const identity={world:game.world.id,user:game.user.id,version:`${game.version} / PF2e ${game.system.version}`};
    const state=await request('/poll',key,identity);
    if(!state.job)return;
    let result;
    try {
      result=await deliver(state.job,{user:game.user,world:game.world,folders:game.folders.contents,actors:game.actors,create:(data,options)=>Actor.implementation.create(data,options)});
    } catch(error) {result={status:'error',message:'Import needs inspection; check target folder and NPC data in Foundry.'}; console.warn('Durval Monster Workshop:',error);}
    // Failed acknowledgements remain leased for reconciliation, rather than inventing a failure receipt.
    await request('/ack',key,{...identity,...result,id:state.job.id,lease:state.lease});
    if(result.status==='done')ui.notifications.info(`Monster Workshop: ${state.job.actor.name} delivered to ${state.job.folder.join(' / ')}.`);
    else ui.notifications.warn('Monster Workshop: import needs inspection. Contact Moshe; no automatic repeat.');
  } catch(error) {
    if(Date.now()-lastWarning>300000){ui.notifications.warn(error.message);lastWarning=Date.now();}
  } finally {busy=false;}
}

if(typeof Hooks!=='undefined') {
  Hooks.once('init',()=>{
    game.settings.register(ID,'enabled',{name:'Receive requested monsters',hint:'Receives only queued monster deliveries for the configured account and world.',scope:'client',config:true,restricted:true,type:Boolean,default:true});
    game.settings.register(ID,'key',{name:'Private workshop setup key',hint:'Moshe: enter your private key once in your own GM browser. Leave empty on other accounts. Do not share unless access is deliberately expanded.',scope:'client',config:true,restricted:true,type:String,default:''});
  });
  Hooks.once('ready',()=>{setTimeout(()=>void check(),5000);setInterval(()=>void check(),20000);window.addEventListener('online',()=>void check());});
}
