# Particle Field Count Limit Hotfix

Raises the Particle Field `Count` maximum from **80** to **200** consistently across:

- Studio Inspector
- Layout validation
- Runtime renderer

No database migration is required.

## Apply

Extract into the project root and choose Replace/Overwrite. Then run:

```powershell
npm run typecheck
npm run test:static
```

You can now enter values such as `96`, `120`, `150`, or up to `200`.

For a full-screen global field, start around 96–120 and only increase further if scrolling remains smooth on desktop and mobile.
