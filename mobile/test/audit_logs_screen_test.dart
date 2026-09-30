import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/audit_logs_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  testWidgets('filtros avançados continuam válidos após fechar o diálogo', (
    tester,
  ) async {
    final api = _AuditApiFake();
    await tester.pumpWidget(
      MaterialApp(home: AuditLogsScreen(apiService: api)),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Filtrar por ação ou usuário'));
    await tester.pumpAndSettle();
    expect(find.text('Filtrar auditoria'), findsOneWidget);
    await tester.enterText(find.byType(TextField).at(1), 'TRANSFERENCIA');
    await tester.enterText(find.byType(TextField).last, 'Maria');
    await tester.tap(find.text('Aplicar'));
    await tester.pumpAndSettle();

    expect(api.lastAction, 'TRANSFERENCIA');
    expect(api.lastUser, 'Maria');
    expect(find.text('Filtrar auditoria'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

class _AuditApiFake extends ApiService {
  String? lastAction;
  String? lastUser;

  @override
  Future<Map<String, dynamic>> getAuditLogs({
    int page = 1,
    String? search,
    String? action,
    String? user,
    String? startDate,
    String? endDate,
    int limit = 50,
  }) async {
    lastAction = action;
    lastUser = user;
    return {
      'data': <Map<String, dynamic>>[],
      'meta': {'totalPages': 1},
    };
  }
}
