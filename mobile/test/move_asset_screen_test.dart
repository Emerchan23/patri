import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/models/movement_result.dart';
import 'package:sis_patrimonio_mobile/screens/move_asset_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/widgets/searchable_dropdown.dart';

void main() {
  testWidgets('confere vários bens e envia todos ao mesmo destino', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final api = _MovementApiFake();
    MovementResult? result;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: ElevatedButton(
                onPressed: () async {
                  result = await Navigator.of(context).push<MovementResult>(
                    MaterialPageRoute(
                      builder: (_) => MoveAssetScreen(
                        assets: [
                          _asset('11', 'PAT-11', 'Secretaria A'),
                          _asset('22', 'PAT-22', 'Secretaria B'),
                        ],
                        apiService: api,
                      ),
                    ),
                  );
                },
                child: const Text('Abrir lote'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Abrir lote'));
    await tester.pumpAndSettle();

    expect(find.text('2 bens selecionados'), findsOneWidget);
    expect(find.textContaining('Origem: Secretaria A'), findsOneWidget);
    expect(find.textContaining('Origem: Secretaria B'), findsOneWidget);

    await _selectCatalogValue(tester, 'Secretaria', 'Secretaria Destino');
    await _selectCatalogValue(tester, 'Departamento', 'Departamento Destino');
    await _selectCatalogValue(tester, 'Sala', 'Sala Destino');
    await tester.enterText(find.byType(TextFormField), 'Reorganização');
    await tester.ensureVisible(find.text('CONFIRMAR MOVIMENTAÇÃO'));
    await tester.tap(find.text('CONFIRMAR MOVIMENTAÇÃO'));
    await tester.pumpAndSettle();

    expect(find.text('Conferir transferência'), findsOneWidget);
    expect(find.textContaining('Transferir 2 bens'), findsOneWidget);
    expect(
      find.text(
        'Origem: Secretaria A • Departamento Secretaria A • Sala Secretaria A',
      ),
      findsOneWidget,
    );
    expect(
      find.text(
        'Origem: Secretaria B • Departamento Secretaria B • Sala Secretaria B',
      ),
      findsOneWidget,
    );
    expect(api.assetIds, isEmpty);

    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(api.assetIds, ['11', '22']);
    expect(api.destination, {
      'secretaria': 'Secretaria Destino',
      'departamento': 'Departamento Destino',
      'sala': 'Sala Destino',
    });
    expect(api.reason, 'Reorganização');
    expect(result?.destination, api.destination);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _selectCatalogValue(
  WidgetTester tester,
  String label,
  String value,
) async {
  final dropdown = find.byWidgetPredicate(
    (widget) => widget is SearchableDropdown<int> && widget.label == label,
  );
  await tester.ensureVisible(dropdown);
  await tester.tap(dropdown);
  await tester.pumpAndSettle();
  await tester.tap(find.text(value).last);
  await tester.pumpAndSettle();
}

Asset _asset(String id, String code, String secretaria) => Asset(
  id: id,
  patrimonio: code,
  descricao: 'Bem $code',
  categoria: 'Móveis',
  localizacao: AssetLocation(
    secretaria: secretaria,
    departamento: 'Departamento $secretaria',
    sala: 'Sala $secretaria',
  ),
  valor: 100,
  status: 'ativo',
);

class _MovementApiFake extends ApiService {
  List<String> assetIds = [];
  Map<String, String?>? destination;
  String? reason;

  @override
  Future<List<Map<String, dynamic>>> getSecretarias({
    bool forceRefresh = false,
  }) async => [
    {'id': 1, 'nome': 'Secretaria Destino'},
  ];

  @override
  Future<List<Map<String, dynamic>>> getDepartamentos(int secretariaId) async =>
      [
        {'id': 2, 'nome': 'Departamento Destino'},
      ];

  @override
  Future<List<Map<String, dynamic>>> getSalas(int departamentoId) async => [
    {'id': 3, 'nome': 'Sala Destino'},
  ];

  @override
  Future<void> createMovement({
    required List<String> assetIds,
    required Map<String, String?> destination,
    required String motivo,
  }) async {
    this.assetIds = assetIds;
    this.destination = destination;
    reason = motivo;
  }
}
