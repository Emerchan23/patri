import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/movement_requests_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  testWidgets('assistente confirma antes de cancelar o próprio pedido', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final api = _MovementRequestsApiFake();
    await tester.pumpWidget(
      MaterialApp(home: MovementRequestsScreen(apiService: api)),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('1 bem(ns) · Assistente de teste'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Cancelar pedido'));
    await tester.pumpAndSettle();
    expect(find.text('Cancelar solicitação?'), findsOneWidget);
    expect(api.updatedId, isNull);

    await tester.tap(find.text('Voltar'));
    await tester.pumpAndSettle();
    expect(api.updatedId, isNull);
    expect(find.text('Cancelar pedido'), findsOneWidget);

    await tester.tap(find.text('Cancelar pedido'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar pedido').last);
    await tester.pumpAndSettle();

    expect(api.updatedId, 'req-1');
    expect(api.updatedAction, 'cancelar');
    expect(find.text('Solicitação cancelada.'), findsOneWidget);
    expect(find.text('Não há solicitações nesta categoria.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _MovementRequestsApiFake extends ApiService {
  bool cancelled = false;
  String? updatedId;
  String? updatedAction;

  @override
  Future<CurrentUserSession?> getCurrentUserSession() async =>
      const CurrentUserSession(
        id: 'assistant-1',
        nome: 'Assistente de teste',
        role: 'assistente',
        secretaria: 'Secretaria de teste',
        departamento: 'Departamento de teste',
      );

  @override
  Future<List<Map<String, dynamic>>> getMovementRequests({
    String status = 'todas',
  }) async => cancelled
      ? []
      : [
          {
            'id': 'req-1',
            'status': 'pendente',
            'totalItens': 1,
            'solicitanteId': 'assistant-1',
            'solicitanteNome': 'Assistente de teste',
            'departamentoDestino': 'Departamento destino',
            'salaDestino': 'Sala destino',
            'secretariaOrigem': 'Secretaria de teste',
            'motivo': 'Realocação de teste',
            'itens': [
              {'patrimonio': 'E2E-REQ-1', 'bemDescricao': 'Bem sintético'},
            ],
          },
        ];

  @override
  Future<void> updateMovementRequest({
    required String id,
    required String action,
    String? rejectionReason,
  }) async {
    updatedId = id;
    updatedAction = action;
    cancelled = action == 'cancelar';
  }
}
