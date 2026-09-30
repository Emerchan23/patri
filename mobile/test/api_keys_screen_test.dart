import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/api_keys_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  test('API key parsing keeps only the masked value from the list endpoint', () {
    final key = ApiAccessKey.fromJson({
      'id': 7,
      'nome': 'Sistema de manutenção',
      'chave': 'sk_abcd...wxyz',
      'ativo': 1,
      'criado_em': '2026-09-30T12:00:00.000Z',
    });

    expect(key.id, '7');
    expect(key.name, 'Sistema de manutenção');
    expect(key.maskedKey, 'sk_abcd...wxyz');
    expect(key.active, isTrue);
    expect(key.createdAt, DateTime.parse('2026-09-30T12:00:00.000Z'));
  });

  testWidgets('chaves de integração ficam disponíveis somente para admin', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ApiKeysScreen(
          userSessionLoader: () async => const CurrentUserSession(
            nome: 'Gestor de teste',
            role: 'gestor',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Somente administradores podem gerenciar chaves de integração.'),
      findsOneWidget,
    );
    expect(find.text('Criar chave de API'), findsNothing);
  });

  testWidgets('tela de integrações rola em viewport móvel estreito', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: const TextScaler.linear(1.3),
            ),
            child: ApiKeysScreen(
              userSessionLoader: () async => const CurrentUserSession(
                nome: 'Admin de teste',
                role: 'administrador',
              ),
              keysLoader: () async => const [
                ApiAccessKey(
                  id: '7',
                  name: 'Sistema de manutenção',
                  maskedKey: 'sk_12345...abcde',
                  active: true,
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Criar chave de API'), findsOneWidget);
    await tester.ensureVisible(find.text('sk_12345...abcde'));
    await tester.pumpAndSettle();
    expect(find.text('sk_12345...abcde'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('nova chave aparece uma vez e não fica exposta após fechar', (
    tester,
  ) async {
    const fullSecret = 'sk_1234567890abcdef1234567890abcdef';
    await tester.pumpWidget(
      MaterialApp(
        home: ApiKeysScreen(
          userSessionLoader: () async => const CurrentUserSession(
            nome: 'Admin de teste',
            role: 'administrador',
          ),
          keysLoader: () async => const [
            ApiAccessKey(
              id: '7',
              name: 'Sistema de manutenção',
              maskedKey: 'sk_12345...abcde',
              active: true,
            ),
          ],
          createKey: (_) async => fullSecret,
          revokeKey: (_) async {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('sk_12345...abcde'), findsOneWidget);
    await tester.tap(find.text('Criar chave de API'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Integração de teste');
    await tester.tap(find.text('Gerar chave'));
    await tester.pumpAndSettle();

    expect(find.text(fullSecret), findsOneWidget);
    expect(find.textContaining('só aparece nesta tela'), findsOneWidget);
    await tester.tap(find.text('Já guardei'));
    await tester.pumpAndSettle();

    expect(find.text(fullSecret), findsNothing);
    expect(find.text('sk_12345...abcde'), findsOneWidget);
  });

  testWidgets('revogação exige confirmação explícita', (tester) async {
    var revokeCount = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: ApiKeysScreen(
          userSessionLoader: () async => const CurrentUserSession(
            nome: 'Admin de teste',
            role: 'administrador',
          ),
          keysLoader: () async => const [
            ApiAccessKey(
              id: '7',
              name: 'Sistema de manutenção',
              maskedKey: 'sk_12345...abcde',
              active: true,
            ),
          ],
          revokeKey: (_) async {
            revokeCount++;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Revogar'));
    await tester.pumpAndSettle();
    expect(find.text('Revogar chave?'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(revokeCount, 0);

    await tester.tap(find.text('Revogar'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Revogar'));
    await tester.pumpAndSettle();
    expect(revokeCount, 1);
  });
}
