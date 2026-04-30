# Setup Handover — Local Development (macOS)

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | `brew install node` or [nvm](https://github.com/nvm-sh/nvm) |
| pnpm | 9+ | `npm install -g pnpm` |
| Expo CLI | via pnpm | Installed automatically as `@expo/cli` in the workspace |
| EAS CLI | 12+ | `npm install -g eas-cli` |
| PostgreSQL | 14+ | `brew install postgresql` or use a cloud DB |
| Xcode | 15+ | Mac App Store (required for iOS simulator + builds) |
| iOS Simulator | any | Installed with Xcode |

---

## 1. Clone / Unzip the Project

```bash
# From zip (if downloaded from Replit)
unzip workspace.zip && cd workspace

# Or from git (if a repo exists)
git clone <repo-url> && cd <repo-name>
```

---

## 2. Install Dependencies

```bash
pnpm install
```

This installs all workspace packages including `fes-app`, `api-server`, and all shared libs. pnpm hoists shared dependencies and respects the catalog pins in `pnpm-workspace.yaml`.

---

## 3. Set Up the Database

### Option A — Replit PostgreSQL (already set up in Replit)
The `DATABASE_URL` secret is already configured in Replit. No action needed if running inside Replit.

### Option B — Local PostgreSQL
```bash
# Start postgres locally
brew services start postgresql

# Create database
createdb fes_app

# Set the env var
export DATABASE_URL="postgresql://localhost/fes_app"
```

### Run Migrations
```bash
pnpm --filter @workspace/db run db:migrate
```

This applies the Drizzle migrations to create `push_tokens` and `sent_notifications` tables.

If `db:migrate` is not available (check `lib/db/package.json`), run:
```bash
cd lib/db && pnpm exec drizzle-kit migrate
```

---

## 4. Set Environment Variables

Create a `.env` file in `artifacts/api-server/` (or export in your shell):

```bash
# artifacts/api-server/.env
DATABASE_URL=postgresql://localhost/fes_app
SESSION_SECRET=any-random-secret-for-local-dev
NODE_ENV=development
PORT=8080
```

For the Expo app, the only required env var in development is set via the dev script automatically (see step 6).

---

## 5. Build Shared Libraries

The shared libs (`api-zod`, `api-client-react`, `db`) must be built before running the app or server:

```bash
pnpm run typecheck:libs
```

Or build just the libs:
```bash
pnpm --filter @workspace/db run build
pnpm --filter @workspace/api-zod run build
pnpm --filter @workspace/api-client-react run build
```

If you change the OpenAPI spec (`lib/api-spec/openapi.yaml`), regenerate the client:
```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## 6. Run the API Server

```bash
pnpm --filter @workspace/api-server run dev
```

This runs `build` (esbuild) then `start` (node). The server listens on port 8080 by default.

Verify it's up:
```bash
curl http://localhost:8080/api/healthz
# → {"status":"ok"}
```

The server also starts the notification scheduler immediately on boot.

---

## 7. Run the Expo App

### In Expo Go (limited — no push notifications)
```bash
cd artifacts/fes-app
EXPO_PUBLIC_DOMAIN=localhost:8080 pnpm exec expo start
```
Scan the QR code with the Expo Go app on your phone.

**Note:** Push notifications and some native features do not work in Expo Go. Use a development build for full functionality.

### In iOS Simulator
```bash
cd artifacts/fes-app
EXPO_PUBLIC_DOMAIN=localhost:8080 pnpm exec expo start --ios
```

Simulator will open automatically. Tap the menu tiles to navigate.

**Note:** Push notifications do NOT work on the iOS simulator. Use a real device for push testing.

### Connect App to API Server
The Expo app reads `EXPO_PUBLIC_DOMAIN` to build its API base URL (`lib/api.ts`):
- `EXPO_PUBLIC_DOMAIN=localhost:8080` → talks to your local server
- `EXPO_PUBLIC_DOMAIN=your-replit-domain.replit.app` → talks to the deployed server

---

## 8. Install a Development Build on a Real Device

Development builds are required for:
- Expo push notifications
- `expo-dev-client` features
- Testing real device behavior

### Prerequisites for dev build
1. **EAS project ID** — Run `eas init` from `artifacts/fes-app/` and copy the project ID into `app.json` → `extra.eas.projectId`. Replace `"REPLACE_WITH_EAS_PROJECT_ID"`.
2. **Deployed API URL** — Update `eas.json` → `build.development.env.EXPO_PUBLIC_DOMAIN` with your deployed API server domain.
3. **Apple Developer account** — Required for physical device builds.

### Build and install
```bash
cd artifacts/fes-app

# Build dev client for iOS (requires Apple credentials)
eas build --profile development --platform ios

# Download and install the .ipa on your device via the EAS dashboard
# or use:
eas build --profile development --platform ios --local  # local build, requires Xcode
```

The device must be registered in your Apple Developer account (or use TestFlight for broader distribution).

---

## Running Both Services Together

Open two terminal tabs:

**Tab 1 — API Server:**
```bash
pnpm --filter @workspace/api-server run dev
```

**Tab 2 — Expo:**
```bash
cd artifacts/fes-app && EXPO_PUBLIC_DOMAIN=localhost:8080 pnpm exec expo start
```

---

## Troubleshooting

### "Cannot find module @workspace/db"
The shared libs need to be built first. Run:
```bash
pnpm run typecheck:libs
```

### "No investigators parsed from upstream HTML"
The investigators scraper fetches `fescenter.org/test/team/investigators/`. This requires internet access. Check your network connection or whether the website structure has changed.

### "EAS projectId not set"
Push token registration will silently fail with `status: "no-project-id"`. Run `eas init` in `artifacts/fes-app/` and update `app.json`.

### "Failed to load events" in app
The iCal feed (`calendar.google.com`) is public. If this fails, check network access or whether Google has rate-limited the IP. The server logs show the exact HTTP error.

### Metro bundler "Unable to resolve module"
Run `pnpm install` from the workspace root, then restart the Expo dev server. Sometimes the `node_modules` symlinks need refreshing.

### Expo dev server not reachable from device
On a physical device, the device and computer must be on the **same Wi-Fi network**, or use Expo's tunnel mode:
```bash
EXPO_PUBLIC_DOMAIN=localhost:8080 pnpm exec expo start --tunnel
```

### Database migration fails
Verify `DATABASE_URL` is set and PostgreSQL is running. Check that the user has `CREATE TABLE` permissions on the target database.

### "CORS error" from Expo app to API server
The `api-server/src/app.ts` enables CORS for all origins in development. If you see CORS errors, ensure the API server is running and `EXPO_PUBLIC_DOMAIN` points to the correct host/port.

### App shows blank white screen
Check the Expo Metro bundler output for JS errors. Also verify `app/_layout.tsx` loads without font errors.
