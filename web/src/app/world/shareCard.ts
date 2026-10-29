// 자랑하기 그림(3D미술관_재설계 §2-22 10): 화면용 사진 + 명패(제목, 만든 달) + 서비스 이름 한 장.
// 입력하지 않은 사실은 쓰지 않는다(설계도 7-4의 4번): 만든 날이 없으면 달을 쓰지 않고, 이름·나이는 보호자가 고른 것만 넣는다.
import { blobToImage, canvasToBlob } from './cutout';
import { plaqueOf, type CurationInput } from './curation';

/** 그림 크기·글자·색 표 */
export const CARD = { width: 1080, pad: 64, frame: 12, photoMax: 1080, title: 56, sub: 34, brand: 28, gap: 18, paper: '#fbf6ec', ink: '#3b2a1e', muted: '#8a7560', frameColor: '#d6c19b', service: '우리 아이 미술관' } as const;

export interface CardChoice { child: boolean; age: boolean }
export interface CardText { title: string; lines: string[]; brand: string }
export type CardWork = Omit<CurationInput, 'child'>;

/** 카드에 쓸 글(단위 시험으로 고정). site는 배포 주소 설정값이며 비면 서비스 이름만 쓴다 */
export function cardText(a: CardWork, child: string, pick: CardChoice, site = ''): CardText {
  const name = child.trim();
  const who = [pick.child && name ? `${name}의 작품` : '', pick.age && a.age > 0 ? `${a.age}세` : ''].filter(Boolean).join(', ');
  const m = /^(\d{4})-(\d{2})/.exec(a.madeOn);
  return {
    title: plaqueOf({ ...a, child: name }).title,
    lines: [who, m ? `${m[1]}년 ${Number(m[2])}월` : ''].filter(Boolean),
    brand: site.trim() ? `${CARD.service} · ${site.trim()}` : CARD.service,
  };
}

/** 사진을 액자처럼 두고 아래에 명패 글을 쓴 PNG */
export async function drawCard(display: Blob, t: CardText, font: string): Promise<Blob> {
  const img = await blobToImage(display);
  const W = CARD.width, inner = W - CARD.pad * 2;
  const scale = Math.min(inner / img.width, CARD.photoMax / img.height);
  const pw = Math.round(img.width * scale), ph = Math.round(img.height * scale);
  const textH = CARD.gap * 3 + CARD.title + t.lines.length * (CARD.sub + CARD.gap) + CARD.gap * 2 + CARD.brand;
  const c = document.createElement('canvas');
  c.width = W; c.height = CARD.pad * 2 + ph + textH;
  const g = c.getContext('2d')!;
  g.fillStyle = CARD.paper; g.fillRect(0, 0, c.width, c.height);
  const x = Math.round((W - pw) / 2), y = CARD.pad;
  g.fillStyle = CARD.frameColor; g.fillRect(x - CARD.frame, y - CARD.frame, pw + CARD.frame * 2, ph + CARD.frame * 2);
  g.drawImage(img, x, y, pw, ph);
  g.textAlign = 'center'; g.textBaseline = 'top';
  let ty = y + ph + CARD.gap * 3;
  g.fillStyle = CARD.ink; g.font = `600 ${CARD.title}px ${font}`; g.fillText(t.title, W / 2, ty, inner); ty += CARD.title + CARD.gap;
  g.font = `400 ${CARD.sub}px ${font}`;
  for (const l of t.lines) { g.fillText(l, W / 2, ty, inner); ty += CARD.sub + CARD.gap; }
  g.fillStyle = CARD.muted; g.font = `400 ${CARD.brand}px ${font}`; g.fillText(t.brand, W / 2, ty + CARD.gap, inner);
  return canvasToBlob(c, 'image/png');
}
