import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/screens/movement_scan_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  testWidgets(
    'adiciona várias leituras do scanner à fila e mantém o destino informado',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final api = _MovementScanApiFake();
      const destination = {
        'secretaria': 'Secretaria Destino',
        'departamento': 'Departamento Destino',
        'sala': 'Sala Destino',
      };
      ValueChanged<String>? deliverScan;

      await tester.pumpWidget(
        MaterialApp(
          home: MovementScanScreen(
            initialDestination: destination,
            apiService: api,
            pauseCamera: () async {},
            resumeCamera: () async {},
            scannerPreviewBuilder: (onCode) {
              deliverScan = onCode;
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      deliverScan!('PAT-11');
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('PAT-11'), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      deliverScan!('PAT-22');
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('2 bens na lista'), findsOneWidget);
      expect(
        find.textContaining('Próximo destino: Secretaria Destino'),
        findsOneWidget,
      );
      expect(find.text('PAT-11'), findsOneWidget);
      expect(find.text('PAT-22'), findsOneWidget);
      expect(api.movementCalls, 0);
      expect(tester.takeException(), isNull);
    },
  );
}

class _MovementScanApiFake extends ApiService {
  final Map<String, Asset> _assets = {
    'PAT-11': _asset('11', 'PAT-11'),
    'PAT-22': _asset('22', 'PAT-22'),
  };
  int movementCalls = 0;

  @override
  Future<Asset?> getAssetByPatrimony(String code) async => _assets[code];

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
    movementCalls++;
  }
}

Asset _asset(String id, String code) => Asset(
  id: id,
  patrimonio: code,
  descricao: 'Bem $code',
  categoria: 'Equipamentos',
  localizacao: AssetLocation(
    secretaria: 'Secretaria Origem',
    departamento: 'Departamento Origem',
    sala: 'Sala Origem',
  ),
  valor: 200,
  status: 'ativo',
);
