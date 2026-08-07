# Privacy — policy text and App Store declarations

Two things have to agree or Apple rejects the submission: the privacy policy at
`https://fescenter.org/privacy-policy-2/`, and the App Privacy questionnaire in
App Store Connect. This file holds both, derived from what the code actually
does rather than from what a template assumes.

---

## What the app actually collects

Verified against the source, not estimated.

| Data | Where | Notes |
|---|---|---|
| Expo push token | `push_tokens.token` | Opaque device identifier issued by Expo. Not an advertising ID, not linked to a person. |
| Platform string | `push_tokens.platform` | Literally `"ios"` or `"android"`. |
| Timestamps | `push_tokens.created_at/updated_at` | When the device registered. |

That is the whole table. There are **no user accounts, no email addresses, no
names, and no analytics SDK** in the app.

Incidental, not stored as a user record:

- **Server logs** — request path, status, timestamp, and the originating IP, in
  Render's rolling log buffer. Not persisted to the database.
- **Error reports** — sent to Sentry only if `SENTRY_DSN` is configured. Stack
  traces and request path; no request bodies.

Deliberately **not** collected:

- **No location.** The weather widget uses the FES Center's own fixed
  coordinates, hardcoded server-side. The device is never asked where it is.
- **No calendar reading.** "Add to my calendar" opens the system's own event
  editor (`createEventInCalendarAsync`); the app cannot see what is already
  there, and needs no permission to do it.
- **No tracking across apps or websites**, so no App Tracking Transparency
  prompt is required.

---

## State of the published policy

Checked 2026-08-07 against `https://fescenter.org/privacy-policy-2/`:

- It already has an **"FES Center App"** section — written for this app.
- It is **effective 2020-08-17** and has not been touched since.
- It covers log data, cookies, service providers, security, and children's
  privacy.
- It says **nothing** about push notifications, device tokens, or device
  identifiers of any kind.

That last point is the gap. The App Privacy questionnaire below declares a
Device ID, and a policy that does not mention one contradicts it.

---

## Message to send

Whoever maintains the website needs to paste one paragraph. Per the app's own
Supporting Resources page, Communications / Media Relations is **Mary Buckett**
(`mbuckett@FEScenter.org`) with **Erika Woodrum** (`ewoodrum@FEScenter.org`).

> Subject: One paragraph to add to the privacy policy before the app ships
>
> Hi — we're submitting the Cleveland FES Center iOS app to the App Store, and
> Apple requires the privacy policy to describe anything the app stores about a
> device.
>
> The page at fescenter.org/privacy-policy-2/ already has an "FES Center App"
> section, but it predates notifications (it's dated August 2020) and doesn't
> mention them. Apple rejects submissions where the policy and the declared data
> don't match.
>
> Could you add the paragraph below to that page, under the existing app
> section? Nothing else needs to change.
>
> [paste the block from the next section]
>
> For context, the only thing the app stores is an anonymous token identifying a
> device so we can send event reminders. No names, no email addresses, no
> location, no analytics.

---

## Paragraph to add to the privacy policy

Send this to whoever maintains `fescenter.org`. It belongs in
`privacy-policy-2/`, which already covers email and web log data but says
nothing about the mobile app.

> **Mobile App Notifications**
>
> If you choose to enable notifications in the Cleveland FES Center mobile app,
> your device is issued an anonymous push token by Expo, the service that
> delivers our notifications. We store that token together with your device's
> platform (iOS or Android) so we can send you reminders about upcoming events
> and alerts about new posts from the Center.
>
> This token identifies a device, not a person. It is not linked to your name,
> email address, or any other information about you, and we do not use it for
> advertising, analytics, or tracking you across other apps or websites.
>
> You can stop this at any time by turning notifications off in the app's
> Settings screen, which deletes the token from our servers, or by revoking
> notification permission in your device settings. Tokens are also removed
> automatically once Expo reports them as no longer valid.
>
> The app does not collect your location. Weather shown in the app is for the
> Center's own address, not for wherever you happen to be.

---

## App Store Connect — App Privacy answers

App Store Connect → your app → **App Privacy** → **Get Started**.

**"Do you or your third-party partners collect data from this app?"** → **Yes**

Add exactly one data type:

| Question | Answer |
|---|---|
| Category | **Identifiers → Device ID** |
| Is this data used for tracking? | **No** |
| Is this data linked to the user's identity? | **No** |
| Purpose | **App Functionality** |

Do **not** declare Location, Contact Info, Usage Data, or Diagnostics unless
something changes. In particular, do not tick Diagnostics for Sentry: it is
disabled by default (`SENTRY_DSN` unset), and if you do turn it on, revisit this
page — crash data is a declarable category.

**Privacy policy URL:** `https://fescenter.org/privacy-policy-2/`

---

## Before submitting, check these agree

The rejection everyone hits is a mismatch between three places:

1. This questionnaire.
2. The **privacy manifest** Expo generates into the build from the native
   modules that are installed — not from the ones you actually call.
3. The permission prompts a reviewer sees.

Number 2 is the trap. An unused module still contributes to the manifest, so a
dependency nobody imports can make the build declare data collection the
questionnaire denies. Keep permission-gated modules out of the dependency list
unless a screen genuinely uses them.
