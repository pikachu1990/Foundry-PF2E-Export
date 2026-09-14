import {test} from 'node:test';import assert from 'node:assert/strict';
import {retired,affectedCharacters} from '../scripts/retirement.mjs';import {isHidden} from '../scripts/pantheon.mjs';
const uuid='Compendium.pf2e.deities.Item.abcdefghijklmnop';const p={hidden:[uuid],identities:[{uuid,name:'Example',slug:'example'}]};
test('retired source and source-less copies match',()=>{assert(retired({type:'deity',_stats:{compendiumSource:uuid}},p,isHidden));assert(retired({type:'deity',name:'Example'},p,isHidden));assert(retired({type:'deity',system:{slug:'example'}},p,isHidden));assert(retired({type:'deity',flags:{'durval-pantheon':{sourceUuid:uuid}}},p,isHidden))});
test('unrelated deity and non-deity untouched',()=>{assert(!retired({type:'deity',name:'Other'},p,isHidden));assert(!retired({type:'feat',name:'Example'},p,isHidden))});
test('bulk official retirement and show exception',()=>{const i={type:'deity',_stats:{compendiumSource:uuid}};assert(retired(i,{hideCore:true},isHidden));assert(!retired(i,{hideCore:true,shown:[uuid]},isHidden));});
test('only character deity items affected, including offline-owned characters',()=>{const deity={type:'deity',name:'Example'};const actors=[{type:'character',name:'Offline',items:[deity,{type:'feat',name:'Example'}]},{type:'npc',items:[deity]}];assert.equal(affectedCharacters(actors,p,isHidden).length,1);});
