# Insurance Portal UI

This document describes the generated UI solution, its current behavior, service integrations, configuration, and known limitations. The solution root is `D:\Learning\OnPrem Apps\InsurancePortal\ui\InsurancePortal.UI`.

## Documentation convention

Document changes within this solution in this `InsurancePortalUI.md` file only. Update the relevant sections when behavior, configuration, setup, or verification changes; do not create new Markdown documents for solution changes. Existing Markdown files elsewhere are not the source of truth for this solution.

## Recent changes

- Added the Quote details screen (/portal/quotes/:id), opened by clicking the quote reference in My quotes (the gated View column was removed). It finds the quote in the token-scoped GET /api/quotes/user response rather than GET /api/quotes/{id}, so it is ownership-safe and not gated by Features:QuotesEnabled. Ids and codes are resolved to names and descriptions: status and currency (Quote quote-statuses, currencies); Auto vehicle make, model (filtered by make), type, color and driving record; Home type; Health status and coverage type (Quote lookups); and country, province and location type (Location Service). Sections: summary, vehicle/home/health details, address, a deliberately abstract pricing summary (currency, term, total premium; plan name, base rate and rating factors are internal premium-calculation data and are not shown to customers). Lookup failures fall back to raw values with a notice. Acceptance still requires Features:QuotesEnabled and a Quoted, unexpired quote. 37 Angular tests pass. Rebuild/restart the host and hard-refresh.
- My quotes now loads from the Quote Service's token-scoped `GET /api/quotes/user` (no user id in the URL), which the host allowlists independently of `Features:QuotesEnabled`; the previous `/api/quotes/user/{userId}` route is removed. The list is sorted newest first and shows Reference, Product, Status (display name from the `quote-statuses` lookup), Created, Valid until and Premium, with a Status filter, a row count, loading, error/Retry and empty states. The View link appears only when `Features:QuotesEnabled` is true, since get-by-id and accept still lack ownership checks. 37 Angular tests pass. Restart the UI host and hard-refresh the browser.
- Home and Health quote details now use dropdowns. Home: Year built (current year down to 1900) and Number of occupants (0-10). Health: Age (18-100), Number of dependents (0-10), Pre-existing conditions (Yes/No) and Smoking status (from the `smoking-statuses` lookup). The Quote API's `smoker` field is a boolean, so the UI submits `true` only for `CurrentSmoker` (Non-Smoker and Former Smoker submit `false`). Choosing Yes for pre-existing conditions reveals a "Pre-existing condition" dropdown loaded on demand from the `health-statuses` lookup (no dedicated pre-existing-conditions lookup type exists); it is UI-only and is not submitted because the API has no matching field, and it is required only while visible. Vehicle type loads from `vehicle-types`, which the running Quote Service now serves (11 types). Fields support `showIf`, `uiOnly` and `toPayload` in `quote-fields.ts`. 36 Angular tests pass.
- Auto quote details now use standard dropdowns: Vehicle type (from the `vehicle-types` lookup, optional; the host allowlist now has 15 Quote lookup types), Vehicle year (current year down to 1990), Number of drivers (0-10), Estimated annual mileage (0, 1,000, 3,000, 5,000, 8,000, 10,000, 15,000, 20,000, 35,000), At-fault accidents (0-10, optional) and Speeding tickets (0-10, optional). Static choices are defined with `options` on the field in `quote-fields.ts` and submit numbers. The `vehicle-types` lookup exists in the Quote Service source but the running service must be rebuilt/restarted (and migrated) to return it; until then the Vehicle type dropdown shows an error with Retry. Mileage remains a numeric input. 35 Angular tests pass.
- Integrated Quote Service lookups (`GET /api/lookups/{type}`, public). The host allowlists the 14 types `quote-statuses`, `product-types`, `product-quote-statuses`, `quoted-by-types`, `vehicle-colors`, `driving-record-types`, `home-types`, `health-statuses`, `coverage-types`, `smoking-statuses`, `currencies`, `insurance-providers`, `vehicle-makes` and `vehicle-models`; only a numeric `vehicleMakeId` query value is forwarded. The wizard now has dropdowns for vehicle make, model (filtered by the selected make, reset when the make changes), colour, driving record, home type, health status and coverage type. Text-typed fields (driving record, home type, health status, coverage type) submit the lookup `code`; ID fields submit the `id`. The quote list has a Status filter populated from `quote-statuses`. The review step shows names. Not yet bound to UI fields (no matching request field): product types, product quote statuses, quoted-by types, smoking statuses (the request takes a boolean `smoker`), currencies and insurance providers. Vehicle type remains an optional numeric ID (no lookup type exists). A shared `QuoteLookupService` wraps the calls. 34 Angular tests pass; restart the UI host and hard-refresh the browser.
- Integrated the Location Service (`https://localhost:44370/`, setting `Services:Location`). The quote wizard's address step now uses dropdowns for Country, Province / state and Location type instead of numeric IDs. Provinces load per selected country and reset when the country changes; the review step shows names. The lookups are public GET endpoints; the host allowlists only `GET /api/lookups/countries`, `GET /api/lookups/countries/{countryId}/provinces` and `GET /api/lookups/location-types`. Failed loads show an error with a Retry button. Vehicle make/model/colour/type remain numeric reference IDs (no lookup endpoint integrated yet). Restart the UI host and hard-refresh the browser. 32 Angular tests pass and the live proxy returned the Location data.
- Traced the running Identity Swagger at `https://localhost:44388/swagger/v1/swagger.json` and the controller behavior. Registration now includes optional first name, last name and username; the profile page supports authenticated first/last name updates for customer and staff users.
- The UI host allowlists `PATCH /api/auth/me` and forwards the request body, content type and bearer token. The live Identity controller returns 204 on success, despite Swagger listing 200. The UI updates its in-memory profile and header only after success.
- Sign-in still uses login, home and profile checks and role-based routing; a 401 error identifies whether the home or profile check failed. Restart the UI host after rebuilding to load the new PATCH proxy route.
- Fixed zoneless rendering of sign-in and registration failures so the error appears and the form can be submitted again; duplicate submissions are blocked while a request is pending. Quote loading and action responses also notify Angular to refresh the affected views.
- During sign-in, a 401 from the authenticated home or profile check now clears the provisional token and displays a verification error instead of redirecting as though an established session had expired. An established session still signs out on an authenticated 401.
- Rebuilt the Angular assets and UI host; both builds succeeded and 29 Angular tests passed. Live sign-in, registration and profile updates were not tested because account credentials were unavailable.
- Corrected Identity Service's current-user context to read mapped JWT subject, email, name, and role claims as well as raw claims. This allows the authenticated profile endpoint to resolve the signed-in user after the home check. Rebuild and restart Identity Service for this change to take effect.
- The authenticated portal header displays the user's name when available, email, and roles; role-based dashboard navigation remains in place.
- Configured Identity Service at `https://localhost:44388/` and Quote Service at `https://localhost:44303/` using their IIS Express HTTPS endpoints.
- After sign-in, the client sends the bearer token to Identity's `/api/home/index` authentication check, then retrieves the current profile and roles from `/api/auth/me`. The host also forwards `/api/auth/me/roles`.
- Enabled authenticated quote creation behind `Features:QuoteCreationEnabled` (default `true`). Quote listing, detail and acceptance remain gated behind `Features:QuotesEnabled` (default `false`) until Quote Service enforces per-user ownership for those operations.
- Verified Angular submission against the live contract with a mocked 201 response, and verified the host proxy forwards the bearer token and JSON body to an isolated local mock. The mock confirmed quote management stays 503-gated and background operations remain unlisted. The live Quote API returns 401 without a bearer token; local Identity/Quote signing key, issuer and audience settings match. All 30 Angular tests pass. Live quote creation was not attempted because no authenticated user session/approved lookup data was provided.
- Eight targeted Identity tests passed for the earlier claim-mapping change.

## Overview

The solution combines an ASP.NET Core host with a standalone Angular application. It provides public product pages, customer sign-in and registration, a customer portal, and role-based Agent and Admin workspaces. The visual design uses a navy-and-teal palette, responsive layouts, and shared styles.

**Current scope:** Identity integration and authenticated customer quote creation are implemented. The quote form submits one Home, Auto or Health quote and displays its returned reference, status, premium and validity. Quote list/detail/acceptance stay disabled until service-side resource ownership is enforced. Policies, payments, claims, staff directories, assignments, and administration show coming-soon pages.

## Technology and architecture

- **Host:** ASP.NET Core, targeting .NET 10 (`InsurancePortal.UI.csproj`).
- **Client:** Angular 21, TypeScript, Angular Router, template-driven and reactive forms, RxJS, and npm (`ClientApp\package.json`).
- **Tests:** Angular unit/component tests using Vitest and Angular's HTTP testing utilities.
- **Serving:** Angular builds into the host's `wwwroot`; the .NET host serves the static files and routes unmatched UI paths to `index.html`.
- **Integration:** The browser sends same-origin `/api` requests to the .NET host. The host forwards an explicit allowlist to Identity or Quote Service. Quote Service itself calls Location Service; the UI does not directly call Location Service.

```text
Browser (Angular) -> .NET UI host -> Identity Service
								 -> Quote Service -> Location Service
```

The host is not a general-purpose gateway. It forwards the bearer authorization header, request body and content type for allowed operations, uses a 30-second HTTP timeout, and does not follow upstream redirects. Unlisted API operations return 404. Service connection failures return 502, timeouts return 504, and invalid service configuration returns 503.

## Project layout

```text
InsurancePortal.UI\
  InsurancePortal.UI.slnx          Solution
  InsurancePortal.UI.csproj        ASP.NET Core host project
  Program.cs                       Static hosting and API forwarding
  appsettings.json                 Service addresses and feature flag
  Properties\launchSettings.json   Local host profiles
  ClientApp\
	angular.json                   Angular build and test configuration
	package.json                   Scripts and dependencies
	src\
	  main.ts                      Angular bootstrap
	  index.html                   Application entry page
	  styles.css                   Shared responsive design system
	  app\
		app.ts / app.html          Root component and router outlet
		app.config.ts              Router and HTTP providers
		app.routes.ts              Application routes and guards
		core\                      Session, features, guards, interceptor, errors
		public\                    Public home and product pages
		auth\                      Sign-in, sign-up and access-denied pages
		shell\                     Customer and staff navigation/layout
		dashboard\                 Customer, Agent and Admin dashboard
		profile\                   Current-user profile
		shared\coming-soon\        Customer coming-soon page
		staff\                     Staff coming-soon page
		quotes\                    Quote pages, forms, models and API service
  wwwroot\                         Generated Angular output; not source code
```

Each feature component has a separate `.component.ts` and `.component.html` file. Shared visual styles are in `ClientApp\src\styles.css`; component-specific styles, such as the account header, live alongside their components. Do not edit generated `wwwroot` assets directly.

### Components and screens

Paths in this table are relative to `ClientApp\src\app`.

| Component | Files | Purpose |
|---|---|---|
| `PublicPage` | `public\public.component.*` | Landing page, product cards, and sign-in/sign-up navigation. |
| `ProductPage` | `public\product\product.component.*` | Auto, Home, and Health product overview. |
| `AuthPage` | `auth\auth.component.*` | Sign-in and sign-up form, validation, errors, and return navigation. |
| `AccessDeniedPage` | `auth\access-denied\access-denied.component.*` | Access-unavailable message and sign-out/sign-in links. |
| `ShellPage` | `shell\shell.component.*` | Role-aware navigation, responsive sidebar, top bar, and nested router outlet. |
| `DashboardPage` | `dashboard\dashboard.component.*` | Customer, Agent, or Admin overview based on route and roles. |
| `ProfilePage` | `profile\profile.component.*` | Displays the signed-in user's email and roles and edits first and last names. |
| `ComingSoonPage` | `shared\coming-soon\coming-soon.component.*` | Customer policy, payment, and claim placeholders. |
| `StaffPage` | `staff\staff.component.*` | Staff feature placeholders. |
| `QuoteListPage` | `quotes\quote-list\quote-list.component.*` | Customer quote list when enabled, with loading, empty and error states. |
| `QuoteWizardPage` | `quotes\quote-wizard\quote-wizard.component.*` | Product selection, address, details, review, and submission. |
| `QuoteDetailPage` | `quotes\quote-detail\quote-detail.component.*` | Quote details for a quote from GET /api/quotes/user with lookup names/descriptions and an abstract pricing summary; acceptance is gated. |

### Services and shared code

| File | Responsibility |
|---|---|
| `core\session.service.ts` | Registration, login, current profile, in-memory token, roles, session expiry, and sign-out. |
| `core\feature.service.ts` | Reads quote-creation and quote-management availability from the host. |
| `core\auth.interceptor.ts` | Attaches the bearer token to same-origin API requests and handles authenticated 401 responses. |
| `core\auth.guards.ts` | Requires a session and gates customer/staff routes by role. |
| `core\error-message.ts` | Converts request failures into UI error messages. |
| `quotes\quote.service.ts` | Quote create, user list (getMine), detail, and accept HTTP calls. |
| `quotes\quote.model.ts` | Client quote response/request types and product-name helper. |
| `quotes\quote-fields.ts` | Address and product form field definitions and validators. |

## Routes and access

| Route | Screen / access |
|---|---|
| `/` | Public landing page. |
| `/products/:product` | Public product overview. |
| `/sign-in`, `/sign-up` | Public authentication pages. |
| `/access-denied` | Unsupported role or insufficient workspace access. |
| `/portal` | Customer dashboard; requires the `Registered` role. |
| `/portal/quotes`, `/portal/quotes/new`, `/portal/quotes/:id` | Customer quote screens; also require the quote feature to be enabled. |
| `/portal/profile` | Customer profile. |
| `/portal/:section` | Customer coming-soon page, including policies, payments and claims. |
| `/staff` | Staff dashboard; requires `Admin` or `Agents`. |
| `/staff/profile` | Staff profile. |
| `/staff/:section` | Staff coming-soon page, including customers, quotes, users, policies, payments and claims. |

The client checks role names returned by the current-user profile. A user with Admin or Agents is routed to the staff home after sign-in; a Registered user is routed to the customer home. Other roles are directed to access denied. Route guards and hidden controls are **not security boundaries**: each backend must enforce authentication, resource ownership, permissions and scope independently.

## Authentication and session

1. Sign-up sends email, password and optional first name, last name and username to Identity Service. The optional fields are limited to 100 characters. The user is then directed to sign in.
2. Sign-in obtains a token, calls Identity's authenticated home endpoint, and then requests the current-user profile and its roles. A failed check prevents sign-in; inactive users are rejected by the client. A 401 identifies the failed verification check on the sign-in form and clears the provisional token.
3. The token exists only in browser memory. Reloading the application loses the session and requires sign-in again. Once a session is established, a token expiration timer or authenticated 401 response leads to sign-in.
4. Sign-out clears client state. The documented Identity API does not provide token revocation, so this is not server-side revocation.

The sign-up/sign-in flow preserves a return URL for a permitted workspace. Identity Service currently uses a fixed development tenant for login and registration. The application does not implement password recovery or token refresh. Profile editing supports first and last names only: provided values must be nonblank and at most 100 characters, and the API does not allow clearing an existing name. Email, username and roles cannot be changed through this endpoint.

## API integration

The following are same-origin paths used by the Angular application or exposed by the host. Their upstream behavior depends on the corresponding services.

| Method and path | Destination | Use |
|---|---|---|
| `GET /api/ui/features` | UI host | Reports `quoteCreationEnabled` and `quotesEnabled`. |
| `GET /api/lookups/countries` | Location | Country dropdown options (public). |
| `GET /api/lookups/{type}[?vehicleMakeId=n]` | Quote | Quote lookups for the 14 allowlisted types listed in Recent changes (public). |
| `GET /api/lookups/countries/{countryId}/provinces` | Location | Province / state options for the selected country (public). |
| `GET /api/lookups/location-types` | Location | Location type dropdown options (public). |
| `POST /api/auth/register` | Identity | Register a user. |
| `POST /api/auth/login` | Identity | Obtain a token. |
| `GET /api/home/index` | Identity | Check bearer authentication after sign-in. |
| `GET /api/auth/me` | Identity | Load the current profile and roles. |
| `PATCH /api/auth/me` | Identity | Update one or both names; bearer token required, success returns 204. |
| `GET /api/auth/me/roles` | Identity | Forwarded by host; the current UI uses roles from the profile instead. |
| `POST /api/quotes` | Quote | Create one product quote; requires the Identity JWT bearer token. The live controller returns `201` with `{ message, referenceNumber, quote }`; the current Swagger document advertises a 200 `QuoteResponse`, which does not match that controller response. |
| `GET /api/quotes/user` | Quote | My quotes: the Quote Service derives the user from the JWT (401 without a valid token), so it is not gated by `Features:QuotesEnabled`. The old `GET /api/quotes/user/{userId}` is no longer proxied. |
| `GET /api/quotes/{id}` | Quote | Management API exists, but UI host blocks it by default pending user-ownership enforcement in Quote Service. |
| `POST /api/quotes/{id}/accept` | Quote | Management API exists, but UI host blocks it by default pending user-ownership enforcement in Quote Service. |

Quote creation uses the same-origin UI host proxy, which forwards the bearer token and request content type/body to `Services:Quote`; Quote Service's `[Authorize]` controller validates the token and forwards it to Location Service when creating the address. Quote creation can be independently disabled with its feature flag. Management routes remain gated in the UI host because authentication alone is not authorization to access a specific user's quote. This host gate is not a security boundary: Quote Service is directly reachable, so its get/list/accept endpoints must enforce ownership and permissions themselves before management is enabled for users. There is no UI integration for rejection, cancellation, policy issuance, payment, claim operations, or staff administration.

## Quote flow and safety gate

`Features:QuoteCreationEnabled` defaults to `true`; it gates only `POST /api/quotes`. `Features:QuotesEnabled` defaults to `false`; it gates quote detail and acceptance only (My quotes uses the token-scoped `GET /api/quotes/user`). Keep management disabled until:

- Quote Service enforces per-resource ownership for get-by-ID and accept operations (list is already token-scoped); `[Authorize]` alone only verifies a valid token. The UI host gate cannot protect services reachable directly.
- Quote lifecycle/status definitions and acceptance behavior are reconciled, and policy-issuance semantics are verified.
- A usable, authoritative lookup data source and approved rating/risk data are available. Address country, province and location type are now selected from Location Service lookups. The provisional Auto wizard no longer asks for numeric reference IDs. Invalid IDs or unavailable Location/Rating services are reported as service errors. Add lookup selectors for vehicle data before treating the form as a production-ready customer flow.

The wizard uses one product per quote: Auto, Home, or Health. Address and product field definitions are in `quote-fields.ts`. Boolean questions require an explicit yes/no answer. It validates required fields and configured numeric minimums, then submits the selected product and address to Quote Service. More detailed business validation remains the service's responsibility.

The intended business outcomes **accepted**, **rejected**, and automatically **cancelled after 30 days** are distinct. Rejection is not implemented in the UI or exposed as a substitute for cancellation. The documented current backend instead marks quotes expired, has conflicting statuses, and has no scheduler. Implement and verify the backend workflow before presenting those statuses as authoritative. Acceptance does not issue a policy or activate coverage.

## Configuration

| Setting | Default | Description |
|---|---|---|
| `Services:Identity` | `https://localhost:44388/` | Identity Service IIS Express HTTPS address for local development. |
| `Services:Quote` | `https://localhost:44303/` | Quote Service IIS Express HTTPS address for local development. |
| `Services:Location` | `https://localhost:44370/` | Location Service address, used for address lookups. |
| `Features:QuoteCreationEnabled` | `true` | Enables authenticated `POST /api/quotes` through the UI host. |
| `Features:QuotesEnabled` | `false` | Enables quote details and acceptance. Keep false until Quote Service enforces resource ownership. |

Use environment-specific configuration, for example `Services__Identity`, `Services__Quote`, `Services__Location`, `Features__QuoteCreationEnabled`, and `Features__QuotesEnabled`. Configure HTTPS for deployed service connections and secure the public host with HTTPS. Do not put credentials in configuration files. Review server-side authentication, authorization, privacy, error handling, and deployment settings before production use; this initial UI is not a production security certification.

## Local setup and development

Prerequisites: .NET 10 SDK, a Node.js version supported by Angular 21, npm, and a configured Identity Service and database. Quote Service, Location Service, valid lookup data and approved rating data are also required to test the quote flow after its prerequisites are met.

1. Start Identity Service using IIS Express at `https://localhost:44388/`. Start Quote Service using IIS Express at `https://localhost:44303/` when needed. Their `dotnet run` HTTPS profiles use different ports; override the service URLs if using those profiles. Configure each service's database and JWT settings, and trust its local HTTPS certificate using the appropriate development certificate setup. Certificate validation is not disabled.
2. Build the client:

   ```powershell
   Set-Location 'D:\Learning\OnPrem Apps\InsurancePortal\ui\InsurancePortal.UI\ClientApp'
   npm ci
   npm run build
   ```

3. Start the UI host:

   ```powershell
   Set-Location 'D:\Learning\OnPrem Apps\InsurancePortal\ui\InsurancePortal.UI'
   dotnet run --launch-profile https
   ```

4. Open `https://localhost:7042`. Trust the local .NET development HTTPS certificate if necessary. The HTTP profile uses `http://localhost:5247`.
5. Rebuild the client after editing it, or run `npm run watch` in `ClientApp` while the host is running. A .NET or Visual Studio build alone does not rebuild Angular; the host serves the assets in `wwwroot`. Reload the browser after rebuilding. Running the Angular development server alone does not provide the host's API forwarding.

Build the Angular client **before** publishing the .NET host so `wwwroot` contains the current assets. Configure appropriate upstream addresses in the published environment. If sign-in succeeds but the profile check returns 401, rebuild and restart Identity Service so its current-user claim-mapping fix is running, then retry.

## Testing

From `ClientApp`:

```powershell
npm test -- --watch=false
npm run build
```

From the solution root:

```powershell
dotnet build
```

Tests include the application outlet, mocked Identity login/profile and roles, registration payloads, profile edits for customer and staff, login and registration failure/retry rendering in zoneless mode, provisional verification and established-session 401 handling, quote creation payload/201 response and bearer forwarding, optional Auto rating inputs, quote wizard validation, gated quote-management screens, and asynchronous quote list/detail rendering tests, plus Location lookup dropdown population, country-to-province cascading, and error/retry tests. A local host-to-mock smoke test verified proxy headers/body and feature gates; live Quote Service rejected an unauthenticated request with 401. These checks do not replace an authenticated end-to-end quote creation with valid lookup IDs and configured Location/Rating services.

## Related service documentation

The Identity, Quote, and Location service design documents are in `D:\Learning\OnPrem Apps\InsurancePortal\docs`. Their API and authorization details may change independently of this UI; update this document and the client contracts when those services change.
