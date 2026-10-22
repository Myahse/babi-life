import 'package:babi_life/bridge.dart';
import 'package:babi_life/config.dart';
import 'package:babi_life/game_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('the game stays in the app; other links go out', () {
    expect(Config.isGame(Uri.parse('https://www.lifeinbabi.com/jeu')), isTrue);
    expect(Config.isGame(Uri.parse('https://lifeinbabi.com/liste')), isTrue);
    expect(Config.isGame(Uri.parse('https://babi-life-jnvy.onrender.com/api/v1/world')), isTrue);
    expect(Config.isGame(Uri.parse('https://wa.me/?text=hello')), isFalse);
    expect(Config.isGame(Uri.parse('https://news.abidjan.net/articles/1')), isFalse);
  });

  test('back: the game took it when it says true (a bool, or its text)', () {
    expect(Bridge.tookBack(true), isTrue);
    expect(Bridge.tookBack('true'), isTrue);
    expect(Bridge.tookBack(false), isFalse);
    expect(Bridge.tookBack('false'), isFalse);
    expect(Bridge.tookBack(null), isFalse);
  });

  testWidgets('the splash shows the name and the line', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Splash()));
    expect(find.text('Ta vie. Ton quartier. Ton Babi.'), findsOneWidget);
  });

  testWidgets('offline: says so, and retries', (tester) async {
    var tried = 0;
    await tester.pumpWidget(MaterialApp(home: Offline(onRetry: () => tried++)));
    expect(find.text('Pas de connexion'), findsOneWidget);
    await tester.tap(find.text('Réessayer'));
    expect(tried, 1);
  });
}
