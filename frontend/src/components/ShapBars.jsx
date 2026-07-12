/**
 * SHAP contributions.
 *
 * The sign is the information: a feature either pushed the model toward this
 * label or away from it. So bars diverge from a visible zero axis rather than
 * growing from the left — a left-anchored bar chart would hide the sign, which
 * is the one thing the reader needs.
 *
 * Feature names are rewritten for the reader: "dist_Nalgonda" is how the model
 * is built, not how a person thinks. They see "District: Nalgonda".
 */

const CHEM_LABEL = {
  ph: "pH",
  tds: "TDS",
  co3: "Carbonate",
  hco3: "Bicarbonate",
  cl: "Chloride",
  f: "Fluoride",
  no3: "Nitrate",
  so4: "Sulphate",
  na: "Sodium",
  k: "Potassium",
  ca: "Calcium",
  mg: "Magnesium",
  th: "Hardness",
  year: "Year sampled",
};

function humanise(feature) {
  if (feature.startsWith("dist_")) return feature.slice(5);
  return CHEM_LABEL[feature] ?? feature;
}

export default function ShapBars({ items, verdict }) {
  if (!items?.length) return null;

  const max = Math.max(...items.map((d) => Math.abs(d.contribution)));

  return (
    <div className="why">
      <p className="why__title">Why — top contributions</p>

      <div className="shap">
        {items.map((d) => {
          const w = (Math.abs(d.contribution) / max) * 50; // % of half-width
          const up = d.contribution > 0;
          return (
            <div className="shap__row" key={d.feature}>
              <span title={d.feature}>{humanise(d.feature)}</span>
              <div className="shap__axis">
                <div
                  className={`shap__bar shap__bar--${up ? "up" : "down"}`}
                  style={{ width: `${w}%` }}
                  title={`${d.contribution > 0 ? "+" : ""}${d.contribution}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="shap__legend">
        <span>← pushes away from {verdict}</span>
        <span>pushes toward {verdict} →</span>
      </div>
    </div>
  );
}
