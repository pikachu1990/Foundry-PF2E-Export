const ID='durval-monster-workshop';
const BASE='https://durval-world.sparked.network/integration/foundry/monsters';
let busy=false,lastWarning=0;
export const SCENE_DEFAULTS=Object.freeze({tokenVision:false,fogExploration:false,backgroundColor:'#999999',darkness:0,weather:'',padding:0,shiftX:0,shiftY:0,globalLight:true,grid:{type:1,size:50,distance:5,units:'ft',style:'solidLines',thickness:1,color:'#000000',alpha:0.2}});

export async function sessionFolder(env,path,type,folderId) {
  if(!['Actor','Scene'].includes(type)||!Array.isArray(path)||path.length<2||path.some(n=>typeof n!=='string'||!n.trim()||n.trim().toLowerCase()==='players'))throw Error('Session folder needs a safe existing parent.');
  const list=()=>env.folderList?env.folderList():env.folders;
  let parent=null;
  // Accept a uniquely named existing parent anywhere when the caller supplies just
  // Yushi's Actors/Scenes plus the session name; never invent its ancestors.
  for(let i=0;i<path.length-1;i++) {
    const matches=list().filter(f=>f.type===type&&f.name===path[i]&&(i===0&&path.length===2||(f.folder?.id??f.folder??null)===parent));
    if(matches.length!==1)throw Error('Session parent missing or ambiguous: '+path[i]);
    parent=matches[0].id;
  }
  const name=path.at(-1), matches=list().filter(f=>f.type===type&&f.name===name&&(f.folder?.id??f.folder??null)===parent);
  if(matches.length>1)throw Error('Ambiguous session folder.');
  if(matches.length===1)return matches[0].id;
  if(!/^[a-zA-Z0-9]{16}$/.test(folderId))throw Error('Invalid folder identity.');
  if(list().some(f=>f.id===folderId))throw Error('Folder ID collision.');
  let folder;
  try {folder=await env.createFolder({_id:folderId,name,type,folder:parent,sorting:'a',flags:{[ID]:{sessionPath:path}}},{keepId:true});}
  catch(error){folder=list().find(f=>f.id===folderId);if(!folder)throw error;}
  if(!folder||folder.type!==type||folder.name!==name||(folder.folder?.id??folder.folder??null)!==parent)throw Error('Folder creation needs inspection.');
  return folder.id;
}

export function sceneSource(job,folder) {
  const s=job.scene;
  if(!s||!/^[a-zA-Z0-9]{16}$/.test(s._id)||!s.name||!Number.isInteger(s.width)||!Number.isInteger(s.height)||s.width<200||s.height<200||s.width>16384||s.height>16384)throw Error('Invalid scene data.');
  if(typeof s.image!=='string'||!s.image.startsWith(BASE+'/art/'))throw Error('Map must use Workshop artwork.');
  const merged={...structuredClone(SCENE_DEFAULTS),...structuredClone(s),grid:{...SCENE_DEFAULTS.grid,...s.grid}};
  if(merged.grid.type!==1||!Number.isFinite(merged.grid.size)||merged.grid.size<50||merged.grid.size>1000||!Number.isFinite(merged.grid.distance)||merged.grid.distance<=0)throw Error('Invalid map grid.');
  const levelId='defaultLevel0000';
  const level={_id:levelId,name:'Map',background:{src:s.image,color:merged.backgroundColor},elevation:{bottom:0,top:20},textures:{anchorX:0.5,anchorY:0.5,offsetX:0,offsetY:0,fit:'fill',scaleX:1,scaleY:1,rotation:0}};
  const environment={darknessLevel:merged.darkness,globalLight:{enabled:merged.globalLight}};
  const fog={mode:merged.fogExploration?1:0};
  for(const key of ['image','backgroundColor','darkness','globalLight','fogExploration'])delete merged[key];
  return {...merged,folder,active:false,navigation:true,navName:'',ownership:{default:0},initialLevel:levelId,levels:[level],environment,fog,tokens:[],walls:[],lights:[],sounds:[],tiles:[],drawings:[],notes:[],regions:[],flags:{[ID]:{delivery:job.id}}};
}

export async function ensureThumbnail(scene) {
  if(scene.thumb)return;
  const result=await scene.createThumbnail({format:'image/png',width:300,height:100});
  if(typeof result?.thumb!=='string'||!result.thumb.startsWith('data:image/png'))throw Error('Scene thumbnail generation failed.');
  await scene.update({thumb:result.thumb});
  if(!scene.thumb)throw Error('Scene thumbnail was not saved.');
}

export async function deliverThumbnail(job,env) {
  if(!env.user?.isGM||job.world!==env.world.id)throw Error('Delivery account/world invalid.');
  const scene=env.scenes.get(job.scene._id);
  if(!scene||scene.flags?.[ID]?.delivery!==job.source_job)throw Error('Original Workshop Scene not found; no Scene created.');
  const actual=scene.toObject?scene.toObject():scene;
  const image=scene.initialLevel?.background?.src??actual.levels?.[0]?.background?.src;
  if(image!==job.scene.image)throw Error('Scene background changed; thumbnail repair stopped.');
  await ensureThumbnail(scene);
  return {status:'done',scene_id:scene.id};
}

export async function deliverScene(job,env) {
  if(!env.user?.isGM||job.world!==env.world.id)throw Error('Delivery account/world invalid.');
  const folder=await sessionFolder(env,job.folder,'Scene',job.folder_id);
  const source=sceneSource(job,folder);
  const verify=async scene=>{
    if(scene.flags?.[ID]?.delivery!==job.id)throw Error('Scene ID collision. Nothing overwritten.');
    const actual=scene.toObject?scene.toObject():scene;
    const image=scene.initialLevel?.background?.src??scene.levels?.contents?.[0]?.background?.src??actual.levels?.[0]?.background?.src??actual.background?.src;
    if(actual.width!==source.width||actual.height!==source.height||actual.grid?.size!==source.grid.size||actual.grid?.distance!==source.grid.distance||actual.tokenVision!==source.tokenVision||image!==job.scene.image||(scene.folder?.id??actual.folder)!==folder)throw Error('Scene exists but settings need inspection. No duplicate created.');
    await ensureThumbnail(scene);
    return {status:'done',scene_id:scene.id};
  };
  const prior=env.scenes.get(source._id);
  if(prior){
    if(job.repair_empty_scene){
      const actual=prior.toObject?prior.toObject():prior;
      if(prior.flags?.[ID]?.delivery!==job.id||(prior.folder?.id??actual.folder)!==folder||actual.width!==source.width||actual.height!==source.height||actual.levels?.length!==1||(actual.levels[0].background?.src && actual.levels[0].background.src!==job.scene.image)||['tokens','walls','lights','tiles','drawings','notes','regions','sounds'].some(k=>actual[k]?.length))throw Error('Scene is not an untouched empty Workshop delivery; repair stopped.');
      await prior.updateEmbeddedDocuments('Level',[{_id:actual.levels[0]._id,'background.src':job.scene.image,'background.color':source.levels[0].background.color}]);
      await prior.update({'environment.globalLight.enabled':source.environment.globalLight.enabled,'environment.darknessLevel':source.environment.darknessLevel,'fog.mode':source.fog.mode});
    }
    return verify(prior);
  }
  // Validate before create, never activate or change the GM's current view.
  const data=env.prepareScene?await env.prepareScene(source):source;
  let created;
  try {created=await env.createScene(data,{keepId:true,renderSheet:false});}
  catch(error){const found=env.scenes.get(source._id);if(found)return verify(found);throw error;}
  if(!created)throw Error('Foundry did not confirm Scene creation.');
  return verify(created);
}

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
  if(job.kind==='scene_thumbnail')return deliverThumbnail(job,env);
  if(job.kind==='scene')return deliverScene(job,env);
  if(!env.user?.isGM||job.world!==env.world.id||job.actor?.type!=='npc')throw Error('Delivery account, world or NPC type is invalid.');
  if(!/^[a-zA-Z0-9]{16}$/.test(job.actor._id)||job.actor.flags?.[ID]?.delivery!==job.id)throw Error('Invalid delivery identity.');
  const folder=job.create_folder?await sessionFolder(env,job.folder,'Actor',job.folder_id):resolveFolder(env.folders,job.folder);
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
    const identity={world:game.world.id,user:game.user.id,version:`${game.version} / PF2e ${game.system.version} / Workshop 1.1.2`,session_delivery:3};
    const state=await request('/poll',key,identity);
    if(!state.job)return;
    let result;
    try {
      result=await deliver(state.job,{user:game.user,world:game.world,folders:game.folders.contents,folderList:()=>game.folders.contents,actors:game.actors,scenes:game.scenes,create:(data,options)=>Actor.implementation.create(data,options),createFolder:(data,options)=>Folder.implementation.create(data,options),createScene:(data,options)=>Scene.implementation.create(data,options),prepareScene:data=>{const migrated=Scene.implementation.migrateData(structuredClone(data));const preview=new Scene.implementation(migrated,{strict:true});preview.validate({strict:true});return preview.toObject();}});
    } catch(error) {result={status:'error',message:String(error.message??'Import needs inspection.').slice(0,400)}; console.warn('Durval Monster Workshop:',error);}
    // Failed acknowledgements remain leased for reconciliation, rather than inventing a failure receipt.
    await request('/ack',key,{...identity,...result,id:state.job.id,lease:state.lease});
    if(result.status==='done')ui.notifications.info(`Monster Workshop: ${(state.job.scene??state.job.actor).name} delivered to ${state.job.folder.join(' / ')}.`);
    else ui.notifications.warn('Monster Workshop: import needs inspection. Contact Moshe; no automatic repeat.');
  } catch(error) {
    if(Date.now()-lastWarning>300000){ui.notifications.warn(error.message);lastWarning=Date.now();}
  } finally {busy=false;}
}

if(typeof Hooks!=='undefined') {
  Hooks.once('init',()=>{
    game.settings.register(ID,'enabled',{name:'Receive requested session content',hint:'Receives queued NPCs and battle maps in session folders for the configured account and world. Maps are never activated automatically.',scope:'client',config:true,restricted:true,type:Boolean,default:true});
    game.settings.register(ID,'key',{name:'Private workshop setup key',hint:'Moshe: enter your private key once in your own GM browser. Leave empty on other accounts. Do not share unless access is deliberately expanded.',scope:'client',config:true,restricted:true,type:String,default:''});
  });
  Hooks.once('ready',()=>{setTimeout(()=>void check(),5000);setInterval(()=>void check(),20000);window.addEventListener('online',()=>void check());});
}
