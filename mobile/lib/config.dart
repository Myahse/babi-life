/// Where the game is, and the Google client of the Firebase project the
/// game signs in with. Both can be changed at build time:
///   flutter build apk --dart-define=GAME_URL=https://… --dart-define=GOOGLE_WEB_CLIENT_ID=….apps.googleusercontent.com
class Config {
  static const gameUrl = String.fromEnvironment('GAME_URL', defaultValue: 'https://www.lifeinbabi.com');

  /// The Firebase project's Google web client (« Web client (auto created by
  /// Google Service) », public: it's in every Firebase sign-in link). The
  /// phone's Google sign-in is issued for it, and the game turns it into a
  /// Firebase sign-in (web/src/lib/google.ts), which the server checks.
  static const googleWebClientId = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID', defaultValue: '115685300024-jo2jvvpg0p1ue1gsv156lcmkjjb99s9t.apps.googleusercontent.com');

  /// The testers' build (--dart-define=TESTER=true): the whole game, before
  /// launch, while the site still shows the wish list (web/src/lib/launch.ts).
  static const tester = bool.fromEnvironment('TESTER');

  /// Hosts that are the game itself; any other link opens outside the app.
  static bool isGame(Uri uri) {
    final game = Uri.parse(gameUrl).host.replaceFirst('www.', '');
    final h = uri.host.replaceFirst('www.', '');
    return h == game || h.endsWith('.$game') || h.endsWith('onrender.com') || h == 'localhost' || h == '10.0.2.2';
  }

  /// Brand colours (web/src/index.css).
  static const night = 0xFF0F1230;
  static const orange = 0xFFFF7A00;
  static const emerald = 0xFF00B86B;
}
