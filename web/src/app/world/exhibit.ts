// 전시용 판(마스터플랜 3-3 전시 목록): 걸린 부조는 벽에 자른 사진 대신 작품만 남긴 판을 건다.
// 컷아웃을 종이색 위에 놓고 색만 맞춘다. 그림을 다시 그리지 않는다. 원본은 보관함에 그대로 둔다.
const PAPER = [248, 244, 234] as const;
const MAX_GAIN = 1.35; // 어두운 작품(스크래치 등)을 억지로 밝히지 않는다
const BRIGHT = 0.95;   // 작품 안에서 이 분위의 밝기를 흰색 기준으로 삼는다

/** 알파가 있는 RGBA 화소에 종이색을 깔고 색을 맞춘다. 입력을 바꾸지 않는다 */
export function exhibitPixels(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let seen = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! < 128) continue;
    seen++;
    for (let c = 0; c < 3; c++) hist[c]![rgba[i + c]!]!++;
  }
  const gain = hist.map((h) => {
    let left = seen * BRIGHT, v = 0;
    while (v < 255 && left > h[v]!) left -= h[v++]!;
    return v ? Math.min(MAX_GAIN, Math.max(1, 245 / v)) : 1;
  });
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]! / 255;
    for (let c = 0; c < 3; c++) out[i + c] = rgba[i + c]! * gain[c]! * a + PAPER[c]! * (1 - a);
    out[i + 3] = 255;
  }
  return out;
}

/** 컷아웃 파일 → 벽에 걸 JPEG. 입체가 컷아웃 윤곽을 쓰므로 크기와 비율은 컷아웃과 같게 둔다 */
export async function exhibitBlob(cutout: Blob, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(cutout);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const data = g.getImageData(0, 0, c.width, c.height);
  data.data.set(exhibitPixels(data.data));
  g.putImageData(data, 0, 0);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('blob'))), 'image/jpeg', 0.92));
}
