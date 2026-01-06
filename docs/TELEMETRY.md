## Optional Telemetry (Opt-in)

- Goal: capture failure modes and selector drift without collecting PII.
- Scope: error codes, platform name, command name, anonymized timing; no URLs, no product titles, no user text.
- Storage: none by default; only if user opts in via preferences.
- Redaction: run through `redactSensitive` before emitting; strip contact/address/payment fields.
- Transport: future hook to send to a backend; keep disabled unless configured.


