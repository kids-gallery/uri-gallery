// 자르기 창의 처음 네 모서리(마스터플랜 3-3, #118). 아이가 같이 찍혔는지는 보호자가 답한다.
type Corners = [number, number][];
const rect = (w: number, h: number, x0: number, y0: number, x1: number, y1: number): Corners =>
  [[x0 * w, y0 * h], [x1 * w, y0 * h], [x1 * w, y1 * h], [x0 * w, y1 * h]];

export const CROP_BOXES = [
  { label: '아이가 같이 찍혔어요', box: (w: number, h: number) => (h > w * 1.1 ? rect(w, h, 0.08, 0.38, 0.92, 0.96) : rect(w, h, 0.04, 0.38, 0.96, 0.96)) },
  { label: '작품만 찍었어요', box: (w: number, h: number) => rect(w, h, 0.04, 0.04, 0.96, 0.96) },
];
