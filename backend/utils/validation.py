"""Request validation — reject bad input before it ever reaches a model."""

from __future__ import annotations

from typing import Any

# Physically plausible ranges. Values outside these are almost certainly unit
# errors or typos; passing them to the model would yield confident nonsense.
RANGES: dict[str, tuple[float, float]] = {
    "ph":   (0.0, 14.0),
    "tds":  (0.0, 20000.0),
    "co3":  (0.0, 1000.0),
    "hco3": (0.0, 3000.0),
    "cl":   (0.0, 10000.0),
    "f":    (0.0, 50.0),
    "no3":  (0.0, 2000.0),
    "so4":  (0.0, 3000.0),
    "na":   (0.0, 5000.0),
    "k":    (0.0, 1000.0),
    "ca":   (0.0, 2000.0),
    "mg":   (0.0, 2000.0),
    "th":   (0.0, 5000.0),
}

REQUIRED = list(RANGES.keys())


class ValidationError(ValueError):
    """Raised when a well payload is malformed. Carries a list of problems."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def validate_well(payload: Any) -> dict[str, Any]:
    """Validate and coerce a single well payload. Returns a clean dict."""
    if not isinstance(payload, dict):
        raise ValidationError(["Request body must be a JSON object."])

    errors: list[str] = []
    well: dict[str, Any] = {}

    missing = [f for f in REQUIRED if f not in payload or payload[f] is None]
    if missing:
        errors.append(f"Missing required chemistry fields: {', '.join(missing)}")

    for field in REQUIRED:
        if field in payload and payload[field] is not None:
            try:
                val = float(payload[field])
            except (TypeError, ValueError):
                errors.append(f"'{field}' must be a number, got {payload[field]!r}")
                continue

            lo, hi = RANGES[field]
            if not (lo <= val <= hi):
                errors.append(
                    f"'{field}' = {val} is outside the plausible range [{lo}, {hi}] "
                    "— check the units."
                )
            else:
                well[field] = val

    # Optional context
    year = payload.get("year", 2020)
    try:
        year = int(year)
    except (TypeError, ValueError):
        errors.append(f"'year' must be an integer, got {year!r}")
    else:
        if not (1990 <= year <= 2100):
            errors.append(f"'year' = {year} is implausible.")
        well["year"] = year

    district = payload.get("district")
    if district is not None:
        if not isinstance(district, str):
            errors.append("'district' must be a string.")
        else:
            well["district"] = district.strip()

    if errors:
        raise ValidationError(errors)

    return well
