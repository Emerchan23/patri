import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sis_patrimonio_mobile/main.dart';
import 'package:sis_patrimonio_mobile/widgets/scanner_camera_error.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/screens/welcome_screen.dart';
import 'package:sis_patrimonio_mobile/public_consultation/home_screen.dart'
    as public_consultation;

void main() {
  testWidgets('erro de câmera mantém recuperação legível sem overflow', (
    tester,
  ) async {
    var manualEntryOpened = false;
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Stack(
            children: [
              ScannerCameraError(
                onRetry: _noop,
                onManualEntry: () async => manualEntryOpened = true,
                message: 'Permita a câmera ou digite o patrimônio.',
              ),
              Positioned(
                left: 20,
                right: 20,
                bottom: 16,
                child: FilledButton(
                  onPressed: () {},
                  child: const Text('Digitar código manualmente'),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Não foi possível iniciar a câmera.'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsOneWidget);
    expect(
      find.text('Permita a câmera ou digite o patrimônio.'),
      findsOneWidget,
    );
    expect(find.text('Digitar patrimônio'), findsOneWidget);
    expect(find.text('Digitar código manualmente'), findsOneWidget);
    await tester.tap(find.text('Digitar patrimônio'));
    expect(manualEntryOpened, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('app inicia com o gate de autenticacao', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const SisPatrimonioApp());

    expect(find.byType(SisPatrimonioApp), findsOneWidget);
    expect(find.byType(AuthGateScreen), findsOneWidget);
  });

  testWidgets('welcome informa quando a sessao expirou', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: WelcomeScreen(
          notice: 'Sua sessão expirou. Entre novamente para continuar.',
        ),
      ),
    );

    expect(
      find.text('Sua sessão expirou. Entre novamente para continuar.'),
      findsOneWidget,
    );
  });

  testWidgets('welcome integra consulta pública e acesso de gestão', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const MaterialApp(home: WelcomeScreen()));

    expect(find.text('Consulta rápida'), findsOneWidget);
    expect(find.text('Entrar como gestor'), findsOneWidget);

    await tester.tap(find.text('Consulta rápida'));
    await tester.pumpAndSettle();

    expect(find.byType(public_consultation.HomeScreen), findsOneWidget);
    expect(find.text('Consulta de patrimônio'), findsOneWidget);
  });

  testWidgets('servidor pode ser configurado antes do login e sem logout', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const MaterialApp(home: WelcomeScreen()));

    await tester.tap(find.byTooltip('Configurar endereço do servidor'));
    await tester.pumpAndSettle();

    expect(find.text('Configurações'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('Sair da conta'), findsNothing);
  });

  testWidgets('gate retorna ao inicio ao receber sessao expirada', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    ApiService.sessionExpired.value = false;
    await tester.pumpWidget(const SisPatrimonioApp());
    await tester.pumpAndSettle();

    ApiService.sessionExpired.value = true;
    await tester.pump();
    await tester.pumpAndSettle();

    expect(
      find.text('Sua sessão expirou. Entre novamente para continuar.'),
      findsOneWidget,
    );
    ApiService.sessionExpired.value = false;
  });
}

Future<void> _noop() async {}
