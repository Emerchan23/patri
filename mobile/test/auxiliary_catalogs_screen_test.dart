import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/auxiliary_catalogs_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  testWidgets('formulário de fornecedor valida e envia dados no celular', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final api = _AuxiliaryApiFake();
    await tester.pumpWidget(
      MaterialApp(home: AuxiliaryCatalogsScreen(apiService: api)),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Fornecedores').first);
    await tester.tap(find.text('Fornecedores').first);
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Novo fornecedor'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Nome / razão social *'),
      'Fornecedor Teste',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'CNPJ ou CPF *'),
      '52998224725',
    );
    await tester.enterText(find.widgetWithText(TextField, 'Cidade'), 'Goiânia');
    await tester.enterText(find.widgetWithText(TextField, 'UF'), 'GO');
    await tester.ensureVisible(find.text('Cadastrar'));
    await tester.tap(find.text('Cadastrar'));
    await tester.pumpAndSettle();

    expect(api.createdSupplier?['nome'], 'Fornecedor Teste');
    expect(api.createdSupplier?['cnpj'], '52998224725');
    expect(api.createdSupplier?['cidade'], 'Goiânia');
    expect(api.createdSupplier?['estado'], 'GO');
    expect(find.text('Novo fornecedor'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

class _AuxiliaryApiFake extends ApiService {
  Map<String, dynamic>? createdSupplier;

  @override
  Future<List<Map<String, dynamic>>> getCategorias({
    bool forceRefresh = false,
  }) async => [];

  @override
  Future<List<Map<String, dynamic>>> getMarcas({
    bool forceRefresh = false,
  }) async => [];

  @override
  Future<List<Map<String, dynamic>>> getSecretarias({
    bool forceRefresh = false,
  }) async => [];

  @override
  Future<List<Map<String, dynamic>>> getFornecedores({
    bool forceRefresh = false,
  }) async => [];

  @override
  Future<void> createFornecedor(Map<String, dynamic> supplier) async {
    createdSupplier = supplier;
  }
}
