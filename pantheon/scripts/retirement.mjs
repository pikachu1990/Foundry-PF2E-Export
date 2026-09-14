export function deityIdentity(item){const d=item.toObject?item.toObject():item;return {uuid:item.uuid??'',name:d.name??'',slug:d.system?.slug??''};}
export function retired(item,policy,isHidden){
  if(item.type!=='deity')return false;
  const d=item.toObject?item.toObject():item;
  const sources=[d._stats?.compendiumSource,d.flags?.core?.sourceId,d.flags?.['durval-pantheon']?.sourceUuid].filter(x=>typeof x==='string'&&x);
  if(sources.some(u=>isHidden(u,policy)))return true;
  // Native copies can lose source provenance (or originate from world items).
  // Retired identities also cover those copies and manually dropped duplicates.
  const slug=(d.system?.slug??'').toLocaleLowerCase();const name=(d.name??'').trim().toLocaleLowerCase();
  return (policy.identities??[]).some(i=>isHidden(i.uuid,policy)&&((slug&&i.slug&&slug===i.slug.toLocaleLowerCase())||(name&&name===i.name.trim().toLocaleLowerCase())));
}
export function affectedCharacters(actors,policy,isHidden){return actors.filter(a=>a.type==='character').flatMap(actor=>actor.items.filter(i=>retired(i,policy,isHidden)).map(item=>({actor,item})));}
