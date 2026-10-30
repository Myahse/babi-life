// The app's settings are app.json's, with what each build adds (.github/workflows/native.yml): the
// version number the Play Store and Android compare (ANDROID_VERSION_CODE, from GitHub's run: always
// above the old Flutter app's 2, so the new app installs over it), and Firebase for the notifications
// once its file was written from the repository's FCM variables (google-services.json, never in git).
const fs = require('fs')
const path = require('path')
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins')

// The release build shrinks the code (R8), renaming classes and dropping what it thinks unused; the
// Expo modules' views are made by reflection (their (Context, AppContext) constructor), so they're kept
// as they are, or the first one drawn crashes the app (« Didn't find a correct constructor »).
const KEEP = `
# Babi Life (app.config.js): Expo modules' views and modules, made by reflection.
-keep class expo.modules.** { *; }
-keep class * extends expo.modules.kotlin.views.ExpoView { *; }
-keep class * extends expo.modules.kotlin.modules.Module { *; }
-keepclassmembers class * { public <init>(android.content.Context, expo.modules.kotlin.AppContext); }
`
const withKeepRules = (config) =>
  withDangerousMod(config, [
    'android',
    (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro')
      const was = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
      if (!was.includes('Babi Life (app.config.js)')) fs.writeFileSync(file, was + KEEP)
      return c
    },
  ])

// The review build only (.github/workflows/native-review.yml): its API is a local server on the
// emulator's host (http://10.0.2.2), plain HTTP, which Android refuses unless this one host is
// allowed. Never set for a build that goes to players (they talk to the API over HTTPS only).
const REVIEW_HOST = process.env.REVIEW_CLEARTEXT_HOST
const withReviewCleartext = (config) => {
  if (!REVIEW_HOST) return config
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true"><domain includeSubdomains="false">${REVIEW_HOST}</domain></domain-config>
</network-security-config>
`
  config = withDangerousMod(config, [
    'android',
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml')
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'network_security_config.xml'), xml)
      return c
    },
  ])
  return withAndroidManifest(config, (c) => {
    c.modResults.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/network_security_config'
    return c
  })
}

module.exports = ({ config }) =>
  withReviewCleartext(withKeepRules({
    ...config,
    android: {
      ...config.android,
      versionCode: Number(process.env.ANDROID_VERSION_CODE) || 3,
      ...(fs.existsSync(`${__dirname}/google-services.json`) ? { googleServicesFile: './google-services.json' } : {}),
    },
  }))
