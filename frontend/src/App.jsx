import { useEffect, useMemo, useState } from "react";
import UsslDiagram from "./components/UsslDiagram.jsx";
import ShapBars from "./components/ShapBars.jsx";

/* The 13-parameter panel, in the order a lab report prints it.
   Units matter: a reading entered in the wrong unit is the single most
   likely way to get a confident, wrong answer out of this system. */
const PANEL = [
  { k: "ph",   name: "pH",   unit: "",     hint: "Acidity" },
  { k: "tds",  name: "TDS",  unit: "mg/L", hint: "Total dissolved solids" },
  { k: "co3",  name: "CO₃",  unit: "mg/L", hint: "Carbonate" },
  { k: "hco3", name: "HCO₃", unit: "mg/L", hint: "Bicarbonate" },
  { k: "cl",   name: "Cl",   unit: "mg/L", hint: "Chloride" },
  { k: "f",    name: "F",    unit: "mg/L", hint: "Fluoride" },
  { k: "no3",  name: "NO₃",  unit: "mg/L", hint: "Nitrate" },
  { k: "so4",  name: "SO₄",  unit: "mg/L", hint: "Sulphate" },
  { k: "na",   name: "Na",   unit: "mg/L", hint: "Sodium" },
  { k: "k",    name: "K",    unit: "mg/L", hint: "Potassium" },
  { k: "ca",   name: "Ca",   unit: "mg/L", hint: "Calcium" },
  { k: "mg",   name: "Mg",   unit: "mg/L", hint: "Magnesium" },
  { k: "th",   name: "TH",   unit: "mg/L", hint: "Total hardness" },
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
const pct = (x) => Math.round((x ?? 0) * 100);

/* Wordmark: a well section. Two strata, a water table, a sample point.
   Drawn rather than imported so it inherits currentColor and needs no asset. */
function Mark({ size = 26 }) {
  return (
    <svg
      className="brand__mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="22" height="22" stroke="currentColor" strokeOpacity="0.35" />
      <path d="M1 9h22" stroke="currentColor" strokeOpacity="0.35" />
      <path d="M1 14.5c3.2 0 3.2-1.8 6.4-1.8s3.2 1.8 6.4 1.8 3.2-1.8 6.4-1.8c1.1 0 1.7.2 2.3.5"
            stroke="#3d8b8b" strokeWidth="1.4" />
      <path d="M12 1v7.6" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx="12" cy="14.4" r="2.6" fill="#3d8b8b" />
      <circle cx="12" cy="14.4" r="0.9" fill="#0b2027" />
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <div className="skeleton__line skeleton__line--label" />
      <div className="skeleton__line skeleton__line--value" />
      <div className="skeleton__line skeleton__line--bar" style={{ marginTop: "1.1rem" }} />
      <div className="skeleton__line skeleton__line--bar" />
      <div className="skeleton__line skeleton__line--short" />
    </div>
  );
}

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

  const filled = PANEL.filter((p) => form[p.k] !== "" && form[p.k] != null).length;
  const complete = filled === PANEL.length;
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
      {/* ================= Masthead ================= */}
      <header className="masthead">
        <div className="masthead__inner">
          <div className="brand">
            <Mark />
            <span className="brand__name">
              <b>AquaRisk</b> <i>/ Telangana</i>
            </span>
            <span className="brand__meta">BIS 10500 · USSL</span>
          </div>

          <p className="eyebrow">Post-monsoon · 2018–2020</p>
          <h1>Read a well before you drink from it.</h1>
          <p className="masthead__lede">
            Enter a water sample&rsquo;s chemistry. Three models assess it — drinking safety
            against BIS&nbsp;10500, irrigation suitability on the USSL grid, and whether the
            chemistry itself is unusual enough to warrant a second look.
          </p>

          <dl className="stats">
            <div className="stat">
              <span className="stat__value">33</span>
              <span className="stat__label">Districts</span>
            </div>
            <div className="stat">
              <span className="stat__value">1,106</span>
              <span className="stat__label">Samples</span>
            </div>
            <div className="stat">
              <span className="stat__value">13</span>
              <span className="stat__label">Parameters</span>
            </div>
            <div className="stat">
              <span className="stat__value">3</span>
              <span className="stat__label">Models</span>
            </div>
          </dl>
        </div>
      </header>

      <main className="shell">
        {/* ================= Input ================= */}
        <section className="panel panel--sticky" aria-labelledby="panel-title">
          <h2 className="panel__title" id="panel-title">Sample</h2>
          <p className="panel__note">
            All thirteen readings are required — {filled} of {PANEL.length} entered.
          </p>

          <div className="field field__pair">
            <div>
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
            <div>
              <label htmlFor="year">Year</label>
              <input
                id="year" type="number" value={form.year}
                onChange={(e) => set("year", e.target.value)}
              />
            </div>
          </div>

          <div className="lab">
            <div className="lab__head" aria-hidden="true">
              <span>Parameter</span>
              <span>Value</span>
              <span>Unit</span>
            </div>

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
                  placeholder="—"
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

          <div className="presets">
            <p className="presets__label">Or load a real sample</p>
            <div className="presets__row">
              <button className="btn--tiny" onClick={() => load("clean")}>
                Adilabad · clean
              </button>
              <button className="btn--tiny" onClick={() => load("contaminated")}>
                Nalgonda · contaminated
              </button>
            </div>
          </div>
        </section>

        {/* ================= Results ================= */}
        <section className="results" aria-live="polite">
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

          {busy && (
            <>
              <Skeleton />
              <Skeleton />
            </>
          )}

          {!result && !busy && !offline && errors.length === 0 && (
            <div className="empty">
              <svg className="empty__mark" width="34" height="34" viewBox="0 0 24 24"
                   fill="none" aria-hidden="true">
                <path d="M1 13c3.2 0 3.2-1.8 6.4-1.8s3.2 1.8 6.4 1.8 3.2-1.8 6.4-1.8c1.1 0 1.7.2 2.3.5"
                      stroke="#3d8b8b" strokeWidth="1.3" />
                <path d="M1 18c3.2 0 3.2-1.8 6.4-1.8s3.2 1.8 6.4 1.8 3.2-1.8 6.4-1.8c1.1 0 1.7.2 2.3.5"
                      stroke="#3d8b8b" strokeWidth="1.3" strokeOpacity="0.45" />
                <path d="M12 2v7" stroke="#0b2027" strokeWidth="1.3" strokeOpacity="0.5" />
                <circle cx="12" cy="9.6" r="1.8" fill="#0b2027" fillOpacity="0.5" />
              </svg>
              <h3>No sample assessed yet</h3>
              <p>
                Fill in the panel, or load one of the two real samples from the dataset
                to see how the models read a well.
              </p>
            </div>
          )}

          {d && !busy && (
            <article className={`verdict verdict--${slug(d.risk)}`}>
              <div className="verdict__head">
                <div>
                  <p className="verdict__label">Drinking water · BIS 10500</p>
                  <p className={`verdict__value verdict__value--${slug(d.risk)}`}>
                    {d.risk} risk
                  </p>
                </div>
                <span className="confidence">{pct(d.confidence)}% confident</span>
              </div>

              <div className="probs">
                {["Safe", "Moderate", "High"].map((c) => (
                  <div className={`prob${c === d.risk ? " prob--lead" : ""}`} key={c}>
                    <span>{c}</span>
                    <div className="prob__track">
                      <div
                        className="prob__fill"
                        style={{
                          width: `${pct(d.probabilities[c])}%`,
                          background: `var(--${slug(c)})`,
                        }}
                      />
                    </div>
                    <span className="prob__pct">{pct(d.probabilities[c])}%</span>
                  </div>
                ))}
              </div>

              {d.warning && <div className="warn">{d.warning}</div>}

              <ShapBars items={d.explanation} verdict={`${d.risk} risk`} />
            </article>
          )}

          {irr && !busy && (
            <article className="verdict">
              <div className="verdict__head">
                <div>
                  <p className="verdict__label">Irrigation · USSL classification</p>
                  <p className="verdict__value">{irr.irrigation_class}</p>
                </div>
                <span className="confidence">{pct(irr.confidence)}% confident</span>
              </div>

              <UsslDiagram
                irrigationClass={irr.irrigation_class}
                knownClasses={meta?.irrigation_classes ?? []}
              />

              <ShapBars items={irr.explanation} verdict={irr.irrigation_class} />
            </article>
          )}

          {an && !busy && (
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
              <p className="card__body" style={{ marginTop: "0.7rem" }}>
                {an.interpretation}
              </p>
            </article>
          )}

          {result && !busy && (
            <p className="caveat">
              <strong>These are estimates, not a lab result.</strong> The drinking model is
              a triage aid for deciding where to send test kits first — it is weakest on the
              Moderate class, and it explains what the model learned, not what the ground
              truth is. Confirm any consequential decision with a laboratory panel.
            </p>
          )}
        </section>
      </main>

      {/* ================= Method ================= */}
      <section className="method" aria-labelledby="method-title">
        <div className="method__inner">
          <p className="method__eyebrow">Method</p>
          <h2 className="method__title" id="method-title">
            What the models were not allowed to see.
          </h2>
          <p className="method__lede">
            A drinking-safety label derived from BIS thresholds is a function of the very
            chemistry that defines it. Feed fluoride and nitrate back in as features and the
            model scores near-perfectly while learning nothing — it has simply read the answer.
            So those columns were withheld. The scores below are lower than a leaky model would
            report, and they are the ones that mean something.
          </p>

          <div className="method__grid">
            <article className="card">
              <p className="card__label">Drinking water</p>
              <p className="card__metric">0.670<small>MACRO-F1</small></p>
              <p className="card__model">XGBoost · SMOTE · ordinal labels</p>
              <p className="card__body">
                Predicts <strong>Safe / Moderate / High</strong> from context and non-BIS ions
                only. Labels are encoded ordinally, because Moderate genuinely sits between the
                other two — alphabetical encoding would throw that away.
              </p>
              <div className="excluded">
                <p className="excluded__label">Withheld — defines the label</p>
                <div className="chips">
                  {["f", "no3", "tds", "ph", "so4", "cl", "th", "ca", "mg", "bis_exceedances"]
                    .map((c) => <span className="chip" key={c}>{c}</span>)}
                </div>
              </div>
            </article>

            <article className="card">
              <p className="card__label">Irrigation</p>
              <p className="card__metric">0.735<small>MACRO-F1</small></p>
              <p className="card__model">Random Forest · SMOTE · ion chemistry</p>
              <p className="card__body">
                Predicts the <strong>USSL class</strong> from ion chemistry. EC, SAR and TDS are
                withheld: the USSL grid is <em>computed</em> from them, so including them would
                hand the model its own answer key.
              </p>
              <div className="excluded">
                <p className="excluded__label">Withheld / kept</p>
                <div className="chips">
                  <span className="chip">ec</span>
                  <span className="chip">sar</span>
                  <span className="chip">tds</span>
                  <span className="chip chip--kept">na</span>
                  <span className="chip chip--kept">ca</span>
                  <span className="chip chip--kept">mg</span>
                  <span className="chip chip--kept">cl</span>
                </div>
              </div>
            </article>

            <article className="card">
              <p className="card__label">Chemistry check</p>
              <p className="card__metric">—<small>UNSUPERVISED</small></p>
              <p className="card__model">Isolation Forest</p>
              <p className="card__body">
                Flags samples whose chemistry is unlike anything in the training set. This is a
                <strong> different axis</strong>, not a worse one — so it is coloured off the risk
                ramp. An unusual well is not necessarily a dangerous well; it is one the other two
                models are least qualified to judge.
              </p>
              <div className="excluded">
                <p className="excluded__label">Why it matters</p>
                <p className="card__body">
                  A confident verdict on an out-of-distribution sample is the most dangerous output
                  this system can produce. This is the check against that.
                </p>
              </div>
            </article>
          </div>

          <p className="caveat" style={{ marginTop: "2.4rem" }}>
            <strong>Macro-F1, not accuracy.</strong> The risk classes are heavily imbalanced —
            a model that predicted the majority class every time would post a flattering accuracy
            and be useless. Macro-F1 weights each class equally, so the rare-but-consequential
            cases still count. Class imbalance was handled with SMOTE on the training split only.
          </p>
        </div>
      </section>

      <footer className="foot">
        <div className="foot__inner">
          <span>AquaRisk</span>
          <span>Telangana Groundwater Quality Risk Assessment</span>
          <span className="foot__sep">
            Data: TS Groundwater Dept · post-monsoon 2018–2020
          </span>
        </div>
      </footer>
    </>
  );
}
