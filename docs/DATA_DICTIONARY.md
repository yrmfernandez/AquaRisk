# Data Dictionary — `groundwater_clean_2018_2020.csv`

Cleaned, unified post-monsoon groundwater quality for Telangana, India (2018–2020).
Produced by `src/clean_data.py` from three raw yearly CSVs.

**Rows:** 1,106 &nbsp;•&nbsp; **Districts:** 33 &nbsp;•&nbsp; **Years:** 2018, 2019, 2020

## Columns

| Column | Type | Unit | Description |
|---|---|---|---|
| `year` | int | — | Sampling year (2018–2020) |
| `season` | str | — | Always `post_monsoon` |
| `sno` | int | — | Original serial number within the yearly file |
| `district` | str | — | District name (Title Case) |
| `mandal` | str | — | Mandal / sub-district |
| `village` | str | — | Village / sampling locality |
| `lat` | float | °N | Latitude (GIS) |
| `lon` | float | °E | Longitude (GIS) |
| `gwl` | float | m | Groundwater level (missing values imputed with district median) |
| `ph` | float | — | pH |
| `ec` | float | µS/cm | Electrical conductivity |
| `tds` | float | mg/L | Total dissolved solids |
| `co3` | float | mg/L | Carbonate |
| `hco3` | float | mg/L | Bicarbonate |
| `cl` | float | mg/L | Chloride |
| `f` | float | mg/L | Fluoride (health-critical) |
| `no3` | float | mg/L | Nitrate (health-critical) |
| `so4` | float | mg/L | Sulfate |
| `na` | float | mg/L | Sodium |
| `k` | float | mg/L | Potassium |
| `ca` | float | mg/L | Calcium |
| `mg` | float | mg/L | Magnesium |
| `th` | float | mg/L | Total hardness (as CaCO₃) |
| `sar` | float | — | Sodium adsorption ratio |
| `rsc` | float | meq/L | Residual sodium carbonate |
| `irrigation_class` | str | — | Original USSL irrigation class (e.g. C2S1, C3S1) |
| `rsc_class` | str | — | Original RSC-based suitability class |
| `bis_exceedances` | int | — | Number of BIS 10500 limits the sample exceeds |
| `drinking_risk` | str | — | Derived label: `Safe` (0), `Moderate` (1–2), `High` (3+) |

## Drinking-water risk logic (BIS 10500:2012)

A sample counts one exceedance per parameter outside its acceptable limit:

| Parameter | Acceptable limit |
|---|---|
| pH | 6.5 – 8.5 |
| TDS | ≤ 500 mg/L |
| Total hardness | ≤ 200 mg/L |
| Chloride | ≤ 250 mg/L |
| **Fluoride** | ≤ 1.0 mg/L |
| **Nitrate** | ≤ 45 mg/L |
| Sulfate | ≤ 200 mg/L |
| Calcium | ≤ 75 mg/L |
| Magnesium | ≤ 30 mg/L |

`drinking_risk` = **Safe** (0 exceedances) · **Moderate** (1–2) · **High** (3+).

## Notes / known gaps

- `co3` (carbonate) is blank for ~160 rows in the raw 2019 file — left as `NaN` by
  design rather than guessed. Decide imputation during modeling.
- One `ph` value is missing. Chemistry columns are **not** imputed automatically;
  only `gwl` is.
- `irrigation_class` / `rsc` / `sar` are carried over from the source data as-is.
