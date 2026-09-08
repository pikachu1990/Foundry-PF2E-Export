const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const source = fs.readFileSync(__dirname + '/scripts/details-export.js', 'utf8');
function setup() {
  const hooks = {};
  const character = {type:'character', name:'Test', uuid:'Actor.abcdefghijklmnop',
    system:{details:{level:{value:1}},currency:{gp:20}, skills:{ath:{label:'Athletics'}}},
    skills:{ath:{mod:7}}, items:['ancestry','heritage','background','class'].map(type=>({type,name:type}))};
  const folders = [{name:'Players',type:'Actor',contents:[character,{type:'npc',name:'Excluded'}]},
    {name:'Other',type:'Actor',contents:[{...character,name:'Other character'}]}];
  let calls = 0;
  const context = vm.createContext({console:{log(){},warn(){}},URL,setTimeout,clearTimeout,AbortController,
    Hooks:{once(){},on(name,fn){hooks[name]=fn;}},ui:{notifications:{warn(){}}},game:{user:{isGM:true},world:{id:'test-world'},folders},
    fetch:async (url, options)=>{calls++; assert.equal(options.redirect,'error');
      assert.equal(options.credentials,'omit');
      return {ok:true,json:async()=>({snapshot_id:'a'.repeat(64),status:'pending_review',sheets_updated:false,characters:1})};}});
  vm.runInContext(source,context);
  return {context,calls:()=>calls,hooks};
}
test('plain and V14 paragraph commands are intercepted exactly once without posting or uploading',()=>{
  for (const name of ['sendcharacters','deploycharacters','exportcharacters']) {
    for (const message of [`/${name}`,`<p>/${name}</p>`,` <p class="chat"> /${name.toUpperCase()} <br></p> `]) {
      const {context,hooks,calls}=setup();
      vm.runInContext('globalThis.opened=0; globalThis.direct=false; showSendForReview=(deploy=false)=>{opened++;direct=deploy}; exportFullCharacterData=()=>{opened++}',context);
      assert.equal(hooks.chatMessage(null,message,{}),false);
      assert.equal(context.opened,1);assert.equal(calls(),0);
      assert.equal(context.direct,name==='deploycharacters');
    }
  }
});

test('review and deploy dialogs require confirmation and send distinct explicit modes',async()=>{
  for (const deploy of [false,true]) {
    const {context,calls}=setup();
    const dialogs=[];
    context.Dialog=class {constructor(options){dialogs.push(options);} render(){return this;}};
    context.ui.notifications.info=()=>{};
    context.ui.notifications.error=message=>{throw Error(message);};
    let url;
    context.fetch=async endpoint=>{url=endpoint;return {ok:true,json:async()=>({snapshot_id:'a'.repeat(64),status:'pending_review',sheets_updated:false})};};
    vm.runInContext(`showSendForReview(${deploy})`,context);
    assert.equal(url,undefined);assert.equal(dialogs[0].default,'cancel');
    assert.equal(dialogs[0].buttons.send.label,deploy?'Update Google Sheets':'Send for review');
    await dialogs[0].buttons.send.callback({find:selector=>({val:()=>selector.includes('receiver')?'https://example.com':'u'.repeat(40)})});
    assert.equal(url,'https://example.com/integration/foundry/snapshots'+(deploy?'?deploy=true':'?review_only=true'));
    assert.equal(dialogs.length,2);
  }
});

test('players cannot open either upload dialog',()=>{
  const {context}=setup();context.game.user.isGM=false;
  context.Dialog=class {constructor(){throw Error('must not open');}};
  vm.runInContext('showSendForReview();showSendForReview(true)',context);
});
test('normal messages, other commands and embedded examples remain untouched',()=>{
  const {context,hooks}=setup();
  vm.runInContext('showSendForReview=()=>{throw Error("unexpected")}; exportFullCharacterData=showSendForReview',context);
  for(const message of ['hello','/roll 1d20','<p>hello</p>','<p>/sendcharacters extra</p>','<p>/sendcharacters</p><p>extra</p>','<blockquote>/sendcharacters</blockquote>','<p><code>/sendcharacters</code></p>',null]) {
    assert.equal(hooks.chatMessage(null,message,{}),undefined);
  }
});
test('collects only character actors directly in Players',()=>{
  const {context,calls} = setup();
  const data = JSON.parse(JSON.stringify(vm.runInContext('collectFullCharacterData()',context)));
  assert.equal(data.length,1); assert.equal(data[0].name,'Test');
  assert.equal(data[0].actor_uuid,'Actor.abcdefghijklmnop'); assert.equal(data[0].world_id,'test-world');
  assert.equal(data[0].totalwealth,20); assert.equal(data[0].skills.Athletics,7);
  assert.equal(calls(),0);
});
test('rejects HTTP and personal links',()=>{
  const {context} = setup();
  for (const url of ['http://example.com','https://example.com/sheet/private','https://user:pass@example.com']) {
    assert.throws(()=>vm.runInContext(`reviewEndpoint(${JSON.stringify(url)})`,context));
  }
});
test('only rare and unique equipment is listed; every rarity still counts in wealth',()=>{
  const {context}=setup();
  const actor=context.game.folders[0].contents[0];
  actor.items.push(...[
    ['Common sword','common','weapon',10,1],
    ['Uncommon wand','uncommon','equipment',20,2],
    ['Rare potion','rare','consumable',30,2],
    ['Unique shield','unique','shield',40,1],
    ['Rare bag','rare','backpack',50,1]
  ].map(([name,rarity,type,gp,quantity])=>({name,type,system:{traits:{rarity},price:{value:{gp}},quantity}})));
  actor.items.push({name:'Rare ancestry',type:'ancestry',rarity:'rare'});
  const data=JSON.parse(JSON.stringify(vm.runInContext('collectFullCharacterData()',context)))[0];
  assert.equal(data.items_scope,'rare+');
  assert.deepEqual(data.items,['2*Rare potion','Unique shield','Rare bag']);
  assert.equal(data.totalwealth,220);
  assert.equal(data.skills.Athletics,7);
});
test('GM upload returns a review receipt; player upload is blocked',async()=>{
  const {context,calls} = setup();
  const result=await vm.runInContext(`uploadForReview(reviewEndpoint('https://example.com'), 'u'.repeat(40), collectFullCharacterData())`,context);
  assert.equal(result.sheets_updated,false); assert.equal(calls(),1);
  context.game.user.isGM=false;
  await assert.rejects(vm.runInContext(`uploadForReview('https://example.com', 'u'.repeat(40), [{}])`,context));
  assert.equal(calls(),1);
});
test('custom artifact trait remains restricted even with a common rarity',()=>{
  const {context}=setup();
  context.game.folders[0].contents[0].items.push({name:'Custom Artifact',type:'equipment',rarity:'common',system:{traits:{value:['artifact']},price:{value:{gp:1000}},quantity:1}});
  const result=JSON.parse(JSON.stringify(vm.runInContext('collectFullCharacterData()',context)))[0];
  assert.deepEqual(result.items,['Custom Artifact']);assert.equal(result.totalwealth,1020);
});

test('receipt distinguishes review, applied, no-change and uncertainty',()=>{
  const {context}=setup();
  for(const [status,sheets_updated,pattern] of [['pending_review',false,/manual review/],['review_required',false,/manual review/],['applied',true,/update confirmed/],['applied',false,/no Sheets changes/],['uncertain',null,/could not be confirmed/]]) {
    context.receipt={status,sheets_updated};
    assert.match(vm.runInContext('uploadOutcome(receipt)',context),pattern);
  }
});
