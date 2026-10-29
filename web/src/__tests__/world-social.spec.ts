import {describe,it,expect} from 'vitest';
import {createInvite,acceptInvite,friendsOf,unlink,SEVEN_DAYS,publicAvatar} from '../app/world/social';
import {DEFAULT_AVATAR} from '../app/world/avatar';
import type {SocialData} from '../app/world/store';
const empty=():SocialData=>({links:[],invites:[]});
describe('local family invitations',()=>{
 it('can be accepted once, with symmetric friendship',()=>{const s=empty();createInvite(s,'a',0,'one');expect(acceptInvite(s,'b','one',1)).toBe('a');expect(friendsOf(s,'a')).toEqual(['b']);expect(friendsOf(s,'b')).toEqual(['a']);expect(()=>acceptInvite(s,'c','one',2)).toThrow('token_invalid');});
 it('expires at exactly seven days',()=>{const s=empty();createInvite(s,'a',0,'one');expect(()=>acceptInvite(s,'b','one',SEVEN_DAYS)).toThrow('token_invalid');});
 it('keeps only one pending invitation and cancel makes it unusable',()=>{const s=empty();createInvite(s,'a',0,'one');createInvite(s,'a',1,'two');expect(s.invites).toHaveLength(1);expect(()=>acceptInvite(s,'b','one',2)).toThrow('token_invalid');s.invites=[];expect(()=>acceptInvite(s,'b','two',2)).toThrow('token_invalid');});
 it('rejects own family',()=>{const s=empty();createInvite(s,'a',0,'one');expect(()=>acceptInvite(s,'a','one',1)).toThrow('own_family');expect(s.invites[0]!.used).toBe(false);});
 it.each(['a','b'])('enforces thirty on either side: %s',side=>{const s=empty();createInvite(s,'a',0,'one');for(let i=0;i<30;i++)s.links.push([side,'x'+i]);expect(()=>acceptInvite(s,'b','one',1)).toThrow('neighbor_full');expect(s.invites[0]!.used).toBe(false);});
 it('keeps an existing friendship and unlink removes both directions',()=>{const s=empty();s.links.push(['a','b']);createInvite(s,'a',0,'one');acceptInvite(s,'b','one',1);expect(s.links).toHaveLength(1);unlink(s,'b','a');expect(friendsOf(s,'a')).toEqual([]);expect(friendsOf(s,'b')).toEqual([]);});
 it('hides uploaded and legacy image avatars from visitors',()=>{const image=new Blob(['photo']);expect(publicAvatar({...DEFAULT_AVATAR,mode:'image',imageSource:'upload'},image).avatarImage).toBeNull();expect(publicAvatar({...DEFAULT_AVATAR,mode:'image',imageSource:undefined},image).avatar.mode).toBe('basic');expect(publicAvatar({...DEFAULT_AVATAR,mode:'image',imageSource:'artwork'},image).avatarImage).toBe(image);});
});
