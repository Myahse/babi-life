import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:permission_handler/permission_handler.dart';

import 'config.dart';

/// The app's notifications (backend internal/push): a Gbairai message, a bet
/// whose matches are over, sent by Firebase Cloud Messaging. The game asks
/// (web/src/lib/push.ts): Android asks the player once; refused for good, its
/// settings open, where they can be turned on. Without the Firebase app's
/// keys (--dart-define=FCM_APP_ID, FCM_API_KEY), the permission is still
/// asked but nothing is received.
class Notifications {
  static Future<void>? _started;

  static Future<void> _start() => _started ??= () async {
        if (!Config.fcm) return;
        await Firebase.initializeApp(
          options: const FirebaseOptions(
            apiKey: Config.fcmApiKey,
            appId: Config.fcmAppId,
            messagingSenderId: Config.fcmSenderId,
            projectId: Config.firebaseProject,
          ),
        );
      }();

  /// 'granted', 'denied' (refused for good: only the settings can turn them on) or 'default'.
  static Future<String> status() async {
    final s = await Permission.notification.status;
    if (s.isGranted) return 'granted';
    return s.isPermanentlyDenied ? 'denied' : 'default';
  }

  /// Asks for them, then this phone's token for the server: '' without
  /// Firebase, 'denied' if refused (the settings were opened).
  static Future<String> enable() async {
    var s = await Permission.notification.status;
    if (s.isPermanentlyDenied) {
      await openAppSettings();
      return 'denied';
    }
    if (!s.isGranted) s = await Permission.notification.request();
    if (!s.isGranted) return s.isPermanentlyDenied ? 'denied' : '';
    if (!Config.fcm) return '';
    await _start();
    return await FirebaseMessaging.instance.getToken() ?? '';
  }

  /// A notification tapped: the page of the game it points at (« /jeu?app=gbairai »), as the app opens or while it runs.
  static Future<void> onOpen(void Function(String url) open) async {
    if (!Config.fcm) return;
    await _start();
    final first = await FirebaseMessaging.instance.getInitialMessage();
    final url = first?.data['url'];
    if (url is String && url.isNotEmpty) open(url);
    FirebaseMessaging.onMessageOpenedApp.listen((m) {
      final u = m.data['url'];
      if (u is String && u.isNotEmpty) open(u);
    });
  }
}
