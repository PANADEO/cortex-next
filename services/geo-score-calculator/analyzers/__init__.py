# Four analyzers, one per GEO Score dimension — ported from
# geo_calc/app/backend/analyzers/*.py. Each returns a plain dict with the
# camelCase keys the /analyze response contract expects (see ../models.py),
# not the snake_case NamedTuples of the original PoC.
