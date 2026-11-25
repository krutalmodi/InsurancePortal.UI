# Insurance Portal Angular client

The Angular client is hosted by `InsurancePortal.UI`, which serves the application and forwards the supported API requests. For setup, service configuration, safety gates and known limitations, see `docs\InsurancePortal.UI.md` at the repository root.

From this directory, run `npm ci`, `npm run build`, and `npm test -- --watch=false`. The build writes to the host's `wwwroot` directory. Use `npm run watch` for continuous client builds while running the .NET host.
