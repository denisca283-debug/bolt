import test from 'node:test';
import assert from 'node:assert/strict';
import { canOfferOrganizationRole as can } from '../src/lib/organizationRoles.ts';
test('role UX mirrors privileged transitions and prevents self/last-owner changes',()=>{
 for(const role of ['owner','admin','finance']){assert.equal(can('admin',role),false);assert.equal(can('admin','member',role),false);}
 assert.equal(can('admin','producer','member'),true);
 assert.equal(can('owner','admin'),true);assert.equal(can('owner','owner'),false);
 assert.equal(can('owner','owner','member'),true);assert.equal(can('owner','member','owner',false,true),false);
 assert.equal(can('admin','producer','admin',true),false);assert.equal(can('member','producer'),false);
});
