# Release Handover — iOS Pipeline

## Current State Summary

The app is **not yet released**. As of the current codebase:
- No EAS project ID has been set (placeholder in `app.json`).
- No Apple credentials are configured in `eas.json`.
- No TestFlight or App Store submission has been made.
- The app version is `1.0.0` with `versionCode` managed remotely (`appVersionSource: "remote"` in `eas.json`).

---

## Required Credentials

Collect all of the following before starting any release work:

| Credential | Where to Find | Where to Put |
|---|---|---|
| **Apple ID** | Your Apple Developer account email | `eas.json` → `submit.production.ios.appleId` |
| **Apple Team ID** | [developer.apple.com](https://developer.apple.com) → Membership | `eas.json` → `submit.production.ios.appleTeamId` |
| **App Store Connect App ID (ascAppId)** | App Store Connect → App → App Information → Apple ID | `eas.json` → `submit.production.ios.ascAppId` |
| **EAS Project ID** | Run `eas init` in `artifacts/fes-app/` | `app.json` → `extra.eas.projectId` |
| **Deployed API domain** | Your Replit deployment URL or custom domain | `eas.json` → all build profiles → `env.EXPO_PUBLIC_DOMAIN` |

The bundle identifier is already set: `org.fescenter.app` (`app.json` → `ios.bundleIdentifier`).

You must create this bundle ID in App Store Connect before submitting. Navigate to **App Store Connect → Apps → New App → iOS → Bundle ID: `org.fescenter.app`**.

---

## EAS Build Profiles

Defined in `artifacts/fes-app/eas.json`:

### `development`
- **Purpose:** Development build with `expo-dev-client` for testing on real devices during active development.
- **Distribution:** Internal (not TestFlight, not App Store).
- **Push notifications:** Work on real devices with this profile.
- **Simulator:** `simulator: false` — builds for real device only.
- **Update channel:** `development`
- **Use when:** You need to test native features, push notifications, or anything that doesn't work in Expo Go.

```bash
cd artifacts/fes-app
eas build --profile development --platform ios
```

### `preview`
- **Purpose:** Internal distribution build for stakeholder review via TestFlight or direct install.
- **Distribution:** Internal.
- **Update channel:** `preview`
- **Use when:** Showing a pre-release build to the FES team or getting sign-off before App Store submission.

```bash
eas build --profile preview --platform ios
```

### `production`
- **Purpose:** App Store submission build.
- **Distribution:** Store.
- **Update channel:** `production`
- **Auto-increment:** `autoIncrement: true` — EAS automatically increments the build number.
- **Use when:** Submitting to TestFlight for broad beta testing or to the App Store for release.

```bash
eas build --profile production --platform ios
```

---

## Step-by-Step: From Current State to TestFlight

### Step 1 — Set Up EAS Project
```bash
cd artifacts/fes-app
eas login          # Log in with your Expo account
eas init           # Creates EAS project, sets projectId in app.json
```

Commit the updated `app.json` with the real `projectId`.

### Step 2 — Fill in eas.json Placeholders
Edit `artifacts/fes-app/eas.json` and replace all `REPLACE_WITH_*` values:
```json
"env": {
  "EXPO_PUBLIC_DOMAIN": "your-deployed-api.replit.app"
},
"submit": {
  "production": {
    "ios": {
      "appleId": "dev@fescenter.org",
      "ascAppId": "1234567890",
      "appleTeamId": "ABCDE12345"
    }
  }
}
```

### Step 3 — Create App in App Store Connect
1. Go to [App Store Connect](https://appstoreconnect.apple.com) → My Apps → `+` → New App.
2. Platform: iOS.
3. Name: `Cleveland FES Center`.
4. Bundle ID: `org.fescenter.app`.
5. SKU: anything unique (e.g. `fes-app-001`).
6. Copy the **Apple ID** (numeric, e.g. `1234567890`) → this is `ascAppId`.

### Step 4 — Deploy the API Server
The app requires a live API server. Deploy `artifacts/api-server` to Replit (or another host). Set the deployment domain as `EXPO_PUBLIC_DOMAIN` in all `eas.json` build profiles.

For **Supporting Resources** and **Equipment Inventory** (Google Sheets), configure `GOOGLE_SHEETS_API_KEY` and related vars on the **same** deployed API. Follow **`plan-files/handover-google-sheets-production.md`** so production secrets and sheet sharing are correct before App Store submission.

### Step 5 — Build for TestFlight
```bash
cd artifacts/fes-app
eas build --profile production --platform ios
```

EAS will prompt for Apple credentials on first run. It manages provisioning profiles and signing certificates automatically.

Build takes approximately 10–20 minutes on EAS cloud builders.

### Step 6 — Submit to TestFlight
After the build completes:
```bash
eas submit --platform ios --latest
```

Or submit from the EAS dashboard. The build appears in App Store Connect → TestFlight within a few minutes.

### Step 7 — Add TestFlight Testers
In App Store Connect → TestFlight:
- **Internal Testing:** Add team members immediately (no review required).
- **External Testing:** Add email groups; Apple reviews the build first (1–3 days).

---

## Step-by-Step: TestFlight → App Store

### Step 1 — Prepare App Store Listing
In App Store Connect → your app → App Store tab:
- App description, keywords, support URL.
- Screenshots: iPhone 6.9" (required). Record/screenshot from the iOS simulator or a real device.
- Privacy policy URL (required if the app collects push tokens).
- Age rating.

### Step 2 — Complete App Privacy
The app collects **push tokens** (device identifiers). In App Store Connect → Privacy:
- Declare "Device ID" under "Other Data" → "Developer's Advertising or Marketing" → No (it is for push notifications only).
- Alternatively declare it under "Other Data" for push functionality.

### Step 3 — Submit for Review
Select the TestFlight build in the App Store tab → Submit for Review.

Apple review typically takes **24–48 hours** for a new app, faster for updates.

### Step 4 — Release
After approval, set to **Manual Release** to control timing, or **Automatic Release** to go live immediately.

---

## OTA Updates with EAS Update

Once the app is live, you can push JavaScript-only updates without a new App Store submission:

```bash
cd artifacts/fes-app
eas update --channel production --message "Fix news feed layout"
```

OTA updates work for any change that does not modify native code (no new native modules, no changes to `app.json` plugins).

**Cannot be OTA updated:**
- New native modules or plugins
- Changes to `app.json` iOS config
- New permissions

---

## Rollback Plan

### OTA rollback (JS-only issues)
```bash
# List recent updates
eas update:list --channel production

# Roll back by publishing the previous branch
eas update --channel production --branch <previous-update-branch>
```

### Native build rollback
- In App Store Connect → TestFlight, re-submit a previous build.
- For App Store: submit a new build with the fix; expedited review can be requested if it is a critical crash.

### Emergency
If the live app is completely broken and a fix cannot be shipped quickly:
- Remove the app from sale temporarily in App Store Connect → Pricing and Availability → Availability → Remove from Sale.
- Restore as soon as a fix is ready.

---

## Submission Checklist

Before any production build:

- [ ] All `REPLACE_WITH_*` placeholders in `eas.json` and `app.json` filled in
- [ ] `EXPO_PUBLIC_DOMAIN` set to the live deployed API domain (not Replit dev domain)
- [ ] API server deployed and returning `200` on `/api/healthz`
- [ ] PostgreSQL database provisioned and migrated in production
- [ ] App icon (`assets/images/icon.png`) is 1024×1024 PNG without alpha channel
- [ ] Splash image (`assets/images/logo.png`) is high-resolution PNG
- [ ] App version in `app.json` is correct (`"version": "1.0.0"`)
- [ ] `ITSAppUsesNonExemptEncryption: false` confirmed in `app.json` (already set)
- [ ] Privacy policy URL ready (required for push token collection)
- [ ] App Store screenshots prepared (6.9" iPhone required)
- [ ] TestFlight tested on at least one real iPhone
- [ ] Push notifications tested end-to-end on real device
- [ ] Events list loads correctly against production API
- [ ] Investigators list loads correctly against production API
