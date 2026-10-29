import * as THREE from 'three';
// Independent implementation informed by Roblox's public Popper camera architecture.
// Provenance and differences: docs/개인_이제민/게임구조_리서치.md.
const ray=new THREE.Raycaster();
export function occlusionDistance(target:THREE.Vector3,direction:THREE.Vector3,distance:number,objects:THREE.Object3D[],aspect=1,near=.1,fov=50){
 const halfHeight=Math.max(.16,near*Math.tan(THREE.MathUtils.degToRad(fov)*.5));
 const right=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,direction).normalize();
 let allowed=distance;
 for(const [x,y] of [[0,0],[-1,-1],[1,-1],[-1,1],[1,1]]){
  const origin=target.clone().addScaledVector(right,x!*halfHeight*aspect).addScaledVector(up,y!*halfHeight);
  ray.set(origin,direction);ray.near=.02;ray.far=distance+.18;
  const hit=ray.intersectObjects(objects,false)[0];if(hit)allowed=Math.min(allowed,Math.max(.28,hit.distance-.22));
 }
 return allowed;
}
export function recoverDistance(current:number,allowed:number,dt:number){return allowed<current?allowed:THREE.MathUtils.lerp(current,allowed,1-Math.exp(-7*dt));}

// Adapted from camera-controls getDistanceToFitBox, c51601107e266097edf6a9caa57bfa9eaa77427c.
// Copyright (c) 2017 @yomotsu. MIT: /licenses/camera-controls.txt.
export function distanceToFitArtwork(width:number,height:number,aspect:number,verticalFov:number,depth=0){
 const heightToFit=Math.max(height,width/aspect);
 return heightToFit*.5/Math.tan(THREE.MathUtils.degToRad(verticalFov)*.5)+depth*.5;
}
