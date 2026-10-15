/// Where the game is, and the Google client the server checks sign-ins
/// against. Both can be changed at build time:
///   flutter build apk --dart-define=GAME_URL=https://… --dart-define=GOOGLE_WEB_CLIENT_ID=….apps.googleusercontent.com
class Config {
  static const gameUrl = String.fromEnvironment('GAME_URL', defaultValue: 'https://www.lifeinbabi.com');

  /// The web client ID (the server's GOOGLE_CLIENT_ID): Google signs the
  /// phone's sign-in for it, so the server accepts the token as from the site.
  static const googleWebClientId = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID');

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
