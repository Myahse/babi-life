// The app's settings are app.json's, with what each build adds (.github/workflows/native.yml): the
// version number the Play Store and Android compare (ANDROID_VERSION_CODE, from GitHub's run: always
// above the old Flutter app's 2, so the new app installs over it), and Firebase for the notifications
// once its file was written from the repository's FCM variables (google-services.json, never in git).
const fs = require('fs')

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.ANDROID_VERSION_CODE) || 3,
    ...(fs.existsSync(`${__dirname}/google-services.json`) ? { googleServicesFile: './google-services.json' } : {}),
  },
})
