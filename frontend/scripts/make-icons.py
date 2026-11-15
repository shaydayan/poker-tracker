# Usage (from frontend/): python3 scripts/make-icons.py public/icons
# Draws the app icon (a spade on the app background) as PNGs, with no image library: supersampled, then averaged.
import struct, sys, zlib

BG = (0x11, 0x13, 0x18)
FG = (0x4f, 0x8c, 0xff)

def inside(x, y):
    """Spade in a unit box: x, y in [-1, 1], y down. Body = upside-down heart, plus a flared stem."""
    # body: heart curve (x²+y²-1)³ - x²y³ <= 0 with lobes down, scaled into the box
    bx, by = x / 0.60, (y + 0.22) / 0.60
    if (bx * bx + by * by - 1) ** 3 - bx * bx * by ** 3 <= 0:
        return True
    # stem: a triangle from the body down to a flat foot
    if 0.20 <= y <= 0.86:
        half = 0.035 + ((y - 0.20) / 0.66) ** 2 * 0.24
        return abs(x) <= half
    return False

def render(size, scale, ss=3):
    """`scale` = how much of the icon the spade fills (smaller for maskable icons, whose edges get cropped)."""
    rows = []
    n = size * ss
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = ((px * ss + sx + 0.5) / n * 2 - 1) / scale
                    y = ((py * ss + sy + 0.5) / n * 2 - 1) / scale
                    hits += inside(x, y)
            a = hits / (ss * ss)
            row += bytes(round(BG[i] + (FG[i] - BG[i]) * a) for i in range(3))
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')

out = sys.argv[1]
for name, size, scale in [('icon-192.png', 192, 0.80), ('icon-512.png', 512, 0.80), ('icon-maskable-512.png', 512, 0.62), ('apple-touch-icon.png', 180, 0.72), ('favicon-48.png', 48, 0.92)]:
    open(f'{out}/{name}', 'wb').write(render(size, scale))
    print(name)
