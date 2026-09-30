"""Tour Into the Picture — 한 점 투시 사진(그랑드 갤러리)을 3D 상자 5면(바닥·천장·좌우 벽·끝벽)으로 편다.
카메라: 사진 찍은 자리(원점), -z 방향을 봄. 1m = 100 CSS px. 사진 좌표 x = VX + F*X/Z, y = VY + F*Y/Z (Y 아래가 +).
각 면은 깊이 구간으로 잘라(큰 평면은 GPU 텍스처 한도 초과) 구간마다 알맞은 해상도로 뽑는다."""
import json, numpy as np
from PIL import Image
SRC = 'gg.jpg'  # 원본: 커먼즈에서 받기(README)
im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32); H, W = im.shape[:2]
VX, VY, F = 1468.0, 1896.0, 5780.0
XL, XR, YF, YC, ZB = -5.4, 4.4, 1.5, -6.3, 150.0
CAP = 200  # px/m 상한(가까운 면)
def sample(xs, ys):
    """이중선형 표본 + 사진 밖은 투명"""
    inside = (xs >= 0) & (xs <= W - 1) & (ys >= 0) & (ys <= H - 1)
    x = np.clip(xs, 0, W - 1.001); y = np.clip(ys, 0, H - 1.001)
    x0 = x.astype(int); y0 = y.astype(int); dx = (x - x0)[..., None]; dy = (y - y0)[..., None]
    c = im[y0, x0] * (1 - dx) * (1 - dy) + im[y0, x0 + 1] * dx * (1 - dy) + im[y0 + 1, x0] * (1 - dx) * dy + im[y0 + 1, x0 + 1] * dx * dy
    a = inside.astype(np.float32)[..., None] * 255
    return np.concatenate([c, a], -1).clip(0, 255).astype(np.uint8)
faces = []
def emit(name, pts_fn, w_m, h_m, z0, z1, css):
    dens = min(CAP, F / z0)
    pw, ph = max(8, int(w_m * dens)), max(8, int(h_m * dens))
    u = (np.arange(pw) + .5) / pw; v = (np.arange(ph) + .5) / ph
    U, V = np.meshgrid(u, v)
    X, Y, Z = pts_fn(U, V)
    rgba = sample(VX + F * X / Z, VY + F * Y / Z)
    if rgba[..., 3].max() == 0: return
    fn = f'tex/{name}.webp'; Image.fromarray(rgba, 'RGBA').save(fn, 'WEBP', quality=78, method=6)
    faces.append({'name': name, 'src': fn, 'w': round(w_m * 100), 'h': round(h_m * 100), 'tf': css})
cuts = [8.0, 12, 18, 26, 38, 56, 85, 150]
for z0, z1 in zip(cuts, cuts[1:]):
    d = z1 - z0; zc = (z0 + z1) / 2
    # 바닥: 가로 X, 세로 = 먼 쪽이 위(v=0 → z1)
    emit(f'floor_{int(z0)}', lambda U, V: (XL + U * (XR - XL), np.full_like(U, YF), z1 - V * d), XR - XL, d, z0, z1,
         f'translate3d({(XL+XR)/2*100:.0f}px,{YF*100:.0f}px,{-zc*100:.0f}px) rotateX(90deg)')
    # 천장: v=0 → 가까운 쪽(z0)
    emit(f'ceil_{int(z0)}', lambda U, V: (XL + U * (XR - XL), np.full_like(U, YC), z0 + V * d), XR - XL, d, z0, z1,
         f'translate3d({(XL+XR)/2*100:.0f}px,{YC*100:.0f}px,{-zc*100:.0f}px) rotateX(-90deg)')
    # 왼벽: 앞면 +x, rotateY(90) → 가로 u=0이 가까운 쪽
    emit(f'wallL_{int(z0)}', lambda U, V: (np.full_like(U, XL), YC + V * (YF - YC), z0 + U * d), d, YF - YC, z0, z1,
         f'translate3d({XL*100:.0f}px,{(YC+YF)/2*100:.0f}px,{-zc*100:.0f}px) rotateY(90deg)')
    # 오른벽: rotateY(-90) → 가로 u=0이 먼 쪽
    emit(f'wallR_{int(z0)}', lambda U, V: (np.full_like(U, XR), YC + V * (YF - YC), z1 - U * d), d, YF - YC, z0, z1,
         f'translate3d({XR*100:.0f}px,{(YC+YF)/2*100:.0f}px,{-zc*100:.0f}px) rotateY(-90deg)')
emit('back', lambda U, V: (XL + U * (XR - XL), YC + V * (YF - YC), np.full_like(U, ZB)), XR - XL, YF - YC, ZB, ZB,
     f'translate3d({(XL+XR)/2*100:.0f}px,{(YC+YF)/2*100:.0f}px,{-ZB*100:.0f}px)')
meta = {'photo': {'title': 'Intérieur de la Grande Galerie du Louvre', 'author': 'Touzania18', 'license': 'CC BY-SA 4.0',
        'url': 'https://commons.wikimedia.org/wiki/File:Int%C3%A9rieur_de_la_Grande_Galerie_du_Louvre.jpg', 'size': [W, H],
        'note': '원본을 3D 상자 면으로 펴서 잘라 씀(변형물) — 같은 CC BY-SA 4.0으로 배포'},
        'camera': {'vx': VX, 'vy': VY, 'f': F, 'imgW': W, 'imgH': H}, 'box': {'xl': XL, 'xr': XR, 'yf': YF, 'yc': YC, 'zb': ZB}, 'faces': faces}
json.dump(meta, open('faces.json', 'w'), ensure_ascii=False, indent=1)
import os; tot = sum(os.path.getsize(f['src']) for f in faces)
print(len(faces), 'faces', round(tot / 1024), 'KB')
for f in faces: print(f['name'], f['w'], f['h'], round(os.path.getsize(f['src']) / 1024), 'KB')
