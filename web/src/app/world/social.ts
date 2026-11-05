// 팀 /v1/town · /neighbors · /visit 계약을 로컬 저장으로 구현한다.
import * as store from './store';
import { DEFAULT_AVATAR, type AvatarConfig } from './avatar';
import type { MuseumStyle } from '../character/names';
export class SocialError extends Error {constructor(public code:'token_invalid'|'conflict'|'not_found',public reason?:'own_family'|'neighbor_full'){super(reason??code);}}
export const SEVEN_DAYS=7*24*60*60*1000;
export const friendsOf=(state:store.SocialData,id:string)=>state.links.filter(p=>p.includes(id)).map(p=>p[0]===id?p[1]:p[0]);
export function createInvite(state:store.SocialData,owner:string,now:number,token:string){if(friendsOf(state,owner).length>=30)throw new SocialError('conflict','neighbor_full');state.invites=state.invites.filter(i=>i.owner!==owner);const i={id:token,owner,token,expiresAt:now+SEVEN_DAYS,used:false};state.invites.push(i);return i;}
export function acceptInvite(state:store.SocialData,family:string,token:string,now:number){const i=state.invites.find(i=>i.token===token);if(!i||i.used||i.expiresAt<=now)throw new SocialError('token_invalid');if(i.owner===family)throw new SocialError('conflict','own_family');const already=friendsOf(state,family).includes(i.owner);if(!already&&(friendsOf(state,family).length>=30||friendsOf(state,i.owner).length>=30))throw new SocialError('conflict','neighbor_full');if(!already)state.links.push([family,i.owner]);i.used=true;return i.owner;}
export function unlink(state:store.SocialData,a:string,b:string){state.links=state.links.filter(p=>!(p.includes(a)&&p.includes(b)));}
export interface PublicBuilding {id:string;child:string;style:MuseumStyle;mine:boolean;avatar:AvatarConfig;avatarImage:Blob|null;online?:boolean}
export interface VisitWork {id:string;title:string;kind:'drawing'|'making';display:Blob;cutout:Blob|null;depth?:Blob|null;room:number;behavior:string}
/** 친구 미술관에서 열 수 있는 창. 친구 작품과 내 설정을 바꾸지 않는 것만 둔다(마스터플랜 3-3) */
export const VISIT_PANELS: ReadonlySet<string> = new Set(['theme', 'help', 'view', 'motion']);
export interface VisitGallery { building:PublicBuilding; works:VisitWork[]; rooms:number[] }
export interface SocialStore {neighbors(family:string):Promise<PublicBuilding[]>;town(family:string):Promise<PublicBuilding[]>;invites(family:string):Promise<Array<{id:string;expiresAt:string}>>;createInvite(family:string):Promise<{id:string;link:string;expiresAt:string}>;cancelInvite(family:string,id:string):Promise<void>;accept(family:string,token:string):Promise<string>;unlink(family:string,id:string):Promise<void>;gallery(family:string,id:string):Promise<VisitGallery>}
let channel:BroadcastChannel|null=null;
function changed(){window.dispatchEvent(new Event('uam-world-social'));if(typeof BroadcastChannel!=='undefined'){channel??=new BroadcastChannel('uam-world-social');channel.postMessage('changed');}}
export function publicAvatar(config:AvatarConfig,image:Blob|null){return config.mode==='image'&&config.imageSource!=='artwork'?{avatar:{...DEFAULT_AVATAR},avatarImage:null}:{avatar:config,avatarImage:image};}
export class LocalSocialStore implements SocialStore {
 private async building(id:string,mine=false):Promise<PublicBuilding>{const a=(await store.listFamilies()).find(a=>a.id===id);if(!a)throw new SocialError('not_found');const p=await store.getPrefs(id);return {id,child:a.child,style:p.building??'column_temple',mine,...publicAvatar(p.avatar,p.avatarImage)};}
 async neighbors(family:string){const ids=await store.socialTransaction(s=>friendsOf(s,family),false);return Promise.all(ids.map(id=>this.building(id)));}
 async town(family:string){return [await this.building(family,true),...await this.neighbors(family)];}
 async invites(family:string){return store.socialTransaction(s=>s.invites.filter(i=>i.owner===family&&!i.used&&i.expiresAt>Date.now()).map(i=>({id:i.id,expiresAt:new Date(i.expiresAt).toISOString()})),false);}
 async createInvite(family:string){const i=await store.socialTransaction(s=>createInvite(s,family,Date.now(),store.newId()+store.newId()));changed();return {id:i.id,link:`${location.origin}/app/world?invite=${i.token}`,expiresAt:new Date(i.expiresAt).toISOString()};}
 async cancelInvite(family:string,id:string){await store.socialTransaction(s=>{const n=s.invites.findIndex(i=>i.id===id&&i.owner===family&&!i.used);if(n<0)throw new SocialError('not_found');s.invites.splice(n,1);});changed();}
 async accept(family:string,token:string){const id=await store.socialTransaction(s=>acceptInvite(s,family,token,Date.now()));changed();return id;}
 async unlink(family:string,id:string){await store.socialTransaction(s=>unlink(s,family,id));changed();}
 async gallery(family:string,id:string){await store.socialTransaction(s=>{if(!friendsOf(s,family).includes(id))throw new SocialError('not_found');},false);const building=await this.building(id),works=await store.listArtworks(id);await store.socialTransaction(s=>{if(!friendsOf(s,family).includes(id))throw new SocialError('not_found');},false);const ages=[...new Set(works.map(a=>a.age))].sort((a,b)=>a-b);return {building,rooms:ages.map((_,i)=>i+1),works:works.map(a=>({id:a.id,title:a.title,kind:a.kind,display:a.display,cutout:a.cutout,room:ages.indexOf(a.age)+1,behavior:a.subject}))};}
}
