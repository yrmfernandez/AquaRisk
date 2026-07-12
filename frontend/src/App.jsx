import { useEffect, useMemo, useState } from "react";
import UsslDiagram from "./components/UsslDiagram.jsx";
import ShapBars from "./components/ShapBars.jsx";

/* The 13-parameter panel, in the order a lab report prints it.
   Units matter: a reading entered in the wrong unit is the single most
   likely way to get a confident, wrong answer out of this system. */
const PANEL = [
  { k: "ph",   name: "pH",           unit: "",       hint: "Acidity" },
  { k: "tds",  name: "TDS",          unit: "mg/L",   hint: "Total dissolved solids" },
  { k: "co3",  name: "CO₃",          unit: "mg/L",   hint: "Carbonate" },
  { k: "hco3", name: "HCO₃",         unit: "mg/L",   hint: "Bicarbonate" },
  { k: "cl",   name: "Cl",           unit: "mg/L",   hint: "Chloride" },
  { k: "f",    name: "F",            unit: "mg/L",   hint: "Fluoride" },
  { k: "no3",  name: "NO₃",          unit: "mg/L",   hint: "Nitrate" },
  { k: "so4",  name: "SO₄",          unit: "mg/L",   hint: "Sulphate" },
  { k: "na",   name: "Na",           unit: "mg/L",   hint: "Sodium" },
  { k: "k",    name: "K",            unit: "mg/L",   hint: "Potassium" },
  { k: "ca",   name: "Ca",           unit: "mg/L",   hint: "Calcium" },
  { k: "mg",   name: "Mg",           unit: "mg/L",   hint: "Magnesium" },
  { k: "th",   name: "TH",           unit: "mg/L",   hint: "Total hardness" },
];

/* Two real samples from the dataset — so a first-time visitor can see the
   system work without hunting for a lab report. */
const SAMPLES = {
  contaminated: {
    ph: 7.9, tds: 2040, co3: 13, hco3: 460, cl: 568, f: 1.6, no3: 222,
    so4: 110, na: 360, k: 32, ca: 141, mg: 105, th: 787,
    district: "Nalgonda", year: 2020,
  },
  clean: {
    ph: 7.4, tds: 420, co3: 0, hco3: 180, cl: 45, f: 0.4, no3: 8,
    so4: 15, na: 35, k: 2, ca: 48, mg: 20, th: 180,
    district: "Adilabad", year: 2020,
  },
};

const EMPTY = Object.fromEntries(PANEL.map((p) => [p.k, ""]));

const slug = (s) => s.toLowerCase();

export default function App() {
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState({ ...EMPTY, district: "", year: 2020 });
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetch("/api/metadata")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setMeta)
      .catch(() => setOffline(true));
  }, []);

  const ranges = meta?.field_ranges ?? {};

  /* Flag out-of-range values as the user types, rather than waiting for the
     server to reject the whole form. */
  const bad = useMemo(() => {
    const out = {};
    for (const p of PANEL) {
      const v = form[p.k];
      if (v === "" || v == null) continue;
      const n = Number(v);
      const r = ranges[p.k];
      if (Number.isNaN(n) || (r && (n < r.min || n > r.max))) out[p.k] = true;
    }
    return out;
  }, [form, ranges]);

  const complete = PANEL.every((p) => form[p.k] !== "" && form[p.k] != null);
  const canSubmit = complete && Object.keys(bad).length === 0 && !busy;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = (which) => {
    setForm({ ...SAMPLES[which] });
    setResult(null);
    setErrors([]);
  };

  const clear = () => {
    setForm({ ...EMPTY, district: "", year: 2020 });
    setResult(null);
    setErrors([]);
  };

  async function assess() {
    setBusy(true);
    setErrors([]);
    try {
      const body = { ...form };
      for (const p of PANEL) body[p.k] = Number(body[p.k]);
      body.year = Number(body.year);
      if (!body.district) delete body.district;

      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        setErrors(json.details ?? ["The assessment could not be completed."]);
        setResult(null);
      } else {
        setResult(json);
      }
    } catch {
      setErrors(["Cannot reach the assessment service. Check that the API is running."]);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  const d = result?.drinking;
  const irr = result?.irrigation;
  const an = result?.anomaly;

  return (
    <>
      <header className="masthead">
        <div className="masthead__inner">
          <p className="eyebrow">Telangana · post-monsoon · 2018–2020</p>
          <h1>Read a well before you dig it.</h1>
          <p>
            Enter a water sample's chemistry. Three models assess it — drinking safety
            against BIS&nbsp;10500, irrigation suitability on the USSL grid, and whether the
            chemistry itself is unusual enough to warrant a second look.
          </p>
        </div>
      </header>

      <main className="shell">
        {/* ---------------- Input ---------------- */}
        <section className="panel" aria-labelledby="panel-title">
          <h2 className="panel__title" id="panel-title">Sample</h2>
          <p className="panel__note">
            All thirteen readings are required. Values are in mg/L except pH.
          </p>

          <div className="field">
            <label htmlFor="district">District</label>
            <select
              id="district"
              value={form.district}
              onChange={(e) => set("district", e.target.value)}
            >
              <option value="">Not recorded</option>
              {(meta?.districts ?? []).map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="year">Year sampled</label>
            <input
              id="year" type="number" value={form.year}
              onChange={(e) => set("year", e.target.value)}
            />
          </div>

          <div className="lab">
            {PANEL.map((p) => (
              <div className="lab__row" key={p.k}>
                <label className="lab__name" htmlFor={`f-${p.k}`}>
                  {p.name}
                  <span>{p.hint}</span>
                </label>
                <input
                  id={`f-${p.k}`}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  className={bad[p.k] ? "is-bad" : ""}
                  aria-invalid={!!bad[p.k]}
                  value={form[p.k]}
                  onChange={(e) => set(p.k, e.target.value)}
                />
                <span className="lab__unit">{p.unit}</span>
              </div>
            ))}
          </div>

          <div className="actions">
            <button className="btn btn--primary" onClick={assess} disabled={!canSubmit}>
              {busy ? "Assessing…" : "Assess sample"}
            </button>
            <button className="btn btn--ghost" onClick={clear}>Clear</button>
          </div>

          <div className="actions">
            <button className="btn btn--ghost" onClick={() => load("clean")}>
              Load clean sample
            </button>
            <button className="btn btn--ghost" onClick={() => load("contaminated")}>
              Load contaminated
            </button>
          </div>
        </section>

        {/* ---------------- Results ---------------- */}
        <section className="results">
          {offline && (
            <div className="alert">
              <p className="alert__title">Service unreachable</p>
              Start the API with <code>python -m backend.app</code> from the project root,
              then reload.
            </div>
          )}

          {errors.length > 0 && (
            <div className="alert">
              <p className="alert__title">Check these readings</p>
              <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}

          {!result && !offline && (
            <div className="empty">
              <h3>No sample assessed yet</h3>
              <p>
                Fill in the panel, or load one of the two real samples from the dataset
                to see how the models read a well.
              </p>
            </div>
          )}

          {d && (
            <article className={`verdict verdict--${slug(d.risk)}`}>
              <div className="verdict__head">
                <div>
                  <p className="verdict__label">Drinking water · BIS 10500</p>
                  <p className={`verdict__value verdict__value--${slug(d.risk)}`}>
                    {d.risk} risk
                  </p>
                </div>
                <span className="confidence">{Math.round(d.confidence * 100)}% confident</span>
              </div>

              <div className="probs">
                {["Safe", "Moderate", "High"].map((c) => (
                  <div className="prob" key={c}>
                    <span>{c}</span>
                    <div className="prob__track">
                      <div
                        className="prob__fill"
                        style={{
                          width: `${(d.probabilities[c] ?? 0) * 100}%`,
                          background: `var(--${slug(c)})`,
                        }}
                      />
                    </div>
                    <span className="prob__pct">
                      {Math.round((d.probabilities[c] ?? 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>

              {d.warning && <div className="warn">{d.warning}</div>}

              <ShapBars items={d.explanation} verdict={`${d.risk} risk`} />
            </article>
          )}

          {irr && (
            <article className="verdict">
              <div className="verdict__head">
                <div>
                  <p className="verdict__label">Irrigation · USSL classification</p>
                  <p className="verdict__value">{irr.irrigation_class}</p>
                </div>
                <span className="confidence">
                  {Math.round(irr.confidence * 100)}% confident
                </span>
              </div>

              <UsslDiagram
                irrigationClass={irr.irrigation_class}
                knownClasses={meta?.irrigation_classes ?? []}
              />

              <ShapBars items={irr.explanation} verdict={irr.irrigation_class} />
            </article>
          )}

          {an && (
            <article className={`verdict ${an.is_anomaly ? "verdict--anomaly" : ""}`}>
              <div className="verdict__head">
                <div>
                  <p className="verdict__label">Chemistry check · unsupervised</p>
                  <p className={`verdict__value ${an.is_anomaly ? "verdict__value--anomaly" : ""}`}>
                    {an.is_anomaly ? "Unusual" : "Typical"}
                  </p>
                </div>
                <span className="confidence">score {an.anomaly_score}</span>
              </div>
              <p style={{ margin: "0.6rem 0 0", fontSize: "var(--step--1)", color: "#5f6b6f" }}>
                {an.interpretation}
              </p>
            </article>
          )}

          {result && (
            <p className="caveat">
              <strong>These are estimates, not a lab result.</strong> The drinking model is
              a triage aid for deciding where to send test kits first — it is weakest on the
              Moderate class, and it explains what the model learned, not what the ground
              truth is. Confirm any consequential decision with a laboratory panel.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
