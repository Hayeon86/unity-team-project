from collections import deque
from pathlib import Path

from PIL import Image

src = Path(
    r"C:\Users\HYK\.cursor\projects\c-Users-HYK-OneDrive-unity-team-project-unity-team-project\assets\house-fairy-magenta.jpg"
)
dst = Path(r"c:\Users\HYK\OneDrive\바탕 화면\unity-team-project\unity-team-project\public\house-fairy.png")

im = Image.open(src).convert("RGBA")
pixels = im.load()
w, h = im.size
bg = (229, 14, 105)


def bg_score(r, g, b):
    dist = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
    magenta = g < 95 and r > 150 and b > 40 and r > g + 60
    return dist, magenta or dist < 70


marked = [[False] * h for _ in range(w)]
q = deque()
for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    q.append((x, y))
    marked[x][y] = True

while q:
    x, y = q.popleft()
    r, g, b, _ = pixels[x, y]
    dist, is_bg = bg_score(r, g, b)
    if not is_bg:
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
        dist, is_bg = bg_score(r, g, b)
        if is_bg:
            pixels[x, y] = (0, 0, 0, 0)
            continue
        if dist < 110:
            alpha = max(0, min(255, int(255 * (dist - 55) / 55)))
            if alpha < 255:
                pixels[x, y] = (r, g, b, alpha)

im.save(dst)
print("saved", dst, im.size)
