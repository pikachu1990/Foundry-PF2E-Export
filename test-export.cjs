const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const source = fs.readFileSync(__dirname + '/scripts/details-export.js', 'utf8');
function setup() {
  const character = {type:'character', name:'Test',
    system:{details:{level:{value:1}},currency:{gp:20}, skills:{ath:{label:'Athletics'}}},
    skills:{ath:{mod:7}}, items:['ancestry','heritage','background','class'].map(type=>({type,name:type}))};
  const folders = [{name:'Players',type:'Actor',contents:[character,{type:'npc',name:'Excluded'}]},
    {name:'Other',type:'Actor',contents:[{...character,name:'Other character'}]}];
  let calls = 0;
  const context = vm.createContext({console:{log(){},warn(){}},URL,setTimeout,clearTimeout,AbortController,
    Hooks:{once(){},on(){}},ui:{notifications:{warn(){}}},game:{user:{isGM:true},folders},
    fetch:async (url, options)=>{calls++; assert.equal(options.redirect,'error');
      assert.equal(options.credentials,'omit');
      return {ok:true,json:async()=>({snapshot_id:'a'.repeat(64),sheets_updated:false,characters:1})};}});
  vm.runInContext(source,context);
  return {context,calls:()=>calls};
}
test('collects only character actors directly in Players',()=>{
  const {context,calls} = setup();
  const data = JSON.parse(JSON.stringify(vm.runInContext('collectFullCharacterData()',context)));
  assert.equal(data.length,1); assert.equal(data[0].name,'Test');
  assert.equal(data[0].totalwealth,20); assert.equal(data[0].skills.Athletics,7);
  assert.equal(calls(),0);
});
test('rejects HTTP and personal links',()=>{
  const {context} = setup();
  for (const url of ['http://example.com','https://example.com/sheet/private','https://user:pass@example.com']) {
    assert.throws(()=>vm.runInContext(`reviewEndpoint(${JSON.stringify(url)})`,context));
  }
});
test('GM upload returns a review receipt; player upload is blocked',async()=>{
  const {context,calls} = setup();
  const result=await vm.runInContext(`uploadForReview(reviewEndpoint('https://example.com'), 'u'.repeat(40), collectFullCharacterData())`,context);
  assert.equal(result.sheets_updated,false); assert.equal(calls(),1);
  context.game.user.isGM=false;
  await assert.rejects(vm.runInContext(`uploadForReview('https://example.com', 'u'.repeat(40), [{}])`,context));
  assert.equal(calls(),1);
});
