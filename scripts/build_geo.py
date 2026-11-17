"""
Prepares Pakistan province GeoJSON (renames properties to match dataset
province keys) and bundles it + the world atlas topojson into JS files
the dashboard can load with a plain <script> tag (works over file:// too).
"""
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
EXT_DIR = os.path.join(os.path.dirname(__file__), "..", "extension")

SHAPE_TO_KEY = {
    "Balochistan": "Balochistan",
    "Sindh": "Sindh",
    "Khyber Pakhtunkhwa": "KPK",
    "Punjab": "Punjab",
    "Islamabad Capital Territory": "ICT",
    "Gilgit-Baltistan": "Gilgit-Baltistan",
    "Azad Kashmir": "Azad Kashmir",
}

def main():
    with open(os.path.join(DATA_DIR, "pak_adm1_raw.geojson"), encoding="utf-8") as f:
        geo = json.load(f)

    for feat in geo["features"]:
        shape_name = feat["properties"].get("shapeName", "")
        key = SHAPE_TO_KEY.get(shape_name, shape_name)
        feat["properties"] = {
            "name": key,
            "shapeName": shape_name,
            "hasData": key in ("Balochistan", "Sindh", "KPK", "Punjab", "ICT"),
        }

    with open(os.path.join(DATA_DIR, "world-110m.json"), encoding="utf-8") as f:
        world = json.load(f)

    out_path = os.path.join(EXT_DIR, "geo.js")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("window.PK_PROVINCES_GEO = ")
        json.dump(geo, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\nwindow.PK_WORLD_TOPO = ")
        json.dump(world, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    print("Wrote", out_path, os.path.getsize(out_path) / 1024, "KB")

if __name__ == "__main__":
    main()
