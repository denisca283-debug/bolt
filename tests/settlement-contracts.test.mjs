import test from 'node:test';
import assert from 'node:assert/strict';
import {validateObligation,validateRightsSplit,validatePublicAnchor} from '../src/lib/settlementContracts.ts';
test('obligation preserves exact currency/minor units independently of rail or volatile asset',()=>{
 const obligation={id:'obligation',version:1,amountMinor:18000000n,currency:'RUB',source:{type:'project',id:'p',version:1}};
 validateObligation(obligation);validateObligation({...obligation,amountMinor:9007199254740993n});
 assert.throws(()=>validateObligation({...obligation,amountMinor:18000000}));assert.throws(()=>validateObligation({...obligation,amountMinor:-1n}));
 assert.equal(obligation.amountMinor,18000000n);assert.equal(obligation.currency,'RUB');
});
test('rights allocation is versioned, exact, nonduplicating and totals 10000 integer basis points',()=>{
 const agreement={projectOrContentReference:'p',version:1,effectiveFrom:'2026-09-19',effectiveUntil:null,allocations:[{beneficiaryId:'a',shareBasisPoints:6500},{beneficiaryId:'b',shareBasisPoints:3500}]};
 validateRightsSplit(agreement);
 for(const allocations of [[{beneficiaryId:'a',shareBasisPoints:9999}],[{beneficiaryId:'a',shareBasisPoints:9999.5}],[{beneficiaryId:'a',shareBasisPoints:5000},{beneficiaryId:'a',shareBasisPoints:5000}]])assert.throws(()=>validateRightsSplit({...agreement,allocations}));
});
test('public proof wire format cannot carry identity, private documents, prices or arbitrary network payload',()=>{
 const proof={version:1,algorithm:'SHA-256',commitmentHash:'a'.repeat(64)};
 assert.equal(validatePublicAnchor(proof),true);
 for(const field of ['minorIdentity','dob','email','documentText','sealedBidAmount','supplierId','contractAddress'])assert.equal(validatePublicAnchor({...proof,[field]:'private'}),false);
 assert.equal(validatePublicAnchor({...proof,commitmentHash:'raw private terms'}),false);
});
