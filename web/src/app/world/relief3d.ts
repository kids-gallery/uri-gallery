// 보관함용: 저장된 작품(축소본 + 배경 지운 그림)에서 입체를 다시 만들고, GLB로 내보낸다(유스케이스 UC-08).
import * as THREE from 'three';
import { buildRelief, maskFromCutout } from './cutout';
import type { Artwork } from './store';

export async function reliefOf(a: Pick<Artwork, 'display' | 'cutout'>, height = 1): Promise<{ mesh: THREE.Mesh; dispose(): void }> {
  const bmp = await createImageBitmap(a.display);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close?.();
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  let mask = null;
  if (a.cutout) {
    const cb = await createImageBitmap(a.cutout);
    const cc = document.createElement('canvas');
    cc.width = cb.width; cc.height = cb.height;
    cc.getContext('2d')!.drawImage(cb, 0, 0);
    cb.close?.();
    const m = maskFromCutout(cc);
    mask = m.ok ? m : null;
  }
  const mesh = buildRelief(texture, mask, c.width / c.height, { height });
  return {
    mesh,
    dispose() {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      texture.dispose();
    },
  };
}

export async function exportGlb(a: Pick<Artwork, 'display' | 'cutout' | 'title'>): Promise<Blob> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const { mesh, dispose } = await reliefOf(a, 0.3); // 실물 크기에 가깝게 30cm
  mesh.name = a.title || 'artwork';
  try {
    const out = await new GLTFExporter().parseAsync(mesh, { binary: true });
    return new Blob([out as ArrayBuffer], { type: 'model/gltf-binary' });
  } finally {
    dispose();
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeName(s: string) {
  return (s || '작품').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
}

export function extOf(type: string) {
  if (type.includes('png')) return 'png';
  if (type.includes('svg')) return 'svg';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  return 'jpg';
}
