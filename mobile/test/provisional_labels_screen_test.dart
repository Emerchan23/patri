import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/provisional_labels_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  testWidgets('lote móvel salva PDF A4 sem integração com impressora', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    Uint8List? savedBytes;
    String? savedFilename;
    await tester.pumpWidget(
      MaterialApp(
        home: ProvisionalLabelsScreen(
          apiService: _LabelsApiFake(),
          savePdf: ({required bytes, required filename}) async {
            savedBytes = bytes;
            savedFilename = filename;
            return '/downloads/$filename';
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Etiquetas provisórias'), findsOneWidget);
    expect(find.text('Reservar lote'), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsNothing);
    expect(find.text('Salvar PDF A4'), findsNWidgets(2));
    expect(find.text('Compartilhar PDF A4'), findsNothing);
    expect(find.text('Imprimir pendentes'), findsNothing);
    expect(find.text('5 etiquetas · 5 pendentes'), findsOneWidget);
    expect(find.text('1 etiqueta · 1 pendente'), findsOneWidget);
    expect(find.textContaining('Zebra'), findsNothing);
    expect(find.textContaining('Bluetooth'), findsNothing);

    await tester.tap(find.text('Salvar PDF A4').first);
    await tester.pumpAndSettle();

    expect(savedFilename, 'etiquetas-lote-42.pdf');
    expect(savedBytes, isNotNull);
    expect(String.fromCharCodes(savedBytes!.take(5)), '%PDF-');
    expect(String.fromCharCodes(savedBytes!), contains('/FontFile2'));
    expect(savedBytes!.length, greaterThan(500));
    expect(find.text('PDF salvo com sucesso.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _LabelsApiFake extends ApiService {
  @override
  Future<List<Map<String, dynamic>>> getProvisionalLabelLots() async => [
    {
      'id': 42,
      'status': 'ativo',
      'quantidade': 5,
      'pendentes': 5,
      'faixa_inicial': 1001,
      'faixa_final': 1005,
    },
    {
      'id': 43,
      'status': 'ativo',
      'quantidade': 1,
      'pendentes': 1,
      'faixa_inicial': 1006,
      'faixa_final': 1006,
    },
  ];

  @override
  Future<List<Map<String, dynamic>>> getProvisionalLotLabels(
    String lotId,
  ) async => [
    {'codigo': 'PROV-2026-01001'},
  ];
}
