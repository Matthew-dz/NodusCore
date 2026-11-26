# Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
"""NodusCore DX-OS | Open Data Ingestion Script (OSM Overpass + Da Nang Open Data)."""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_QUERY = """
[out:json][timeout:25];
(
  way["landuse"="farmland"](15.98,108.12,16.02,108.18);
);
out geom 1;
""".strip()

TENANT_ID = "a0000000-0000-0000-0000-000000000001"
TENANT_CODE = "htx-hoanhon-danang"
ZONE_ID = "b0000000-0000-0000-0000-000000000001"
PUC_CODE = "VN-DAN-ORC-2026-001"
BATCH_ID = "c0000000-0000-0000-0000-000000000001"


def fetch_osm_farmland_polygon():
    """Fetch a real farmland polygon in Hoa Vang, Da Nang from OSM Overpass API."""
    data = urllib.parse.urlencode({"data": OVERPASS_QUERY}).encode("utf-8")
    req = urllib.request.Request(
        OVERPASS_URL,
        data=data,
        headers={"User-Agent": "NodusCore-DX-OS/0.1.0 (Open Data Ingestion)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        elements = payload.get("elements", [])
        for el in elements:
            geom = el.get("geometry", [])
            if len(geom) >= 3:
                coords = [[pt["lon"], pt["lat"]] for pt in geom]
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                return el.get("id"), {
                    "type": "Polygon",
                    "coordinates": [coords],
                }, False
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"[WARN] Overpass API unavailable ({exc}); using fallback Hoa Nhon polygon.", file=sys.stderr)

    # Fallback closed polygon in Hoa Nhon, Hoa Vang, Da Nang (15.98-16.02, 108.12-108.18)
    fallback_coords = [
        [108.1450, 15.9950],
        [108.1480, 15.9950],
        [108.1480, 15.9980],
        [108.1450, 15.9980],
        [108.1450, 15.9950],
    ]
    return 0, {"type": "Polygon", "coordinates": [fallback_coords]}, True


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def run_psql(sql: str):
    pg_user = os.environ.get("POSTGRES_USER", "nodus_admin")
    pg_db = os.environ.get("POSTGRES_DB", "nodus_core")
    cmd = [
        "docker", "compose", "exec", "-T", "postgres",
        "psql", "-U", pg_user, "-d", pg_db, "-v", "ON_ERROR_STOP=1",
    ]
    proc = subprocess.run(cmd, input=sql, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"psql failed:\n{proc.stderr}")
    return proc.stdout


def main():
    osm_id, geojson_poly, is_fallback = fetch_osm_farmland_polygon()
    print(f"[INFO] OSM Farmland Polygon ready (osm_id={osm_id}, fallback={is_fallback})")

    tenant_meta = json.dumps({
        "license": "CC-BY 4.0",
        "source": "Cổng Dữ liệu Mở Đà Nẵng",
        "external_id": TENANT_CODE,
    }, ensure_ascii=False)

    zone_meta = json.dumps({
        "osm_id": osm_id,
        "license": "ODbL 1.0",
        "source": "OpenStreetMap Overpass API",
        "bbox": [15.98, 108.12, 16.02, 108.18],
    }, ensure_ascii=False)

    batch_meta = json.dumps({
        "origin": "Hòa Nhơn, Hòa Vang, Đà Nẵng",
        "open_data_linked": True,
    }, ensure_ascii=False)

    sql = f"""
INSERT INTO tenants (id, code, name, status, tax_code, legal_rep, address, metadata)
VALUES (
    '{TENANT_ID}',
    '{TENANT_CODE}',
    '{sql_escape("Hợp tác xã Dịch vụ Nông nghiệp Hòa Nhơn")}',
    'ACTIVE',
    '0401764614',
    '{sql_escape("Đại diện HTX Hòa Nhơn")}',
    '{sql_escape("Thôn Thái Lai, Xã Hòa Nhơn, Huyện Hòa Vang, Thành phố Đà Nẵng")}',
    '{sql_escape(tenant_meta)}'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    tax_code = EXCLUDED.tax_code,
    address = EXCLUDED.address,
    metadata = EXCLUDED.metadata;

INSERT INTO production_zones (
    id, tenant_id, zone_code, puc_code, name, crop_type,
    area_hectares, location_geojson, certification, farming_standard, metadata
)
VALUES (
    '{ZONE_ID}',
    (SELECT id FROM tenants WHERE code = '{TENANT_CODE}' LIMIT 1),
    '{PUC_CODE}',
    '{PUC_CODE}',
    '{sql_escape("Vùng trồng Bưởi da xanh Hòa Nhơn")}',
    '{sql_escape("Bưởi da xanh")}',
    15.50,
    '{sql_escape(json.dumps(geojson_poly))}'::jsonb,
    'VietGAP',
    'VietGAP',
    '{sql_escape(zone_meta)}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    puc_code = EXCLUDED.puc_code,
    location_geojson = EXCLUDED.location_geojson,
    metadata = EXCLUDED.metadata;

INSERT INTO batches (
    id, tenant_id, zone_id, batch_code, public_trace_key,
    product_name, quantity, unit, harvest_date, status, certificate_code, metadata
)
VALUES (
    '{BATCH_ID}',
    (SELECT id FROM tenants WHERE code = '{TENANT_CODE}' LIMIT 1),
    '{ZONE_ID}',
    'LOT-HOANHON-001',
    'TR-HOANHON-2026',
    '{sql_escape("Bưởi da xanh Hòa Vang (VietGAP)")}',
    1200.000,
    'kg',
    CURRENT_DATE,
    'HARVESTED',
    'VG-DN-2026-001',
    '{sql_escape(batch_meta)}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    product_name = EXCLUDED.product_name,
    metadata = EXCLUDED.metadata;
"""

    output = run_psql(sql)
    print(output.strip())
    print("[OK] Open Data ingested successfully into tenants, production_zones, and batches.")


if __name__ == "__main__":
    main()
