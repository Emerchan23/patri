import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/vehicles_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
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
}

class _VehiclesApiFake extends ApiService {
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
  ];
}
