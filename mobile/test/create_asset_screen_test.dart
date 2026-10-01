import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/create_asset_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/widgets/searchable_dropdown.dart';

void main() {
  testWidgets('cadastro de veículo solicita dados da frota no passo final', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await _reachFinalStep(
      tester,
      _CreateAssetApiFake(),
      categoryLabel: 'Veículo',
    );

    expect(
      find.byKey(const ValueKey('vehicle-registration-plate')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('vehicle-registration-year')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('vehicle-registration-mileage')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('cadastro sem foto orienta e nao envia para a API', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final api = _CreateAssetApiFake();
    await _reachFinalStep(tester, api);

    await tester.ensureVisible(find.text('Cadastrar bem'));
    await tester.tap(find.text('Cadastrar bem'));
    await tester.pumpAndSettle();

    expect(find.text('Foto do bem *'), findsOneWidget);
    expect(
      find.text('Adicione uma foto do bem para continuar.'),
      findsOneWidget,
    );
    expect(api.attempts, 0);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _reachFinalStep(
  WidgetTester tester,
  _CreateAssetApiFake api, {
  String categoryLabel = 'Informática',
}) async {
  await tester.pumpWidget(
    MaterialApp(home: CreateAssetScreen(apiService: api)),
  );
  await tester.pumpAndSettle();

  await tester.enterText(
    find.widgetWithText(TextFormField, 'Descrição'),
    'Notebook de teste',
  );
  await _choose<String>(tester, 'Categoria', categoryLabel);
  await tester.ensureVisible(find.text('Continuar'));
  await tester.tap(find.text('Continuar'));
  await tester.pumpAndSettle();
  expect(find.text('Etapa 2 de 3 · Local e responsável'), findsOneWidget);

  await _choose<int>(tester, 'Secretaria', 'Secretaria de teste');
  await _choose<int>(tester, 'Departamento', 'Departamento de teste');
  await _choose<int>(tester, 'Sala', 'Sala de teste');
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Nome do Responsável (Manual)'),
    'Responsável de teste',
  );
  await tester.ensureVisible(find.text('Continuar'));
  await tester.tap(find.text('Continuar'));
  await tester.pumpAndSettle();
  expect(find.text('Etapa 3 de 3 · Complementos'), findsOneWidget);
}

Future<void> _choose<T>(WidgetTester tester, String label, String value) async {
  final dropdown = find.byWidgetPredicate(
    (widget) => widget is SearchableDropdown<T> && widget.label == label,
  );
  await tester.ensureVisible(dropdown);
  await tester.tap(dropdown);
  await tester.pumpAndSettle();
  await tester.tap(find.text(value));
  await tester.pumpAndSettle();
}

class _CreateAssetApiFake extends ApiService {
  int attempts = 0;

  @override
  Future<List<Map<String, dynamic>>> getSecretarias({
    bool forceRefresh = false,
  }) async => [
    {'id': 1, 'nome': 'Secretaria de teste'},
  ];

  @override
  Future<List<Map<String, dynamic>>> getCategorias({
    bool forceRefresh = false,
  }) async => [
    {'slug': 'informatica', 'nome': 'Informática'},
    {'slug': 'veiculo', 'nome': 'Veículo'},
  ];

  @override
  Future<List<Map<String, dynamic>>> getGrupos({
    bool forceRefresh = false,
  }) async => [];

  @override
  Future<List<Map<String, dynamic>>> getServidores({
    bool forceRefresh = false,
  }) async => [];

  @override
  Future<List<Map<String, dynamic>>> getMarcas({
    bool forceRefresh = false,
  }) async => [];

  @override
  Future<List<Map<String, dynamic>>> getFornecedores({
    bool forceRefresh = false,
  }) async => [];

  @override
  Future<List<Map<String, dynamic>>> getDepartamentos(int secretariaId) async =>
      [
        {'id': 2, 'nome': 'Departamento de teste'},
      ];

  @override
  Future<List<Map<String, dynamic>>> getSalas(int departamentoId) async => [
    {'id': 3, 'nome': 'Sala de teste'},
  ];

  @override
  Future<dynamic> createAsset(Map<String, dynamic> data) async {
    attempts++;
    throw Exception('conexão de teste');
  }
}
