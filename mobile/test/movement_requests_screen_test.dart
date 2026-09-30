import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/movement_requests_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  testWidgets('gestor só aprova depois de revisar e confirmar o lote', (
    tester,
  ) async {
    final api = _RequestsApiFake(
      user: const CurrentUserSession(nome: 'Gestor', role: 'gestor'),
    );
    await tester.pumpWidget(
      MaterialApp(home: MovementRequestsScreen(apiService: api)),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('2 bem(ns) · Assistente de teste'));
    await tester.pumpAndSettle();
    expect(find.text('Aprovar'), findsOneWidget);
    expect(find.text('Rejeitar'), findsOneWidget);

    await tester.tap(find.text('Aprovar'));
    await tester.pumpAndSettle();
    expect(find.text('Aprovar e transferir 2 bens?'), findsOneWidget);
    expect(find.text('Origem: Secretaria • Dep. A • Sala A'), findsOneWidget);
    expect(api.action, isNull);

    await tester.tap(find.text('Voltar'));
    await tester.pumpAndSettle();
    expect(api.action, isNull);

    await tester.tap(find.text('Aprovar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aprovar e transferir'));
    await tester.pumpAndSettle();
    expect(api.action, 'aprovar');
    expect(api.requestId, 'req-1');
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'assistente não aprova pedido e só cancela o próprio após confirmar',
    (tester) async {
      final api = _RequestsApiFake(
        user: const CurrentUserSession(
          id: 'assist-1',
          nome: 'Assistente',
          role: 'assistente',
        ),
      );
      await tester.pumpWidget(
        MaterialApp(home: MovementRequestsScreen(apiService: api)),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('2 bem(ns) · Assistente de teste'));
      await tester.pumpAndSettle();
      expect(find.text('Aprovar'), findsNothing);
      expect(find.text('Rejeitar'), findsNothing);
      expect(find.text('Cancelar pedido'), findsOneWidget);

      await tester.tap(find.text('Cancelar pedido'));
      await tester.pumpAndSettle();
      expect(find.text('Cancelar solicitação?'), findsOneWidget);
      expect(api.action, isNull);
      await tester.tap(find.text('Voltar'));
      await tester.pumpAndSettle();
      expect(api.action, isNull);

      await tester.tap(find.text('Cancelar pedido'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancelar pedido').last);
      await tester.pumpAndSettle();
      expect(api.action, 'cancelar');
      expect(api.requestId, 'req-1');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('rejeitar exige motivo e envia a justificativa digitada', (
    tester,
  ) async {
    final api = _RequestsApiFake(
      user: const CurrentUserSession(nome: 'Gestor', role: 'gestor'),
    );
    await tester.pumpWidget(
      MaterialApp(home: MovementRequestsScreen(apiService: api)),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('2 bem(ns) · Assistente de teste'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Rejeitar'));
    await tester.pumpAndSettle();
    expect(find.text('Motivo da rejeição'), findsOneWidget);
    final disabledReject = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Rejeitar'),
    );
    expect(disabledReject.onPressed, isNull);
    expect(api.action, isNull);

    await tester.enterText(find.byType(TextField).last, 'Destino incompatível');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Rejeitar'));
    await tester.pumpAndSettle();
    expect(api.action, 'rejeitar');
    expect(api.rejectionReason, 'Destino incompatível');
    expect(tester.takeException(), isNull);
  });
}

class _RequestsApiFake extends ApiService {
  final CurrentUserSession user;
  String? action;
  String? requestId;
  String? rejectionReason;

  _RequestsApiFake({required this.user});

  @override
  Future<CurrentUserSession?> getCurrentUserSession() async => user;

  @override
  Future<List<Map<String, dynamic>>> getMovementRequests({
    String status = 'todas',
  }) async => [
    {
      'id': 'req-1',
      'status': 'pendente',
      'totalItens': 2,
      'solicitanteId': 'assist-1',
      'solicitanteNome': 'Assistente de teste',
      'secretariaOrigem': 'Secretaria',
      'secretariaDestino': 'Secretaria destino',
      'departamentoDestino': 'Dep. destino',
      'salaDestino': 'Sala destino',
      'motivo': 'Reorganização',
      'itens': [
        {
          'patrimonio': 'PAT-1',
          'bemDescricao': 'Mesa de teste',
          'de': {
            'secretaria': 'Secretaria',
            'departamento': 'Dep. A',
            'sala': 'Sala A',
          },
        },
        {
          'patrimonio': 'PAT-2',
          'bemDescricao': 'Cadeira de teste',
          'de': {
            'secretaria': 'Secretaria',
            'departamento': 'Dep. B',
            'sala': 'Sala B',
          },
        },
      ],
    },
  ];

  @override
  Future<void> updateMovementRequest({
    required String id,
    required String action,
    String? rejectionReason,
  }) async {
    requestId = id;
    this.action = action;
    this.rejectionReason = rejectionReason;
  }
}
