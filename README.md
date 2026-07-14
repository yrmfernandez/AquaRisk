---
title: AquaRisk
emoji: 💧
colorFrom: gray
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# AquaRisk — Telangana Groundwater Quality Risk Assessment

Enter a well's water chemistry; three models assess it.

- **Drinking safety** — Safe / Moderate / High against BIS 10500:2012
- **Irrigation suitability** — USSL classification from ion chemistry
- **Chemistry check** — Isolation Forest flags samples unlike anything in training

Trained on 1,106 post-monsoon groundwater samples from 33 Telangana districts, 2018–2020.

## What the models were not allowed to see

A drinking-safety label derived from BIS thresholds is a function of the very chemistry
that defines it. Feed fluoride and nitrate back in as features and the model scores
near-perfectly while learning nothing — it has simply read the answer. Those columns were
withheld.

| Model | Macro-F1 | Withheld |
|---|---|---|
| Drinking (XGBoost) | 0.670 | `f`, `no3`, `tds`, `ph`, `so4`, `cl`, `th`, `ca`, `mg` |
| Irrigation (Random Forest) | 0.735 | `ec`, `sar`, `tds` — the USSL grid is computed from these |
| Anomaly (Isolation Forest) | — | unsupervised |

Macro-F1, not accuracy: the risk classes are heavily imbalanced, and a model predicting the
majority class every time would post a flattering accuracy and be useless.

## Caveat

These are estimates, not laboratory results. The drinking model is a triage aid for deciding
where to send test kits first. Confirm any consequential decision with a lab panel.

---

Source: [github.com/yrmfernandez/AquaRisk](https://github.com/yrmfernandez/AquaRisk)
