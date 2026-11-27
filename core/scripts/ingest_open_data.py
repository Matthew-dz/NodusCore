# Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
"""NodusCore DX-OS | Offline-First Open Data Ingestion (Configurable CLI + Anomaly Detection)."""

import argparse
import json
import os
import subprocess
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

DEFAULT_DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "danang" / "vung_chuyen_canh.xls"
DEFAULT_TENANT_ID = "a0000000-0000-0000-0000-000000000000"
DEFAULT_TENANT_CODE = "so-nnptnt-danang"
DEFAULT_TENANT_NAME = "Sở Nông nghiệp và Phát triển nông thôn Thành phố Đà Nẵng"
DEFAULT_TAX_CODE = "0400224641"
DEFAULT_BATCH_CODE = "LOT-DANANG-2026-001"
DEFAULT_TRACE_KEY = "TR-DANANG-2026-001"

BATCH_ID = "c0000000-0000-0000-0000-000000000001"
BATCH_PRODUCT = "Rau an toàn chuyên canh Đà Nẵng"

DISTRICT_POLYGONS = {
    "hòa vang": [[
        [108.1450, 15.9950], [108.1480, 15.9950],
        [108.1480, 15.9980], [108.1450, 15.9980], [108.1450, 15.9950],
    ]],
    "cẩm lệ": [[
        [108.1900, 16.0100], [108.1930, 16.0100],
        [108.1930, 16.0130], [108.1900, 16.0130], [108.1900, 16.0100],
    ]],
    "liên chiểu": [[
        [108.1300, 16.0800], [108.1330, 16.0800],
        [108.1330, 16.0830], [108.1300, 16.0830], [108.1300, 16.0800],
    ]],
    "ngũ hành sơn": [[
        [108.2500, 16.0000], [108.2530, 16.0000],
        [108.2530, 16.0030], [108.2500, 16.0030], [108.2500, 16.0000],
    ]],
    "sơn trà": [[
        [108.2600, 16.1000], [108.2630, 16.1000],
        [108.2630, 16.1030], [108.2600, 16.1030], [108.2600, 16.1000],
    ]],
}


def nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text).strip()


def col_index_from_ref(ref: str) -> int:
    col = "".join(ch for ch in ref if ch.isalpha())
    idx = 0
    for ch in col:
        idx = idx * 26 + (ord(ch.upper()) - ord("A") + 1)
    return idx - 1


def read_excel_rows(xlsx_path: Path) -> list[dict[str, str]]:
    """Read OOXML Excel file using Python stdlib only (no external dependencies)."""
    ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(xlsx_path) as zf:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            ss_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in ss_root.findall("s:si", ns):
                shared_strings.append(
                    "".join(t.text or "" for t in si.iter(f"{{{ns['s']}}}t"))
                )

        sheet_root = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))
        raw_rows: list[list[str]] = []
        for row_el in sheet_root.findall(".//s:row", ns):
            cells: dict[int, str] = {}
            max_col = -1
            for c_el in row_el.findall("s:c", ns):
                ref = c_el.attrib.get("r", "")
                c_idx = col_index_from_ref(ref) if ref else (max_col + 1)
                max_col = max(max_col, c_idx)
                cell_type = c_el.attrib.get("t")
                v_el = c_el.find("s:v", ns)
                val = v_el.text if v_el is not None and v_el.text is not None else ""
                if cell_type == "s" and val.isdigit():
                    val = shared_strings[int(val)]
                elif cell_type == "inlineStr":
                    val = "".join(t.text or "" for t in c_el.iter(f"{{{ns['s']}}}t"))
                cells[c_idx] = nfc(val)
            if max_col >= 0:
                row_list = [cells.get(i, "") for i in range(max_col + 1)]
                if any(row_list):
                    raw_rows.append(row_list)

    headers = [nfc(h) for h in raw_rows[0]]
    records: list[dict[str, str]] = []
    for row_vals in raw_rows[1:]:
        record = {
            headers[i]: (row_vals[i] if i < len(row_vals) else "")
            for i in range(len(headers))
        }
        if record.get("Vùng chuyên canh"):
            records.append(record)
    return records


def parse_vn_float(value: str):
    if not value:
        return None
    cleaned = value.strip().replace(",", ".")
    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None


def get_district_geojson(district: str) -> dict:
    normalized = " ".join(district.lower().split())
    for key, coords in DISTRICT_POLYGONS.items():
        if key in normalized:
            return {"type": "Polygon", "coordinates": coords}
    return {"type": "Polygon", "coordinates": DISTRICT_POLYGONS["hòa vang"]}


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def run_psql(sql: str) -> str:
    pg_user = os.environ.get("POSTGRES_USER", "nodus_admin")
    pg_db = os.environ.get("POSTGRES_DB", "nodus_core")
    cmd = [
        "docker", "compose", "exec", "-T", "postgres",
        "psql", "-U", pg_user, "-d", pg_db, "-v", "ON_ERROR_STOP=1",
    ]
    proc = subprocess.run(cmd, input=sql, text=True, encoding="utf-8", capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f"psql failed:\n{proc.stderr}")
    return proc.stdout


def parse_args():
    parser = argparse.ArgumentParser(description="NodusCore DX-OS Open Data Ingestion")
    parser.add_argument("--file", type=Path, default=DEFAULT_DATA_FILE, help="Path to Excel open data file")
    parser.add_argument("--tenant-id", default=DEFAULT_TENANT_ID, help="Tenant UUID")
    parser.add_argument("--tenant-code", default=DEFAULT_TENANT_CODE, help="Tenant unique code")
    parser.add_argument("--tenant-name", default=DEFAULT_TENANT_NAME, help="Tenant display name")
    parser.add_argument("--tax-code", default=DEFAULT_TAX_CODE, help="Tenant tax code")
    parser.add_argument("--batch-code", default=DEFAULT_BATCH_CODE, help="Sample batch code")
    parser.add_argument("--trace-key", default=DEFAULT_TRACE_KEY, help="Sample batch public trace key")
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.file.exists():
        raise FileNotFoundError(f"Open data file not found: {args.file}")

    records = read_excel_rows(args.file)
    print(f"[INFO] Loaded {len(records)} zones from {args.file.name} (Offline-First).")

    tenant_meta = json.dumps({
        "source": "Cổng Dữ liệu Mở TP. Đà Nẵng",
        "document": "1510/TB-SNN",
        "license": "CC-BY 4.0",
    }, ensure_ascii=False)

    sql_parts = [
        "BEGIN;",
        f"""
INSERT INTO tenants (id, code, name, status, tax_code, legal_rep, address, metadata)
VALUES (
    '{args.tenant_id}',
    '{sql_escape(args.tenant_code)}',
    '{sql_escape(args.tenant_name)}',
    'ACTIVE',
    '{sql_escape(args.tax_code)}',
    '{sql_escape("Sở NN&PTNT TP. Đà Nẵng")}',
    '{sql_escape("24 Trần Phú, Quận Hải Châu, Thành phố Đà Nẵng")}',
    '{sql_escape(tenant_meta)}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    tax_code = EXCLUDED.tax_code,
    metadata = EXCLUDED.metadata;
""",
    ]

    first_veg_zone_id = None

    for idx, row in enumerate(records):
        zone_id = f"b0000000-0000-0000-0000-{idx + 1:012d}"
        puc_code = f"VN-DAN-Z{idx + 1:04d}"

        crop_type = row.get("Vùng chuyên canh", "").strip()
        district = " ".join(row.get("Quận huyện", "").split())
        ward = row.get("Phường xã", "").strip()
        location = row.get("Địa điểm", "").lstrip("- ").strip()
        note = row.get("Ghi chú", "").strip()

        planned_area = parse_vn_float(row.get("Diện tích quy hoạch (ha)", ""))
        current_area = parse_vn_float(row.get("Diện tích hiện trạng (ha)", ""))
        effective_area = planned_area if (planned_area and planned_area > 0) else current_area
        area_sql = f"{effective_area:.2f}" if (effective_area is not None and effective_area > 0) else "NULL"

        anomalies = []
        if planned_area is not None and current_area is not None and current_area > planned_area:
            anomalies.append("CURRENT_EXCEEDS_PLAN")
        if not (planned_area and planned_area > 0) and not (current_area and current_area > 0):
            anomalies.append("MISSING_ALL_AREA")

        if planned_area and planned_area > 0:
            area_status = "VERIFIED"
        elif current_area and current_area > 0:
            area_status = "FALLBACK_TO_CURRENT"
        else:
            area_status = "PENDING_SURVEY"

        area_parts = [p for p in [location, ward, district] if p]
        display_name = f"{crop_type} — {', '.join(area_parts)}" if area_parts else crop_type
        if len(display_name) > 255:
            display_name = display_name[:252] + "..."

        if first_veg_zone_id is None and "rau" in crop_type.lower():
            first_veg_zone_id = zone_id

        geojson_str = sql_escape(json.dumps(get_district_geojson(district)))
        zone_meta = json.dumps({
            "district": district,
            "ward": ward,
            "location": location,
            "planned_area_ha": planned_area,
            "current_area_ha": current_area,
            "area_status": area_status,
            "anomalies": anomalies,
            "note": note,
            "source": "Cổng Dữ liệu Mở TP. Đà Nẵng (1510/TB-SNN)",
            "license": "CC-BY 4.0",
        }, ensure_ascii=False)

        sql_parts.append(f"""
INSERT INTO production_zones (
    id, tenant_id, zone_code, puc_code, name, crop_type,
    area_hectares, location_geojson, certification, farming_standard, metadata
)
VALUES (
    '{zone_id}',
    '{args.tenant_id}',
    '{puc_code}',
    '{puc_code}',
    '{sql_escape(display_name)}',
    '{sql_escape(crop_type)}',
    {area_sql},
    '{geojson_str}'::jsonb,
    'VietGAP',
    'VietGAP',
    '{sql_escape(zone_meta)}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    zone_code = EXCLUDED.zone_code,
    puc_code = EXCLUDED.puc_code,
    name = EXCLUDED.name,
    crop_type = EXCLUDED.crop_type,
    area_hectares = EXCLUDED.area_hectares,
    location_geojson = EXCLUDED.location_geojson,
    certification = EXCLUDED.certification,
    farming_standard = EXCLUDED.farming_standard,
    metadata = EXCLUDED.metadata;
""")

    target_zone_id = first_veg_zone_id or "b0000000-0000-0000-0000-000000000001"
    batch_meta = json.dumps({
        "document": "1510/TB-SNN",
        "source": "Cổng Dữ liệu Mở TP. Đà Nẵng",
        "license": "CC-BY 4.0",
    }, ensure_ascii=False)

    sql_parts.append(f"""
INSERT INTO batches (
    id, tenant_id, zone_id, batch_code, public_trace_key,
    product_name, quantity, unit, harvest_date, status, certificate_code, metadata
)
VALUES (
    '{BATCH_ID}',
    '{args.tenant_id}',
    '{target_zone_id}',
    '{sql_escape(args.batch_code)}',
    '{sql_escape(args.trace_key)}',
    '{sql_escape(BATCH_PRODUCT)}',
    2000.000,
    'kg',
    CURRENT_DATE,
    'HARVESTED',
    'VG-DAN-2026-001',
    '{sql_escape(batch_meta)}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    zone_id = EXCLUDED.zone_id,
    batch_code = EXCLUDED.batch_code,
    public_trace_key = EXCLUDED.public_trace_key,
    product_name = EXCLUDED.product_name,
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    status = EXCLUDED.status,
    certificate_code = EXCLUDED.certificate_code,
    metadata = EXCLUDED.metadata;
""")
    sql_parts.append("COMMIT;")

    run_psql("\n".join(sql_parts))
    print(f"[OK] Ingested tenant '{args.tenant_code}', {len(records)} production_zones, and batch '{args.batch_code}' (zone={target_zone_id}).")


if __name__ == "__main__":
    main()
