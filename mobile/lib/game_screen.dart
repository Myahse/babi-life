import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
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
  InAppWebViewController? _web;
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
    Connectivity().checkConnectivity().then(_onNetwork);
    _net = Connectivity().onConnectivityChanged.listen(_onNetwork);
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
    _web?.loadUrl(urlRequest: URLRequest(url: WebUri(Config.gameUrl)));
  }

  /// Back: back in the game; at its start, a second press within 2 s leaves.
  Future<void> _back() async {
    if (_web != null && await _web!.canGoBack()) {
      await _web!.goBack();
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
          InAppWebView(
            initialUrlRequest: URLRequest(url: WebUri(Config.gameUrl)),
            initialSettings: InAppWebViewSettings(
              javaScriptEnabled: true,
              // The app tells the game it's inside it (web/src/lib/native.ts).
              applicationNameForUserAgent: 'BabiLifeApp/1.0',
              mediaPlaybackRequiresUserGesture: false,
              allowsInlineMediaPlayback: true,
              geolocationEnabled: true,
              supportZoom: false,
              transparentBackground: true,
              useShouldOverrideUrlLoading: true,
              disableContextMenu: true,
            ),
            onWebViewCreated: (c) {
              _web = c;
              c.addJavaScriptHandler(handlerName: 'googleSignIn', callback: (_) => Bridge.googleSignIn());
              c.addJavaScriptHandler(
                  handlerName: 'share',
                  callback: (args) async {
                    if (args.isNotEmpty) await Bridge.share(args.first.toString());
                    return true;
                  });
            },
            shouldOverrideUrlLoading: (c, action) async {
              final uri = action.request.url;
              if (uri == null) return NavigationActionPolicy.ALLOW;
              final web = uri.scheme == 'http' || uri.scheme == 'https';
              if (web && Config.isGame(uri)) return NavigationActionPolicy.ALLOW;
              // WhatsApp, the news, a phone number…: in their own app.
              await launchUrl(uri, mode: LaunchMode.externalApplication);
              return NavigationActionPolicy.CANCEL;
            },
            onGeolocationPermissionsShowPrompt: (c, origin) async {
              // « Naître là où tu es »: the phone asks, once.
              final ok = (await Permission.locationWhenInUse.request()).isGranted;
              return GeolocationPermissionShowPromptResponse(origin: origin, allow: ok, retain: true);
            },
            onPermissionRequest: (c, request) async => PermissionResponse(resources: request.resources, action: PermissionResponseAction.GRANT),
            onLoadStop: (c, url) => setState(() => _loaded = true),
            onReceivedError: (c, request, error) {
              if (request.isForMainFrame ?? false) setState(() => _offline = true);
            },
          ),
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
