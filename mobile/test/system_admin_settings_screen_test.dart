import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/system_admin_settings_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

const _initialSettings = SystemAdminSettings(
  themeColor: 'blue',
  sidebarColor: 'dark',
  linkExtensaoXml: 'https://example.com/xml',
  linkPortalSefaz: 'https://example.com/sefaz',
  sessionDaysWeb: 3,
  sessionDaysMobile: 30,
);

void main() {
  test('system settings parses server values with safe defaults', () {
    final settings = SystemAdminSettings.fromJson({
      'themeColor': 'green',
      'sidebarColor': 'navy',
      'linkExtensaoXml': 'https://example.com/xml',
      'linkPortalSefaz': 'https://example.com/sefaz',
      'sessionDaysWeb': '5',
      'sessionDaysMobile': 45,
    });

    expect(settings.themeColor, 'green');
    expect(settings.sidebarColor, 'navy');
    expect(settings.sessionDaysWeb, 5);
    expect(settings.sessionDaysMobile, 45);
    expect(SystemAdminSettings.fromJson({}).sessionDaysMobile, 30);
  });

  testWidgets('global settings stay blocked for non-admin users', (
    tester,
  ) async {
    var loadedSettings = false;
    await tester.pumpWidget(
      MaterialApp(
        home: SystemAdminSettingsScreen(
          userSessionLoader: () async =>
              const CurrentUserSession(nome: 'Gestor de teste', role: 'gestor'),
          settingsLoader: () async {
            loadedSettings = true;
            return _initialSettings;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Somente administradores podem alterar configurações globais.'),
      findsOneWidget,
    );
    expect(loadedSettings, isFalse);
    expect(find.text('Salvar para o sistema'), findsNothing);
  });

  testWidgets(
    'saving global settings requires confirmation and validates values',
    (tester) async {
      SystemAdminSettings? saved;
      await tester.pumpWidget(
        MaterialApp(
          home: SystemAdminSettingsScreen(
            userSessionLoader: () async => const CurrentUserSession(
              nome: 'Admin de teste',
              role: 'administrador',
            ),
            settingsLoader: () async => _initialSettings,
            saveSettings: (value) async => saved = value,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('a aparência deste aplicativo não é afetada'),
        findsOneWidget,
      );
      await tester.drag(find.byType(ListView), const Offset(0, -800));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Salvar para o sistema'));
      await tester.tap(find.text('Salvar para o sistema'));
      await tester.pumpAndSettle();
      expect(saved, isNull);

      expect(find.text('Salvar para todos'), findsOneWidget);
      expect(
        find.textContaining('sessões atuais não serão encerradas.'),
        findsOneWidget,
      );
      await tester.tap(find.text('Salvar para todos'));
      await tester.pumpAndSettle();

      expect(saved?.sessionDaysWeb, 3);
      expect(saved?.sessionDaysMobile, 30);
      expect(saved?.linkPortalSefaz, 'https://example.com/sefaz');
      expect(find.text('Configurações globais salvas.'), findsOneWidget);
    },
  );

  testWidgets('global settings reject non-http links before asking to save', (
    tester,
  ) async {
    var saveCalled = false;
    await tester.pumpWidget(
      MaterialApp(
        home: SystemAdminSettingsScreen(
          userSessionLoader: () async => const CurrentUserSession(
            nome: 'Admin de teste',
            role: 'administrador',
          ),
          settingsLoader: () async => _initialSettings,
          saveSettings: (_) async => saveCalled = true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byType(TextField).at(2));
    await tester.enterText(find.byType(TextField).at(2), 'javascript:alert(1)');
    await tester.drag(find.byType(ListView), const Offset(0, -900));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Salvar para o sistema'));
    await tester.tap(find.text('Salvar para o sistema'));
    await tester.pumpAndSettle();

    expect(
      find.text('Link da extensão: use uma URL HTTP ou HTTPS válida.'),
      findsOneWidget,
    );
    expect(find.text('Salvar para todos'), findsNothing);
    expect(saveCalled, isFalse);
  });

  testWidgets(
    'settings screen scrolls at narrow mobile width with large text',
    (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(1.3)),
            child: child!,
          ),
          home: SystemAdminSettingsScreen(
            userSessionLoader: () async => const CurrentUserSession(
              nome: 'Admin de teste',
              role: 'administrador',
            ),
            settingsLoader: () async => _initialSettings,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView), const Offset(0, -900));
      await tester.pumpAndSettle();

      expect(find.text('Salvar para o sistema'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
