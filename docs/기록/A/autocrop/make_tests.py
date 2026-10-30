"""D35 자동 자르기 시험 사진 — 합성(실제 아동 그림 · 얼굴 없음, G20). 책상 위 종이 그림을 원근으로 놓고 정답 네 모서리를 기록한다."""
import json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
random.seed(7); np.random.seed(7)
W, H = 1600, 1200
def desk(kind):
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    if kind == 'wood':
        g = np.sin(x / 9 + np.sin(y / 60) * 3) * 12 + np.random.randn(H, W) * 5
        base = np.array([120, 78, 45]); img = base + g[..., None] * np.array([1, .8, .6])
    elif kind == 'white':   # 흰 책상(종이와 대비가 약함)
        img = np.array([228, 226, 220]) + np.random.randn(H, W, 1) * 4
    else:                    # 회색 카펫
        img = np.array([110, 112, 118]) + np.random.randn(H, W, 1) * 14
    return Image.fromarray(img.clip(0, 255).astype(np.uint8))
def drawing(pw, ph, paper):
    im = Image.new('RGB', (pw, ph), paper); d = ImageDraw.Draw(im)
    cols = [(228, 87, 46), (243, 167, 18), (41, 51, 92), (102, 155, 188), (107, 163, 104), (209, 107, 165)]
    d.line([(0, ph * .8), (pw * .5, ph * .74), (pw, ph * .82)], fill=cols[4], width=14)
    d.ellipse([pw * .7, ph * .08, pw * .88, ph * .3], outline=cols[1], width=10)
    x, y, s = pw * .2, ph * .42, min(pw, ph) * .32
    d.rectangle([x, y, x + s, y + s], outline=random.choice(cols), width=10); d.line([(x - 12, y), (x + s / 2, y - s * .6), (x + s + 12, y)], fill=cols[0], width=10)
    for i in range(3): d.ellipse([pw * (.15 + i * .12), ph * .12, pw * (.22 + i * .12), ph * .2], outline=cols[3], width=7)
    return im
def homography(src, dst):
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]
    b = [c for p in dst for c in p]; h = np.linalg.solve(np.array(A, float), np.array(b, float)); return np.append(h, 1).reshape(3, 3)
def place(bg, paper_im, quad, shadow=True):
    pw, ph = paper_im.size
    Hm = homography(quad, [(0, 0), (pw, 0), (pw, ph), (0, ph)])  # 사진 → 종이(PIL은 역변환 계수)
    coeffs = (Hm / Hm[2, 2]).flatten()[:8]
    warped = paper_im.transform((W, H), Image.PERSPECTIVE, tuple(coeffs), Image.BICUBIC)
    mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).polygon(quad, fill=255)
    if shadow:
        sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).polygon([(x + 14, y + 18) for x, y in quad], fill=110)
        bg = Image.composite(Image.new('RGB', (W, H), (20, 14, 10)), bg, sh.filter(ImageFilter.GaussianBlur(18)))
    return Image.composite(warped, bg, mask.filter(ImageFilter.GaussianBlur(1)))
def light(im, gain, grad=0):
    a = np.asarray(im).astype(np.float32)
    if grad: a *= (1 - grad * np.linspace(0, 1, W))[None, :, None]
    return Image.fromarray((a * gain).clip(0, 255).astype(np.uint8))
C = [(W / 2, H / 2)]
def rect(cx, cy, w, h, rot=0, persp=0):
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    r = math.radians(rot); out = []
    for i, (x, y) in enumerate(pts):
        if persp and y < 0: x *= (1 - persp)  # 먼 쪽(위)이 좁아짐
        out.append((round(cx + x * math.cos(r) - y * math.sin(r)), round(cy + x * math.sin(r) + y * math.cos(r))))
    return out
cases = [
  ('01_반듯', 'wood', rect(800, 600, 1000, 720), (252, 250, 244), 1, 0, None),
  ('02_기울기15도', 'wood', rect(800, 610, 980, 700, 15), (252, 250, 244), 1, 0, None),
  ('03_강한원근', 'wood', rect(800, 640, 1150, 760, -4, .32), (250, 248, 240), 1, 0, None),
  ('04_어두운조명', 'wood', rect(790, 600, 1000, 720, 7, .12), (245, 243, 236), .55, .35, None),
  ('05_손가림', 'wood', rect(800, 600, 1000, 720, -6), (252, 250, 244), 1, 0, 'hand'),
  ('06_색종이', 'carpet', rect(800, 600, 960, 700, 9, .1), (250, 214, 120), 1, 0, None),
  ('07_가장자리잘림', 'wood', [(-60, 90), (1500, 60), (1560, 1150), (-40, 1180)], (252, 250, 244), 1, 0, None),
  ('08_작게', 'wood', rect(900, 520, 420, 300, 20), (252, 250, 244), 1, 0, None),
  ('09_흰책상', 'white', rect(800, 600, 1000, 720, 5, .08), (253, 252, 248), 1, 0, None),
  ('10_세로종이', 'wood', rect(800, 600, 640, 900, -8, .15), (252, 250, 244), 1, 0, None),
]
truth = {}
for name, bg, quad, paper, gain, grad, extra in cases:
    ph_im = drawing(1400, 1000, paper) if (quad[1][0] - quad[0][0]) ** 2 > (quad[3][1] - quad[0][1]) ** 2 else drawing(1000, 1400, paper)
    im = place(desk(bg), ph_im, quad)
    if extra == 'hand':
        d = ImageDraw.Draw(im); x, y = quad[2]; d.ellipse([x - 170, y - 150, x + 60, y + 90], fill=(224, 172, 140)); d.rectangle([x - 60, y - 20, x + 200, y + 160], fill=(224, 172, 140))
    im = light(im, gain, grad).filter(ImageFilter.GaussianBlur(.6))
    im.save(f'test/{name}.jpg', quality=88); truth[name] = quad
json.dump(truth, open('test/truth.json', 'w'), ensure_ascii=False, indent=1)
print(len(truth), 'cases')
