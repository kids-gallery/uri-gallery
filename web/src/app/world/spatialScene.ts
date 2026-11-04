import * as THREE from 'three';
import { worldUV } from './materials';
import type { ThemeManager } from './themes';
import type { SpatialLayout } from './spatialLayout';
import { buildToyRoom } from './toyRoom';
import { buildBlockRoom, buildForestSurround } from './modeBackdrop';
export function buildSpatialScene(layout:SpatialLayout,mats:ThemeManager['mats'],mode='classic'){
  const root=new THREE.Group(),floors:THREE.Mesh[]=[],walls:THREE.Mesh[]=[],camera:THREE.Mesh[]=[];
  root.name='mode-architecture';
  const landscape=new THREE.MeshStandardMaterial({color:mode==='forest'?'#61784b':mode==='toy'?'#ad8055':mode==='block'?'#a97c50':'#8d9291',roughness:.95});
  const foliage=new THREE.MeshStandardMaterial({color:'#426d42',roughness:.9});
  root.userData.ownedMaterials=[landscape,foliage];
  try{
    for(const p of layout.pieces){
      const geo=p.kind==='cylinder'?new THREE.CylinderGeometry(p.w/2,p.w/2,p.h,40):p.kind==='cone'?new THREE.ConeGeometry(p.w/2,p.h,12):new THREE.BoxGeometry(p.w,p.h,p.d);
      const mesh=new THREE.Mesh(worldUV(geo),p.material==='landscape'?landscape:p.material==='foliage'?foliage:mats[p.material]);mesh.position.set(p.x,p.y,p.z);mesh.rotation.set(0,p.yaw??0,p.roll??0);mesh.receiveShadow=true;mesh.castShadow=!p.floor;
      root.add(mesh);if(p.floor){mesh.userData.floor=true;floors.push(mesh);}else{walls.push(mesh);camera.push(mesh);}
    }
    // 모드마다 공간 안에 있는 느낌을 준다(마스터플랜 3-3 #137). 걷는 길과 충돌에는 영향이 없다
    const table=layout.pieces.find(p=>p.material==='landscape'&&p.w>40);
    const bounds=table&&{minX:table.x-table.w/2,maxX:table.x+table.w/2,minZ:table.z-table.d/2,maxZ:table.z+table.d/2};
    const around=mode==='toy'&&bounds?buildToyRoom(bounds):mode==='block'&&bounds?buildBlockRoom(bounds):mode==='forest'?buildForestSurround():null;
    if(around){root.add(around.group);root.userData.ownedMaterials.push(...around.materials);root.userData.ownedTextures=around.textures;}
    root.updateMatrixWorld(true);
  }catch(e){disposeSpatialScene(root);throw e;}
  return {root,floors,walls,camera};
}
export function disposeSpatialScene(root:THREE.Object3D){root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});for(const m of root.userData.ownedMaterials??[])m.dispose();for(const t of root.userData.ownedTextures??[])t.dispose();root.removeFromParent();}
