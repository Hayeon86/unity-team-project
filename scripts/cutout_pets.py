from collections import deque
from pathlib import Path

from PIL import Image

root = Path(r"c:\Users\HYK\OneDrive\바탕 화면\unity-team-project\unity-team-project\public")
jobs = [
    (root / "pet-jibyojeong-src.jpg", root / "pet-jibyojeong.png"),
    (root / "pet-nabi-src.jpg", root / "pet-nabi.png"),
    (root / "pet-bori-src.png", root / "pet-bori.png"),
]


def is_bg(r, g, b):
    return r >= 242 and g >= 242 and b >= 238 and (max(r, g, b) - min(r, g, b)) < 28


def cutout(src, dst):
    im = Image.open(src).convert("RGBA")
    pixels = im.load()
    w, h = im.size
    marked = [[False] * h for _ in range(w)]
    q = deque()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    for x in range(0, w, max(1, w // 24)):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(0, h, max(1, h // 24)):
        seeds.append((0, y))
        seeds.append((w - 1, y))
    for x, y in seeds:
        if not marked[x][y]:
            marked[x][y] = True
            q.append((x, y))
    while q:
        x, y = q.popleft()
        r, g, b, _ = pixels[x, y]
        if not is_bg(r, g, b):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not marked[nx][ny]:
                marked[nx][ny] = True
                q.append((nx, ny))
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if is_bg(r, g, b):
                pixels[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    if bbox:
        pad = 8
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(w, bbox[2] + pad)
        bottom = min(h, bbox[3] + pad)
        im = im.crop((left, top, right, bottom))
    im.save(dst)
    print("saved", dst.name, im.size)


for src, dst in jobs:
    cutout(src, dst)
