# Groundwater Risk Assessment — Frontend

React + Vite. Talks to the Flask API in `backend/`.

## Run

Start the API first (from the **project root**):

```bash
python -m backend.app          # http://127.0.0.1:5000
```

Then, in a second terminal:

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

Vite proxies `/api/*` to Flask, so the browser sees a single origin and there's no CORS
in development. If the API isn't running, the UI says so rather than failing silently.

Build for production: `npm run build` → `dist/`

## What's on screen

One form — the 13-parameter lab panel — and three verdicts:

| Verdict | From | Shows |
|---|---|---|
| **Drinking water** | XGBoost, BIS 10500 | Risk class, probability across all three classes, SHAP contributions |
| **Irrigation** | XGBoost, USSL | Class plotted on the salinity/sodium grid, SHAP contributions |
| **Chemistry check** | Isolation Forest | Whether the chemistry is unusual enough to warrant re-testing |

`Load clean sample` / `Load contaminated` fill the form with two real wells from the
dataset, so the system can be seen working without hunting for a lab report.

## Design notes

**The USSL grid is the signature.** Irrigation class is a coordinate on a real instrument —
salinity (C1–C4) against sodium (S1–S4), severity rising toward the top-right. Printing
`C4S2` as text discards that; plotting the well *on* the grid keeps it. Cells the model never
saw in training are faded, because a model that cannot output a class shouldn't imply it can.

**SHAP bars diverge from a visible zero axis.** The sign is the information — a feature either
pushed the model toward the verdict or away from it. A left-anchored bar would hide that.

**Anomaly is violet, off the risk ramp.** Safe→Moderate→High is an ordered severity scale
(teal → ochre → iron oxide). "Unusual" is a *different axis*, not a worse rung on the same
one, so it deliberately doesn't take a colour from that ramp.

**Field names are rewritten for the reader.** The model has a feature called `dist_Nalgonda`;
a person reads `Nalgonda`. The UI never shows how the model is built.

**Units are on every row.** A reading entered in the wrong unit is the most likely route to a
confident, wrong answer, so out-of-range values are flagged as you type — before the server
sees them.

## Honesty in the interface

The caveat under the results is not boilerplate. The drinking model's macro-F1 is ~0.67 and
it is weakest on the Moderate class (~0.41). It is a triage aid for prioritising where to send
test kits — not a substitute for a laboratory panel, and the UI says so.
