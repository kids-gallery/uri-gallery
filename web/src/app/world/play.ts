// 작품 퍼즐 판정(3D미술관_재설계 §2-11). 여백이 큰 그림은 빈 조각이 서로 똑같아 보이므로,
// 모양이 같은 조각끼리는 자리를 바꿔도 맞은 것으로 본다. 화면과 떨어진 순수 함수라 단위 시험으로 확인한다.

export const SIGNATURE_CELLS = 6;
export const SAME_TOLERANCE = 8;
export const SHUFFLE_TRIES = 30;

/** RGBA 전체 그림(w×h)을 n×n 조각으로 나누고, 조각마다 cells×cells 칸의 평균 색(흰 바탕에 합성한 RGB)을 낸다. 조각 순서는 왼쪽 위부터 가로로. */
export function tileSignatures(data: ArrayLike<number>, w: number, h: number, n: number, cells = SIGNATURE_CELLS): number[][] {
  const out: number[][] = [];
  for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
    const x0 = Math.floor(tx * w / n), x1 = Math.floor((tx + 1) * w / n), y0 = Math.floor(ty * h / n), y1 = Math.floor((ty + 1) * h / n);
    const sig: number[] = [];
    for (let cy = 0; cy < cells; cy++) for (let cx = 0; cx < cells; cx++) {
      const ax = x0 + Math.floor(cx * (x1 - x0) / cells), bx = Math.max(ax + 1, x0 + Math.floor((cx + 1) * (x1 - x0) / cells));
      const ay = y0 + Math.floor(cy * (y1 - y0) / cells), by = Math.max(ay + 1, y0 + Math.floor((cy + 1) * (y1 - y0) / cells));
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = ay; y < Math.min(by, h); y++) for (let x = ax; x < Math.min(bx, w); x++) {
        const i = (y * w + x) * 4, a = (data[i + 3] ?? 255) / 255;
        r += (data[i] ?? 0) * a + 255 * (1 - a); g += (data[i + 1] ?? 0) * a + 255 * (1 - a); b += (data[i + 2] ?? 0) * a + 255 * (1 - a); count++;
      }
      sig.push(count ? r / count : 255, count ? g / count : 255, count ? b / count : 255);
    }
    out.push(sig);
  }
  return out;
}

/** 두 조각의 모든 칸·채널 차이가 허용치 이내면 같은 모양이다. */
export function sameShape(a: number[], b: number[], tol = SAME_TOLERANCE): boolean {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) <= tol);
}

/** same[i][j]: i번 조각과 j번 조각이 같은 모양인가. 그림을 읽지 못하면 자기 자신만 같다고 본다. */
export function sameTable(sigs: number[][] | null, count: number): boolean[][] {
  return Array.from({ length: count }, (_, i) => Array.from({ length: count }, (_, j) => i === j || (!!sigs && sameShape(sigs[i]!, sigs[j]!))));
}

/** tiles[자리] = 그 자리에 놓인 조각 번호. 모든 자리에 제 조각이나 같은 모양 조각이 있으면 완성. */
export function isSolved(tiles: number[], same: boolean[][]): boolean {
  return tiles.length > 0 && tiles.every((v, i) => v === i || !!same[v]?.[i]);
}

/** 이미 완성으로 보이는 배치를 피해 섞는다. tries번 안에 못 피하면 null(같은 모양 조각이 너무 많음). */
export function shuffleTiles(count: number, same: boolean[][], random = Math.random, tries = SHUFFLE_TRIES): number[] | null {
  for (let t = 0; t < tries; t++) {
    const a = Array.from({ length: count }, (_, i) => i);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
    if (!isSolved(a, same)) return a;
  }
  return null;
}
