import {describe,it,expect} from 'vitest';
import {validateProduction} from '../src/config.js';
const good = {UAM_ENV:'production',UAM_FAKE_MODELS:'0',SECURE_COOKIES:'true',APP_BASE_URL:'https://gallery.example',MAIL_SMTP_URL:'smtps://smtp.example:465',DB_PASSWORD:'d'.repeat(32),SESSION_SECRET:'s'.repeat(32),AUTH_HMAC_SECRET:'h'.repeat(32)};
describe('production startup boundary',()=>{
 it('accepts explicit production config and keeps development compatible',()=>{expect(()=>validateProduction(good)).not.toThrow();expect(()=>validateProduction({})).not.toThrow();});
 for(const patch of [{UAM_FAKE_MODELS:'1'},{UAM_FAKE_MODELS:'M3,M7'},{DEV_ACTIVATE_MODELS:'1'},{SECURE_COOKIES:'false'},{APP_BASE_URL:'http://gallery.example'},{MAIL_SMTP_URL:'smtp://mailpit:1025'},{SESSION_SECRET:'short'},{UAM_ENV:'prod'}]) it(`rejects unsafe settings ${Object.keys(patch)}`,()=>expect(()=>validateProduction({...good,...patch})).toThrow());
});
