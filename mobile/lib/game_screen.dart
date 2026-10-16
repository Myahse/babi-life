import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';

import 'bridge.dart';
import 'config.dart';

/// The game, full screen: the same Babi Life as on the web, in a web view,
/// with the splash while it loads, a screen when there's no network, the
/// phone's back button going back in the game, and links to elsewhere
/// (WhatsApp, the news) opening outside the app.
class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  late final WebViewController _web;
  bool _loaded = false;
  bool _offline = false;
  DateTime? _lastBack;
  StreamSubscription<List<ConnectivityResult>>? _net;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(Config.night),
    ));
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(Config.night))
      ..enableZoom(false)
      // The game asks the app for things (web/src/lib/native.ts): {id, name, arg}.
      ..addJavaScriptChannel('BabiApp', onMessageReceived: (m) => _onCall(m.message))
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (r) async {
          final uri = Uri.tryParse(r.url);
          if (uri == null) return NavigationDecision.navigate;
          final web = uri.scheme == 'http' || uri.scheme == 'https';
          if ((web && Config.isGame(uri)) || uri.scheme == 'about' || uri.scheme == 'data' || uri.scheme == 'blob') return NavigationDecision.navigate;
          // WhatsApp, the news, a phone number…: in their own app.
          await launchUrl(uri, mode: LaunchMode.externalApplication);
          return NavigationDecision.prevent;
        },
        onPageFinished: (_) => setState(() => _loaded = true),
        onWebResourceError: (e) {
          if (e.isForMainFrame ?? false) setState(() => _offline = true);
        },
      ))
      ..setOnJavaScriptAlertDialog((r) => _dialog(r.message, cancel: false))
      ..setOnJavaScriptConfirmDialog((r) => _dialog(r.message, cancel: true));
    final platform = _web.platform;
    if (platform is AndroidWebViewController) {
      platform.setMediaPlaybackRequiresUserGesture(false);
      // « Naître là où tu es »: the phone asks, once.
      platform.setGeolocationPermissionsPromptCallbacks(onShowPrompt: (request) async {
        final ok = (await Permission.locationWhenInUse.request()).isGranted;
        return GeolocationPermissionsResponse(allow: ok, retain: true);
      });
    }
    _start();
    Connectivity().checkConnectivity().then(_onNetwork);
    _net = Connectivity().onConnectivityChanged.listen(_onNetwork);
  }

  /// The game tells it's in the app (and the testers' build) by its user agent
  /// (web/src/lib/native.ts, launch.ts), then loads.
  Future<void> _start() async {
    final ua = await _web.getUserAgent();
    await _web.setUserAgent('${ua ?? ''} BabiLifeApp/1.0${Config.tester ? ' BabiTest' : ''}'.trim());
    await _web.loadRequest(Uri.parse(Config.gameUrl));
  }

  /// A call from the game: do it, and answer by its id.
  Future<void> _onCall(String raw) async {
    Map<String, dynamic> call;
    try {
      call = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    Object? result;
    String? error;
    try {
      switch (call['name']) {
        case 'googleSignIn':
          result = await Bridge.googleSignIn();
        case 'share':
          await Bridge.share('${call['arg'] ?? ''}');
          result = true;
        default:
          error = 'unknown call';
      }
    } catch (e) {
      error = '$e';
    }
    await _web.runJavaScript('window.__babiAnswer && window.__babiAnswer(${jsonEncode(call['id'])}, ${jsonEncode(result)}, ${jsonEncode(error)})');
  }

  Future<bool> _dialog(String message, {required bool cancel}) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        content: Text(message),
        actions: [
          if (cancel) TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Annuler')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('OK')),
        ],
      ),
    );
    return ok ?? false;
  }

  @override
  void dispose() {
    _net?.cancel();
    super.dispose();
  }

  void _onNetwork(List<ConnectivityResult> r) {
    final none = r.isEmpty || r.every((c) => c == ConnectivityResult.none);
    if (none && !_loaded) setState(() => _offline = true);
    // Back online after an error: load the game again.
    if (!none && _offline) _retry();
  }

  void _retry() {
    setState(() => _offline = false);
    _web.loadRequest(Uri.parse(Config.gameUrl));
  }

  /// Back: back in the game; at its start, a second press within 2 s leaves.
  Future<void> _back() async {
    if (await _web.canGoBack()) {
      await _web.goBack();
      return;
    }
    final now = DateTime.now();
    if (_lastBack != null && now.difference(_lastBack!) < const Duration(seconds: 2)) {
      await SystemNavigator.pop();
      return;
    }
    _lastBack = now;
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Appuie encore pour quitter Babi Life'), duration: Duration(seconds: 2)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        backgroundColor: const Color(Config.night),
        body: Stack(children: [
          WebViewWidget(controller: _web),
          // The splash, until the game has drawn its first screen.
          IgnorePointer(
            ignoring: _loaded,
            child: AnimatedOpacity(opacity: _loaded ? 0 : 1, duration: const Duration(milliseconds: 450), child: const Splash()),
          ),
          if (_offline) Offline(onRetry: _retry),
        ]),
      ),
    );
  }
}

/// The night over Abidjan, the logo, while the game loads.
class Splash extends StatelessWidget {
  const Splash({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF1D1650), Color(0xFF5B2A86), Color(0xFFD9466F), Color(0xFFFF8A3D)], stops: [0, 0.45, 0.78, 1]),
      ),
      child: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ClipRRect(borderRadius: BorderRadius.circular(28), child: Image.asset('assets/logo.png', width: 112, height: 112)),
          const SizedBox(height: 18),
          const Text.rich(
            TextSpan(children: [
              TextSpan(text: 'Babi ', style: TextStyle(color: Colors.white)),
              TextSpan(text: 'Life', style: TextStyle(color: Color(Config.orange))),
            ]),
            style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900, letterSpacing: -0.5),
          ),
          const SizedBox(height: 6),
          const Text('Ta vie. Ton quartier. Ton Babi.', style: TextStyle(color: Colors.white70, fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 28),
          const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white)),
        ]),
      ),
    );
  }
}

/// No network: say so, and try again (also by itself when it comes back).
class Offline extends StatelessWidget {
  const Offline({super.key, required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(Config.night),
      padding: const EdgeInsets.all(28),
      child: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.wifi_off_rounded, color: Colors.white70, size: 56),
          const SizedBox(height: 16),
          const Text('Pas de connexion', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          const Text(
            "Babi Life a besoin d'internet pour retrouver ton quartier.\nVérifie ta connexion ou ton crédit data.",
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70, fontSize: 15, fontWeight: FontWeight.w600, height: 1.35),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: onRetry,
            style: FilledButton.styleFrom(backgroundColor: const Color(Config.orange), padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16), shape: const StadiumBorder()),
            child: const Text('Réessayer', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          ),
        ]),
      ),
    );
  }
}
