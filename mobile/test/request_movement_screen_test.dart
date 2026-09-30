import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/screens/request_movement_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/widgets/searchable_dropdown.dart';

void main() {
  testWidgets('assistente revisa e envia bens juntos para o mesmo destino', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final api = _RequestMovementApiFake();
    var completed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                completed =
                    await Navigator.of(context).push<bool>(
                      MaterialPageRoute(
                        builder: (_) => RequestMovementScreen(
                          assets: [
                            _asset('31', 'PAT-31'),
                            _asset('32', 'PAT-32'),
                          ],
                          apiService: api,
                        ),
                      ),
                    ) ??
                    false;
              },
              child: const Text('Abrir solicitação'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Abrir solicitação'));
    await tester.pumpAndSettle();

    await _choose(tester, 'Departamento de destino', 'Departamento B');
    await _choose(tester, 'Sala de destino', 'Sala B');
    await tester.enterText(find.byType(TextField), 'Realocação solicitada');
    await tester.tap(find.text('Enviar para aprovação'));
    await tester.pumpAndSettle();

    expect(find.text('Conferir solicitação'), findsOneWidget);
    expect(find.textContaining('Enviar 2 bens'), findsOneWidget);
    expect(find.text('PAT-31'), findsOneWidget);
    expect(find.text('PAT-32'), findsOneWidget);
    expect(find.text('Motivo: Realocação solicitada'), findsOneWidget);
    expect(api.assetIds, isEmpty);

    await tester.tap(find.text('Enviar pedido'));
    await tester.pumpAndSettle();
    expect(api.assetIds, ['31', '32']);
    expect(api.secretaryDestination, 'Secretaria da unidade');
    expect(api.departmentDestination, 'Departamento B');
    expect(api.roomDestination, 'Sala B');
    expect(api.reason, 'Realocação solicitada');
    expect(completed, isTrue);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _choose(WidgetTester tester, String label, String value) async {
  final dropdown = find.byWidgetPredicate(
    (widget) =>
        widget is SearchableDropdown<Map<String, dynamic>> &&
        widget.label == label,
  );
  await tester.ensureVisible(dropdown);
  await tester.tap(dropdown);
  await tester.pumpAndSettle();
  await tester.tap(find.text(value));
  await tester.pumpAndSettle();
}

Asset _asset(String id, String code) => Asset(
  id: id,
  patrimonio: code,
  descricao: 'Bem $code',
  categoria: 'Equipamentos',
  localizacao: AssetLocation(
    secretaria: 'Secretaria da unidade',
    departamento: 'Departamento A',
    sala: 'Sala A',
  ),
  valor: 200,
  status: 'ativo',
);

class _RequestMovementApiFake extends ApiService {
  List<String> assetIds = [];
  String? secretaryDestination;
  String? departmentDestination;
  String? roomDestination;
  String? reason;

  @override
  Future<CurrentUserSession?> getCurrentUserSession() async =>
      const CurrentUserSession(
        id: 'assist-1',
        nome: 'Assistente de teste',
        role: 'assistente',
        secretaria: 'Secretaria da unidade',
        departamento: 'Departamento A',
      );

  @override
  Future<List<Map<String, dynamic>>> getSecretarias({
    bool forceRefresh = false,
  }) async => [
    {'id': 10, 'nome': 'Secretaria da unidade'},
  ];

  @override
  Future<List<Map<String, dynamic>>> getDepartamentos(int secretariaId) async =>
      [
        {'id': 20, 'nome': 'Departamento A'},
        {'id': 21, 'nome': 'Departamento B'},
      ];

  @override
  Future<List<Map<String, dynamic>>> getSalas(int departamentoId) async => [
    {
      'id': departamentoId * 10,
      'nome': departamentoId == 20 ? 'Sala A' : 'Sala B',
    },
  ];

  @override
  Future<void> createMovementRequest({
    required List<String> assetIds,
    required String secretariaDestino,
    required String departamentoDestino,
    required String salaDestino,
    required String motivo,
  }) async {
    this.assetIds = assetIds;
    secretaryDestination = secretariaDestino;
    departmentDestination = departamentoDestino;
    roomDestination = salaDestino;
    reason = motivo;
  }
}
