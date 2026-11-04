import {it,expect} from 'vitest';
import {safeLogFields,logRequestId} from '../src/lib/logPolicy.js';
it('raw fields cannot copy identities, paths, tokens or nested exception text',()=>{
 for(const secret of ['child@example.test','a'.repeat(64),'/family/private/photo.jpg','아이별칭']) {
  const out=safeLogFields({requestId:secret,event:secret,code:secret,route:secret,method:secret,durationMs:secret,error:{message:secret},msg:secret});
  expect(JSON.stringify(out)).not.toContain(secret);
  expect(out.requestId).toBe(logRequestId(secret));expect(out.event).toBe('unknown');
 }
});
it('keeps reviewed operational categories and route templates',()=>{
 expect(safeLogFields({event:'mail_failed',code:'verify',method:'GET',route:'/v1/artworks/:id',status:503,durationMs:12})).toEqual({event:'mail_failed',code:'verify',method:'GET',route:'/v1/artworks/:id',status:503,durationMs:12});
});
