import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sis_patrimonio_mobile/screens/settings_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/services/settings_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({
      'server_url': 'http://10.0.2.2:3005',
    });
  });

  testWidgets('explains IP setup and cleartext HTTP risk', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: SettingsScreen()));
    await tester.pumpAndSettle();

    expect(find.textContaining('Não precisa de domínio'), findsOneWidget);
    expect(find.textContaining('HTTP não criptografa'), findsOneWidget);
  });

  testWidgets('explains what to check when server connection fails', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: SettingsScreen(apiService: _OfflineApiService())),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Testar'));
    await tester.pumpAndSettle();

    expect(
      find.textContaining('Confira o IP e a porta, a conexão à rede/VPN'),
      findsOneWidget,
    );
    expect(
      await SettingsService().getServerUrl(),
      'http://10.0.2.2:3005',
      reason: 'uma falha ao testar não deve trocar o endereço salvo',
    );
  });

  for (final address in [
    '192.168.20.15:7400',
    '203.0.113.42:7400',
    '[2001:db8::42]:7400',
  ]) {
    testWidgets('normalizes and saves server address $address', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: SettingsScreen()));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), address);
      await tester.ensureVisible(find.text('Salvar'));
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();

      expect(find.text('Trocar servidor?'), findsOneWidget, reason: address);
      expect(
        find.text('Informe uma URL válida iniciando com http:// ou https://.'),
        findsNothing,
      );

      await tester.tap(find.text('Trocar servidor'));
      await tester.pumpAndSettle();
      expect(await SettingsService().getServerUrl(), 'http://$address');
    });
  }
}

class _OfflineApiService extends ApiService {
  @override
  Future<bool> testConnection() async => false;
}
