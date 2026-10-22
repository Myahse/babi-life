import 'dart:async';

import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:share_plus/share_plus.dart';

import 'config.dart';

/// What the game asks of the phone (web/src/lib/native.ts calls these by name):
/// Google's sign-in, which won't open inside a web view, the share sheet, and
/// a little shake of the phone for what happens in the game.
class Bridge {
  static bool _ready = false;

  /// The Google ID token (the game makes it a Firebase sign-in), or null if the player cancels.
  static Future<String?> googleSignIn() async {
    final google = GoogleSignIn.instance;
    if (!_ready) {
      await google.initialize(serverClientId: Config.googleWebClientId);
      _ready = true;
    }
    try {
      final account = await google.authenticate();
      return account.authentication.idToken;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) return null;
      rethrow;
    }
  }

  /// The phone's share sheet (WhatsApp first, in Abidjan).
  static Future<void> share(String text) => SharePlus.instance.share(ShareParams(text: text));

  /// A shake of the phone (web haptic()): a buoy passed, a card played (light), a bump (heavy),
  /// a good score (success), a miss or a mistake (error).
  static Future<void> haptic(String kind) => switch (kind) {
        'light' => HapticFeedback.selectionClick(),
        'heavy' => HapticFeedback.heavyImpact(),
        'success' => HapticFeedback.mediumImpact(),
        'error' => HapticFeedback.vibrate(),
        _ => HapticFeedback.lightImpact(),
      };

  /// What the game answered to « back » (window.__babiBack): whether it closed something itself.
  /// The web view gives a bool, or its text on some phones.
  static bool tookBack(Object? answer) => answer == true || answer == 'true';
}
