const ID='durval-pantheon';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function prepareDeity(spec,config){
  if(!spec||spec.format!=='durval-deity-v1')throw Error('Use a durval-deity-v1 JSON file.');
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(spec.key??''))throw Error('A stable lowercase deity key is required.');
  const text=(v,label,max=20000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${label} is required (maximum ${max} characters).`);return v.trim();};
  const name=text(spec.name,'Name',100);
  const values=(input,allowed,label,max=100)=>{if(!Array.isArray(input)||input.length>max||input.some(v=>typeof v!=='string'||!allowed.includes(v)))throw Error(`Invalid ${label}.`);return [...new Set(input)];};
  const m=spec.mechanics;if(!m||typeof m!=='object')throw Error('Mechanics are required.');
  const skill=values(m.skills,Object.keys(config.skills),'divine skills',2);
  const weapons=values(m.weapons,[...Object.keys(config.baseWeaponTypes),...Object.keys(config.baseShieldTypes??{})],'favored weapons');
  const primary=values(m.domains,Object.keys(config.deityDomains),'domains');
  const alternate=values(m.alternateDomains,Object.keys(config.deityDomains),'alternate domains');
  const font=values(m.font,['heal','harm'],'font',2);
  const attribute=values(m.attributes,['str','dex','con','int','wis','cha'],'attributes',6);
  let sanctification=null;if(m.sanctification!==null){const s=m.sanctification;if(!s||!['can','must'].includes(s.modal))throw Error('Invalid sanctification.');const what=values(s.what,['holy','unholy'],'sanctification',2);if(!what.length)throw Error('Choose a sanctification or use null.');sanctification={modal:s.modal,what};}
  if(!m.spells||typeof m.spells!=='object'||Array.isArray(m.spells))throw Error('Provide a cleric-spell rank-to-UUID object.');
  const spells={};for(const [rank,uuid]of Object.entries(m.spells)){if(!/^[1-9]$|^10$/.test(rank)||typeof uuid!=='string'||!/^Compendium\.[\w-]+\.[\w-]+\.Item\.[a-zA-Z0-9]{16}$/.test(uuid))throw Error('Cleric spells need valid ranks and compendium Item UUIDs.');spells[rank]=uuid;}
  const lore=text(spec.description,'Description');
  const edicts=text(spec.edicts,'Edicts'),anathema=text(spec.anathema,'Anathema');
  const img=spec.image??'icons/svg/angel.svg';if(typeof img!=='string'||!(img.startsWith('https://')||/^(icons|modules|worlds)\/[\w./-]+$/.test(img))||img.length>2048)throw Error('Use an HTTPS or Foundry image path.');
  return {name,type:'deity',img,ownership:{default:0},flags:{[ID]:{draft:true,importKey:spec.key}},system:{category:'deity',description:{value:lore.split(/\n\s*\n/).map(p=>`<p>${esc(p)}</p>`).join('')+`<h2>Edicts</h2><p>${esc(edicts)}</p><h2>Anathema</h2><p>${esc(anathema)}</p>`,gm:''},publication:{title:'Durval’s World',authors:'',license:'OGL',remaster:true},rules:[],slug:spec.key,traits:{otherTags:[]},skill,weapons,domains:{primary,alternate},font,attribute,spells,sanctification}};
}
export async function checkSpells(data,resolve){for(const [rank,uuid]of Object.entries(data.system.spells)){const spell=await resolve(uuid);if(!spell||spell.type!=='spell')throw Error(`Rank ${rank}: spell reference could not be resolved.`);if(spell.system?.traits?.value?.some(t=>['cantrip','focus'].includes(t)))throw Error(`Rank ${rank}: cleric spells cannot be cantrips or focus spells.`);}}
