"""
Builds a small PNG icon for the Tableau extension manifest (no Pillow
dependency available, so this writes raw PNG chunks directly).
"""
import struct
import zlib
import base64
import os

SIZE = 128
BG = (14, 90, 58)        # flag green
BAR = (245, 247, 250)    # white
GOLD = (216, 180, 92)


def build_png(size, pixel_fn):
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0 (none)
        for x in range(size):
            r, g, b = pixel_fn(x, y)
            row += bytes([r, g, b])
        rows.append(bytes(row))
    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")


def pixel(x, y):
    cx, cy = SIZE / 2, SIZE / 2
    dx, dy = x - cx, y - cy
    dist = (dx * dx + dy * dy) ** 0.5

    if x < SIZE * 0.32:
        return BAR

    if dist < SIZE * 0.17:
        return GOLD
    if SIZE * 0.17 <= dist < SIZE * 0.205 and dx > -SIZE * 0.02:
        return BG

    return BG


def main():
    png_bytes = build_png(SIZE, pixel)
    out_dir = os.path.join(os.path.dirname(__file__), "..", "extension")
    out_path = os.path.join(out_dir, "icon.png")
    with open(out_path, "wb") as f:
        f.write(png_bytes)
    b64 = base64.b64encode(png_bytes).decode("ascii")
    with open(os.path.join(out_dir, "icon_base64.txt"), "w") as f:
        f.write(b64)
    print("Wrote", out_path, len(png_bytes), "bytes;", len(b64), "base64 chars")


if __name__ == "__main__":
    main()
