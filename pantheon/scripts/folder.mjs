export async function pantheonFolder(folders, createFolder) {
  const matches = folders.filter(f => f.type === 'Item' && !f.folder && f.name === 'Durval Pantheon');
  if (matches.length > 1) throw Error('More than one top-level Item folder is named Durval Pantheon. Rename the duplicate before creating a deity.');
  if (matches.length === 1) return matches[0].id;
  const folder = await createFolder({name:'Durval Pantheon',type:'Item',folder:null,sorting:'a'});
  if (!folder?.id) throw Error('Could not create the Durval Pantheon Item folder. No deity was created.');
  return folder.id;
}
