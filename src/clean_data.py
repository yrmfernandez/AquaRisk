"""
clean_data.py
=============
Cleans and unifies the raw Telangana post-monsoon groundwater quality datasets
(2018, 2019, 2020) into a single tidy, analysis-ready CSV, and derives a
BIS 10500 based drinking-water risk label for each sample.

Raw data problems this script fixes
------------------------------------
1. Column names differ across years:
     - E.C / EC          -> ec
     - CO3 / CO_-2       -> co3
     - HCO3 / HCO_ -     -> hco3
     - Cl / Cl -         -> cl
     - F / F -           -> f
     - NO3 / NO3-        -> no3
     - SO4 / SO4-2       -> so4
     - Na / Na+ ...      -> na, k, ca, mg
   plus stray leading/trailing whitespace in many headers.
2. The 2020 file has an extra empty column ("Unnamed: 8") that must be dropped.
3. The `season` string is written three different ways
   ("postmonsoon 2018 ", "post monsoon 2019", "Post-monsoon 2020"); it is
   normalised and the year is extracted into its own column.
4. Chemistry columns arrive as strings/objects with blanks; they are coerced
   to numeric.
5. A few `gwl` (groundwater level) values are missing; they are imputed with
   the district median (falling back to the global median).

Usage
-----
    python src/clean_data.py

Outputs
-------
    data/processed/groundwater_clean_2018_2020.csv
"""

from pathlib import Path
import pandas as pd
import numpy as np

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

RAW_FILES = {
    2018: RAW_DIR / "ground_water_quality_2018_post.csv",
    2019: RAW_DIR / "ground_water_quality_2019_post.csv",
    2020: RAW_DIR / "ground_water_quality_2020_post.csv",
}

# --------------------------------------------------------------------------- #
# 1. Canonical column mapping
#    Every raw header (after .strip()) maps to one clean, consistent name.
# --------------------------------------------------------------------------- #
COLUMN_MAP = {
    "sno": "sno",
    "district": "district",
    "mandal": "mandal",
    "village": "village",
    "lat_gis": "lat",
    "long_gis": "lon",
    "gwl": "gwl",
    "season": "season",
    "pH": "ph",
    # electrical conductivity
    "E.C": "ec", "EC": "ec",
    "TDS": "tds",
    # carbonate
    "CO3": "co3", "CO_-2": "co3",
    # bicarbonate
    "HCO3": "hco3", "HCO_ -": "hco3",
    # chloride
    "Cl": "cl", "Cl -": "cl",
    # fluoride
    "F": "f", "F -": "f",
    # nitrate
    "NO3": "no3", "NO3-": "no3",
    # sulfate
    "SO4": "so4", "SO4-2": "so4",
    # cations
    "Na": "na", "Na+": "na",
    "K": "k", "K+": "k",
    "Ca": "ca", "Ca+2": "ca",
    "Mg": "mg", "Mg+2": "mg",
    # totals / indices
    "T.H": "th",
    "SAR": "sar",
    "Classification": "irrigation_class",
    "RSC  meq  / L": "rsc",
    "Classification.1": "rsc_class",
}

# Numeric chemistry / measurement columns
NUMERIC_COLS = [
    "lat", "lon", "gwl", "ph", "ec", "tds", "co3", "hco3", "cl", "f",
    "no3", "so4", "na", "k", "ca", "mg", "th", "sar", "rsc",
]


# --------------------------------------------------------------------------- #
# 2. Per-file loader / normaliser
# --------------------------------------------------------------------------- #
def load_and_standardise(path: Path, year: int) -> pd.DataFrame:
    """Read one raw yearly CSV and return it with canonical columns."""
    df = pd.read_csv(path, encoding="latin-1")

    # Drop fully-empty "Unnamed" columns (the 2020 junk column)
    df = df.drop(columns=[c for c in df.columns if str(c).startswith("Unnamed")])

    # Strip whitespace from headers, then rename via the canonical map
    df.columns = [str(c).strip() for c in df.columns]
    unknown = [c for c in df.columns if c not in COLUMN_MAP]
    if unknown:
        raise ValueError(f"[{year}] Unmapped columns: {unknown}")
    df = df.rename(columns=COLUMN_MAP)

    # Normalise season + add an explicit year column
    df["season"] = "post_monsoon"
    df["year"] = year

    return df


# --------------------------------------------------------------------------- #
# 3. Cleaning helpers
# --------------------------------------------------------------------------- #
def coerce_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """Force chemistry columns to numeric; blanks/garbage become NaN."""
    for col in NUMERIC_COLS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def clean_text(df: pd.DataFrame) -> pd.DataFrame:
    """Trim whitespace and standardise casing on location/text columns."""
    for col in ["district", "mandal", "village"]:
        df[col] = df[col].astype(str).str.strip().str.title()
    for col in ["irrigation_class", "rsc_class"]:
        df[col] = df[col].astype(str).str.strip().str.upper()
    return df


def impute_gwl(df: pd.DataFrame) -> pd.DataFrame:
    """Fill missing groundwater level with district median, then global median."""
    district_median = df.groupby("district")["gwl"].transform("median")
    df["gwl"] = df["gwl"].fillna(district_median)
    df["gwl"] = df["gwl"].fillna(df["gwl"].median())
    return df


# --------------------------------------------------------------------------- #
# 4. BIS 10500 drinking-water risk label
#    Each parameter has an acceptable limit. We count how many limits a sample
#    exceeds and bin that count into a 3-level risk category.
# --------------------------------------------------------------------------- #
# BIS 10500:2012 acceptable limits (mg/L unless noted)
BIS_LIMITS = {
    "ph_low": 6.5, "ph_high": 8.5,   # pH acceptable range
    "tds": 500,
    "th": 200,     # total hardness as CaCO3
    "cl": 250,
    "f": 1.0,      # fluoride (health-critical)
    "no3": 45,     # nitrate  (health-critical)
    "so4": 200,
    "ca": 75,
    "mg": 30,
}


def count_exceedances(row: pd.Series) -> int:
    """Number of BIS parameters a sample exceeds."""
    n = 0
    if pd.notna(row["ph"]) and not (BIS_LIMITS["ph_low"] <= row["ph"] <= BIS_LIMITS["ph_high"]):
        n += 1
    for key in ["tds", "th", "cl", "f", "no3", "so4", "ca", "mg"]:
        val = row[key]
        if pd.notna(val) and val > BIS_LIMITS[key]:
            n += 1
    return n


def add_drinking_risk(df: pd.DataFrame) -> pd.DataFrame:
    df["bis_exceedances"] = df.apply(count_exceedances, axis=1)

    def label(n: int) -> str:
        if n == 0:
            return "Safe"
        if n <= 2:
            return "Moderate"
        return "High"

    df["drinking_risk"] = df["bis_exceedances"].apply(label)
    return df


# --------------------------------------------------------------------------- #
# 5. Pipeline
# --------------------------------------------------------------------------- #
def main() -> None:
    frames = [load_and_standardise(path, yr) for yr, path in RAW_FILES.items()]
    df = pd.concat(frames, ignore_index=True)

    df = coerce_numeric(df)
    df = clean_text(df)
    df = impute_gwl(df)
    df = add_drinking_risk(df)

    # Reorder: identifiers -> location -> chemistry -> indices -> labels
    ordered = (
        ["year", "season", "sno", "district", "mandal", "village", "lat", "lon", "gwl"]
        + ["ph", "ec", "tds", "co3", "hco3", "cl", "f", "no3", "so4",
           "na", "k", "ca", "mg", "th"]
        + ["sar", "rsc", "irrigation_class", "rsc_class"]
        + ["bis_exceedances", "drinking_risk"]
    )
    df = df[ordered]

    out_path = OUT_DIR / "groundwater_clean_2018_2020.csv"
    df.to_csv(out_path, index=False)

    # ---- Console summary ----
    print(f"Wrote {out_path.relative_to(ROOT)}")
    print(f"Rows: {len(df)}  |  Columns: {df.shape[1]}")
    print(f"Years: {sorted(df['year'].unique())}")
    print(f"Districts: {df['district'].nunique()}")
    print("Drinking-water risk distribution:")
    print(df["drinking_risk"].value_counts().to_string())
    remaining = df[NUMERIC_COLS].isna().sum()
    remaining = remaining[remaining > 0]
    if len(remaining):
        print("Remaining NaNs (chemistry not imputed by design):")
        print(remaining.to_string())


if __name__ == "__main__":
    main()
