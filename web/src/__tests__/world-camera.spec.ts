import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {occlusionDistance,recoverDistance} from '../app/world/cameraRig';
describe('third person camera clearance',()=>{
 it('contracts immediately and recovers independently of frame rate',()=>{expect(recoverDistance(8,2,.016)).toBe(2);let a=2,b=2;for(let i=0;i<60;i++)a=recoverDistance(a,8,1/60);for(let i=0;i<30;i++)b=recoverDistance(b,8,1/30);expect(a).toBeCloseTo(b,8);expect(a).toBeLessThan(8);});
 it('detects a narrow obstruction missed by the center ray',()=>{const wall=new THREE.Mesh(new THREE.BoxGeometry(.12,2,.2),new THREE.MeshBasicMaterial());wall.position.set(.16,1,3);wall.updateMatrixWorld();const d=occlusionDistance(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),8,[wall]);expect(d).toBeLessThan(3);expect(d).toBeGreaterThan(2);wall.geometry.dispose();wall.material.dispose();});
 it('leaves the requested distance in empty space',()=>{expect(occlusionDistance(new THREE.Vector3(),new THREE.Vector3(0,0,1),8,[])).toBe(8);});
});
