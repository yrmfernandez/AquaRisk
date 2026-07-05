# Groundwater Quality Risk Assessment System

Assessing groundwater quality for **drinking-water safety** (primary) and
**irrigation suitability** (secondary), starting from raw field measurements and
building toward a machine-learning risk-assessment system.

**Status:** Rebuilding — data foundation complete.

---

## Data

Post-monsoon groundwater quality for **Telangana, India**, across **33 districts**
for **2018, 2019, 2020** (~1,100 samples). Each sample carries location, groundwater
level, and a full chemistry panel (pH, EC, TDS, carbonates, Cl, F, NO₃, SO₄, Na, K,
Ca, Mg, hardness) plus irrigation indices (SAR, RSC).

| Path | Contents |
|---|---|
| `data/raw/` | Original yearly CSVs, unmodified |
| `data/processed/groundwater_clean_2018_2020.csv` | Cleaned, unified, analysis-ready table |
| `docs/DATA_DICTIONARY.md` | Column definitions + BIS risk logic |

## Data cleaning

The raw files have inconsistent column names, stray whitespace, an extra empty
column in 2020, three different `season` spellings, and some missing values. The
cleaning pipeline fixes all of these and derives a BIS 10500 drinking-water risk
label. It is available two ways:

- **Script (source of truth):** [`src/clean_data.py`](src/clean_data.py)
- **Notebook (step-by-step walkthrough):** [`notebooks/01_Data_Cleaning.ipynb`](notebooks/01_Data_Cleaning.ipynb)

```bash
pip install -r requirements.txt
python src/clean_data.py
```

### Drinking-water risk label

Each sample is scored against BIS 10500:2012 acceptable limits (pH, TDS, hardness,
Cl, **F**, **NO₃**, SO₄, Ca, Mg). The number of exceedances is binned into:

- **Safe** — 0 exceedances
- **Moderate** — 1–2
- **High** — 3+

See the data dictionary for exact limits and known data gaps.

## Roadmap

- [x] Clean & unify 2018–2020 data
- [x] Derive BIS drinking-water risk label
- [ ] Exploratory data analysis
- [ ] Drinking-water risk classifier
- [ ] Irrigation suitability classifier
- [ ] Anomaly detection + SHAP explainability
- [ ] Web application

## Project structure

```
├── data/
│   ├── raw/                  # original CSVs
│   └── processed/            # cleaned output
├── notebooks/
│   └── 01_Data_Cleaning.ipynb
├── src/
│   └── clean_data.py
├── docs/
│   └── DATA_DICTIONARY.md
├── requirements.txt
└── README.md
```
