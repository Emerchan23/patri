import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/provisional_labels_screen.dart';

void main() {
  testWidgets('permite escolher etiqueta Zebra de 100 mm', (tester) async {
    LabelPrintOptions? result;
    const layout = {'title': 'Preset web', 'qrSizeMm': 18};
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                result = await showDialog<LabelPrintOptions>(
                  context: context,
                  builder: (_) => const LabelPrintDialog(layout: layout),
                );
              },
              child: const Text('Abrir impressão'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Abrir impressão'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Etiqueta térmica (Zebra)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('100 mm · 2 colunas'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continuar'));
    await tester.pumpAndSettle();

    expect(result?.zebra, isTrue);
    expect(result?.columns, 2);
    expect(result?.layout['title'], 'Preset web');
    expect(result?.layout['qrSizeMm'], 18);
  });
}
