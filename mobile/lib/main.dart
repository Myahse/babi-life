import 'package:flutter/material.dart';

import 'config.dart';
import 'game_screen.dart';

// Babi Life on the phone: the game itself is the web game (web/), run full
// screen in a web view; the app adds what a phone does better (Google
// sign-in, sharing, location, the back button, a screen when offline).
// See mobile/README.md.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BabiLifeApp());
}

class BabiLifeApp extends StatelessWidget {
  const BabiLifeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Babi Life',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(Config.orange), brightness: Brightness.dark),
        scaffoldBackgroundColor: const Color(Config.night),
      ),
      home: const GameScreen(),
    );
  }
}
