"""컷아웃 PNG를 만드는 곳(마스터플랜 3-4). 투명한 곳에 원본 색을 남기지 않는다.

컷아웃은 이웃 화면과 외부 API로도 나간다. 알파만 더하면 알파를 지웠을 때 배경(집 안, 책상, 사람)이 복원된다.
저장된 원본은 바꾸지 않는다. 보이는 화소와 부드러운 경계(alpha>0)의 색은 그대로 둔다.
"""
from __future__ import annotations


def cutout_image(rgb, alpha):
    """RGB 그림과 같은 크기의 L 알파 → RGBA. 알파가 정확히 0인 화소만 RGB를 0으로 한다. 입력은 바꾸지 않는다."""
    import numpy as np
    from PIL import Image

    px = np.array(rgb.convert("RGB"))
    px[np.asarray(alpha) == 0] = 0
    out = Image.fromarray(px, "RGB")
    out.putalpha(alpha)
    return out
