/**
 * USSL (Wilcox) salinity–sodium diagram.
 *
 * This is the instrument hydrologists actually read irrigation class off:
 * a 4x4 grid of salinity hazard (C1–C4, x) against sodium hazard (S1–S4, y).
 * Printing "C4S2" as text throws away the grid's meaning — that the classes
 * are *ordered* and that a well sits somewhere on a severity surface.
 * So we plot the well on the grid instead.
 *
 * The model only predicts classes it saw in training, so cells it can never
 * output are drawn as unavailable rather than silently blank.
 */

const C = ["C1", "C2", "C3", "C4"];
const S = ["S4", "S3", "S2", "S1"]; // top-to-bottom: worst sodium at top

// Severity = distance from the C1S1 (best) corner. Drives the wash intensity.
const wash = (ci, si) => {
  const sIdx = 3 - si; // back to S1=0 .. S4=3
  const d = (ci + sIdx) / 6; // 0 .. 1
  return d;
};

export default function UsslDiagram({ irrigationClass, knownClasses = [] }) {
  const W = 420;
  const H = 380;
  const pad = { l: 46, r: 16, t: 16, b: 42 };
  const gw = (W - pad.l - pad.r) / 4;
  const gh = (H - pad.t - pad.b) / 4;

  const cls = irrigationClass ?? null;
  const cSel = cls ? C.indexOf(cls.slice(0, 2)) : -1;
  const sSel = cls ? S.indexOf(cls.slice(2)) : -1;

  const cx = cSel >= 0 ? pad.l + cSel * gw + gw / 2 : null;
  const cy = sSel >= 0 ? pad.t + sSel * gh + gh / 2 : null;

  return (
    <div className="ussl">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={cls ? `USSL diagram, well classified ${cls}` : "USSL diagram"}>
        {/* cells */}
        {C.map((c, ci) =>
          S.map((s, si) => {
            const name = `${c}${s}`;
            const known = knownClasses.length === 0 || knownClasses.includes(name);
            const isSel = name === cls;
            const t = wash(ci, si);
            // teal -> ochre -> iron, matching the risk ramp
            const fill = `color-mix(in oklab, #3d8b8b ${(1 - t) * 100}%, #a63a2e ${t * 100}%)`;
            return (
              <g key={name}>
                <rect
                  x={pad.l + ci * gw}
                  y={pad.t + si * gh}
                  width={gw}
                  height={gh}
                  fill={fill}
                  fillOpacity={known ? (isSel ? 0.34 : 0.13) : 0.04}
                  stroke="#c9c2ae"
                  strokeWidth={isSel ? 2 : 0.6}
                />
                <text
                  x={pad.l + ci * gw + gw / 2}
                  y={pad.t + si * gh + gh / 2 + 4}
                  textAnchor="middle"
                  fontFamily="IBM Plex Mono, monospace"
                  fontSize="10"
                  fontWeight={isSel ? 600 : 400}
                  fill={known ? "#0b2027" : "#b3ada0"}
                  opacity={isSel ? 1 : 0.55}
                >
                  {name}
                </text>
              </g>
            );
          })
        )}

        {/* axes */}
        {C.map((c, ci) => (
          <text key={c}
            x={pad.l + ci * gw + gw / 2} y={H - pad.b + 18}
            textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
            fontSize="11" fontWeight="600" fill="#0b2027">
            {c}
          </text>
        ))}
        {S.map((s, si) => (
          <text key={s}
            x={pad.l - 12} y={pad.t + si * gh + gh / 2 + 4}
            textAnchor="end" fontFamily="IBM Plex Mono, monospace"
            fontSize="11" fontWeight="600" fill="#0b2027">
            {s}
          </text>
        ))}

        <text x={pad.l + (W - pad.l - pad.r) / 2} y={H - 6}
          textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
          fontSize="9" letterSpacing="1.6" fill="#77817f">
          SALINITY HAZARD →
        </text>
        <text x={13} y={pad.t + (H - pad.t - pad.b) / 2}
          textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
          fontSize="9" letterSpacing="1.6" fill="#77817f"
          transform={`rotate(-90 13 ${pad.t + (H - pad.t - pad.b) / 2})`}>
          SODIUM HAZARD →
        </text>

        {/* the well */}
        {cx !== null && (
          <g className="ussl__well">
            <circle className="ussl__ping" cx={cx} cy={cy} r="7"
              fill="none" stroke="#0b2027" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r="7" fill="#0b2027" />
            <circle cx={cx} cy={cy} r="2.6" fill="#f2efe6" />
          </g>
        )}
      </svg>

      <p className="ussl__caption">
        {cls
          ? `This well sits at ${cls} — salinity ${cls.slice(0, 2)}, sodium ${cls.slice(2)}. Severity increases toward the top-right.`
          : "Enter a sample to plot it on the grid."}
        {knownClasses.length > 0 && (
          <> Faded cells are classes the model never saw in training and cannot predict.</>
        )}
      </p>
    </div>
  );
}
