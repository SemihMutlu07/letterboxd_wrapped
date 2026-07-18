# Dependency audit exceptions

## Starlette 0.49.3

`PYSEC-2026-161`, `PYSEC-2026-249`, `PYSEC-2026-248`,
`PYSEC-2026-2281`, and `PYSEC-2026-2280` currently require Starlette 1.x.
FastAPI 0.139 constrains Starlette to `<1.0`, so the fixed versions cannot be
installed together yet. Dependabot remains enabled; remove these exceptions as
soon as FastAPI supports the fixed Starlette line. Review by 2026-08-15.
