import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/backup_admin_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

const _schedule = BackupSchedule(
  enabled: true,
  frequency: 'weekly',
  time: '02:30',
  keepCount: 7,
);

const _backupFiles = <BackupFileInfo>[
  BackupFileInfo(name: 'auto-backup-test.sql', size: 1572864, createdAt: null),
];

void main() {
  test('backup settings and file metadata parse safely', () {
    final settings = BackupSchedule.fromJson({
      'enabled': 1,
      'frequency': 'monthly',
      'time': '04:15',
      'keep_count': '12',
    });
    final file = BackupFileInfo.fromJson({
      'name': 'backup.sql',
      'size': '2048',
      'created_at': '2026-09-30T12:00:00.000Z',
    });

    expect(settings.enabled, isTrue);
    expect(settings.frequency, 'monthly');
    expect(settings.keepCount, 12);
    expect(file.name, 'backup.sql');
    expect(file.size, 2048);
    expect(file.createdAt, DateTime.parse('2026-09-30T12:00:00.000Z'));
  });

  testWidgets('backup management remains unavailable to non-admin users', (
    tester,
  ) async {
    var loadersCalled = false;
    await tester.pumpWidget(
      MaterialApp(
        home: BackupAdminScreen(
          userSessionLoader: () async =>
              const CurrentUserSession(nome: 'Gestor de teste', role: 'gestor'),
          scheduleLoader: () async {
            loadersCalled = true;
            return _schedule;
          },
          filesLoader: () async {
            loadersCalled = true;
            return _backupFiles;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Somente administradores podem consultar ou alterar backups.'),
      findsOneWidget,
    );
    expect(loadersCalled, isFalse);
    expect(find.text('Salvar agendamento'), findsNothing);
  });

  testWidgets('invalid legacy schedule time falls back without crashing', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: BackupAdminScreen(
          userSessionLoader: () async => const CurrentUserSession(
            nome: 'Admin de teste',
            role: 'administrador',
          ),
          scheduleLoader: () async => const BackupSchedule(
            enabled: true,
            frequency: 'daily',
            time: '25:99',
            keepCount: 7,
          ),
          filesLoader: () async => const [],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Horário: 00:00'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('backup retention changes require explicit confirmation', (
    tester,
  ) async {
    BackupSchedule? saved;
    await tester.pumpWidget(
      MaterialApp(
        home: BackupAdminScreen(
          userSessionLoader: () async => const CurrentUserSession(
            nome: 'Admin de teste',
            role: 'administrador',
          ),
          scheduleLoader: () async => _schedule,
          filesLoader: () async => _backupFiles,
          saveSchedule: (value) async => saved = value,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.drag(find.byType(ListView), const Offset(0, -900));
    await tester.pumpAndSettle();
    expect(find.text('auto-backup-test.sql'), findsOneWidget);
    expect(find.textContaining('não executa um backup agora'), findsNothing);
    await tester.ensureVisible(find.text('Salvar agendamento'));
    await tester.tap(find.text('Salvar agendamento'));
    await tester.pumpAndSettle();
    expect(saved, isNull);
    expect(find.text('Confirmar alteração'), findsOneWidget);
    expect(
      find.textContaining('pode apagar os arquivos mais antigos'),
      findsOneWidget,
    );
    await tester.tap(find.text('Confirmar alteração'));
    await tester.pumpAndSettle();

    expect(saved?.enabled, isTrue);
    expect(saved?.frequency, 'weekly');
    expect(saved?.time, '02:30');
    expect(saved?.keepCount, 7);
    expect(find.text('Agendamento de backup atualizado.'), findsOneWidget);
  });

  testWidgets('backup screen fits narrow mobile viewport and supports scroll', (
    tester,
  ) async {
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
        home: BackupAdminScreen(
          userSessionLoader: () async => const CurrentUserSession(
            nome: 'Admin de teste',
            role: 'administrador',
          ),
          scheduleLoader: () async => _schedule,
          filesLoader: () async => _backupFiles,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -1200));
    await tester.pumpAndSettle();

    expect(find.text('Arquivos disponíveis (1)'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
