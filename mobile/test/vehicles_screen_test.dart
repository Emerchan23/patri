import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/vehicles_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  testWidgets('gestor edita dados do veículo pela interface móvel', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final api = _VehiclesApiFake(
      session: const CurrentUserSession(
        id: 'manager-1',
        nome: 'Gestor de teste',
        role: 'administrador',
      ),
    );
    await tester.pumpWidget(MaterialApp(home: VehiclesScreen(apiService: api)));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    expect(find.byTooltip('Editar veículo'), findsOneWidget);
    await tester.tap(find.byTooltip('Editar veículo').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Editar veículo'), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('vehicle-edit-plate')),
      'NEW1A23',
    );
    await tester.enterText(
      find.byKey(const ValueKey('vehicle-edit-year')),
      '2025',
    );
    await tester.enterText(
      find.byKey(const ValueKey('vehicle-edit-mileage')),
      '50000',
    );
    await tester.ensureVisible(find.text('Salvar'));
    await tester.tap(find.text('Salvar'));
    await tester.pumpAndSettle();

    expect(api.updatedVehicleId, 'vehicle-1');
    expect(api.updatedData?['placa'], 'NEW1A23');
    expect(api.updatedData?['ano'], 2025);
    expect(api.updatedData?['kmAtual'], 50000);
    expect(api.updatedData?['status'], 'ativo');
    expect(find.text('Veículo atualizado.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('cartão de veículo rola em tela estreita e texto ampliado', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(1.3)),
            child: VehiclesScreen(apiService: _VehiclesApiFake()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Veículos'), findsOneWidget);
    expect(find.text('SEDAN DE SERVIÇO MUNICIPAL'), findsOneWidget);
    expect(find.text('ABC1D23'), findsOneWidget);
    expect(find.text('Quilometragem'), findsOneWidget);
    expect(find.byTooltip('Editar veículo'), findsNothing);

    await tester.enterText(
      find.byKey(const ValueKey('vehicle-search')),
      'XYZ9K87',
    );
    await tester.pumpAndSettle();
    expect(find.text('PICKUP DE MANUTENÇÃO'), findsOneWidget);
    expect(find.text('SEDAN DE SERVIÇO MUNICIPAL'), findsNothing);

    await tester.tap(find.byTooltip('Limpar busca'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey('vehicle-status-em_manutencao')),
    );
    await tester.pumpAndSettle();
    expect(find.text('PICKUP DE MANUTENÇÃO'), findsOneWidget);
    expect(find.text('SEDAN DE SERVIÇO MUNICIPAL'), findsNothing);

    await tester.tap(find.byKey(const ValueKey('vehicle-status-ativo')));
    await tester.pumpAndSettle();
    expect(find.text('SEDAN DE SERVIÇO MUNICIPAL'), findsOneWidget);
    expect(find.text('PICKUP DE MANUTENÇÃO'), findsNothing);
    await tester.scrollUntilVisible(
      find.text('Secretaria de Saúde / Departamento de Transporte / Garagem'),
      220,
      scrollable: find.byType(Scrollable).first,
    );
    expect(
      find.text('Secretaria de Saúde / Departamento de Transporte / Garagem'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('exclusão de veículo exige motivo e registra a confirmação', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final api = _VehiclesApiFake(
      session: const CurrentUserSession(
        nome: 'Gestor de teste',
        role: 'gestor',
      ),
    );
    await tester.pumpWidget(MaterialApp(home: VehiclesScreen(apiService: api)));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Excluir veículo').first);
    await tester.pumpAndSettle();
    expect(find.text('Excluir veículo?'), findsOneWidget);
    expect(api.deletedVehicleId, isNull);
    final confirm = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Excluir veículo'),
    );
    expect(confirm.onPressed, isNull);

    await tester.enterText(find.byType(TextField).last, 'Veículo substituído');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Excluir veículo'));
    await tester.pumpAndSettle();

    expect(api.deletedVehicleId, 'vehicle-1');
    expect(api.deleteReason, 'Veículo substituído');
    expect(find.text('SEDAN DE SERVIÇO MUNICIPAL'), findsNothing);
    expect(find.text('PICKUP DE MANUTENÇÃO'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _VehiclesApiFake extends ApiService {
  final CurrentUserSession? session;
  final Set<String> _deletedIds = {};
  String? deletedVehicleId;
  String? deleteReason;
  String? updatedVehicleId;
  Map<String, dynamic>? updatedData;

  _VehiclesApiFake({
    this.session = const CurrentUserSession(
      nome: 'Assistente de teste',
      role: 'assistente',
    ),
  });

  @override
  Future<List<Map<String, dynamic>>> getVehicles() async => [
    {
      'id': 'vehicle-1',
      'descricao': 'SEDAN DE SERVIÇO MUNICIPAL',
      'patrimonio': 'PAT-VEIC-01',
      'placa': 'ABC1D23',
      'marca': 'Marca de teste',
      'modelo': 'Modelo longo para testar quebra em celular estreito',
      'ano': 2023,
      'kmAtual': 45678,
      'status': 'ativo',
      'localizacao': {
        'secretaria': 'Secretaria de Saúde',
        'departamento': 'Departamento de Transporte',
        'sala': 'Garagem',
      },
    },
    {
      'id': 'vehicle-2',
      'descricao': 'PICKUP DE MANUTENÇÃO',
      'patrimonio': 'PAT-VEIC-02',
      'placa': 'XYZ9K87',
      'marca': 'Outra marca',
      'modelo': 'Pickup',
      'ano': 2022,
      'kmAtual': 93000,
      'status': 'em_manutencao',
      'localizacao': {
        'secretaria': 'Secretaria de Obras',
        'departamento': 'Oficina',
        'sala': 'Garagem',
      },
    },
  ].where((vehicle) => !_deletedIds.contains(vehicle['id'])).toList();

  @override
  Future<CurrentUserSession?> getCurrentUserSession() async => session;

  @override
  Future<void> deleteVehicle(String id, {required String reason}) async {
    deletedVehicleId = id;
    deleteReason = reason;
    _deletedIds.add(id);
  }

  @override
  Future<void> updateVehicle(
    String id, {
    required Map<String, dynamic> data,
  }) async {
    updatedVehicleId = id;
    updatedData = data;
  }
}
