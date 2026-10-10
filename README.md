# MINT Member Onboarding App

This app makes the appropriate changes to a member in Wild Apricot after they have been onboarded.

## Details

This is a Google Apps Script app...

 * `index.html`, `assets/` & `src/` A Vue3 front end that is compiled into a single HTML page on build.
 * `gas/` The google apps script components.
 * `dist/` The compiled and prepared GAS files to deploy.

The application uses OAUTH to authenticate the user against WA. This authenticates the user. The application also has a privleged WA API Key of it's own. It looks up the authenticated user to confirm that they are allowed to onboard new members, and performs the updates, using this second key.

## Deployment


* `clasp login` - Make sure to use MINT Browser profile to log in as mint user
* `npm run deploy`