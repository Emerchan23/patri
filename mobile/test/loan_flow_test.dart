import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/screens/create_loan_screen.dart';
import 'package:sis_patrimonio_mobile/screens/loans_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/widgets/searchable_dropdown.dart';

void main() {
  testWidgets('empréstimo exige destino explícito e confirma dados do termo', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final api = _LoanApiFake();
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
                        builder: (_) =>
                            CreateLoanScreen(asset: _asset, apiService: api),
                      ),
                    ) ??
                    false;
              },
              child: const Text('Abrir empréstimo'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Abrir empréstimo'));
    await tester.pumpAndSettle();

    expect(find.text('Selecione'), findsNWidgets(3));
    await tester.tap(find.text('Registrar empréstimo'));
    await tester.pumpAndSettle();
    expect(find.text('Conferir empréstimo'), findsNothing);
    expect(api.payload, isNull);

    await _choose(tester, 'Secretaria de destino', 'Secretaria B');
    await _choose(tester, 'Departamento de destino', 'Departamento B');
    await _choose(tester, 'Sala de destino', 'Sala B');
    await tester.enterText(
      find.widgetWithText(TextField, 'Responsável que receberá *'),
      'Pessoa Teste',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Motivo do empréstimo *'),
      'Uso temporário',
    );
    await tester.tap(find.text('Registrar empréstimo'));
    await tester.pumpAndSettle();

    expect(find.text('Conferir empréstimo'), findsOneWidget);
    expect(find.textContaining('PAT-500 · Projetor de teste'), findsOneWidget);
    expect(find.text('Recebedor: Pessoa Teste'), findsOneWidget);
    expect(find.text('Motivo: Uso temporário'), findsOneWidget);
    expect(api.payload, isNull);

    await tester.tap(find.text('Registrar empréstimo').last);
    await tester.pumpAndSettle();
    expect(api.payload?['assetId'], '500');
    expect(api.payload?['responsavelEmprestimo'], 'Gestor de teste');
    expect(api.payload?['responsavelRecebimento'], 'Pessoa Teste');
    expect(api.payload?['destino'], {
      'secretaria': 'Secretaria B',
      'departamento': 'Departamento B',
      'sala': 'Sala B',
    });
    expect(api.payload?['motivo'], 'Uso temporário');
    expect(api.payload?['exigirTermo'], isTrue);
    expect(completed, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('devolução só é registrada depois da confirmação explícita', (
    tester,
  ) async {
    final api = _LoanApiFake();
    await tester.pumpWidget(MaterialApp(home: LoansScreen(apiService: api)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Projetor emprestado'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Registrar devolução'));
    await tester.pumpAndSettle();
    expect(find.text('Registrar devolução?'), findsOneWidget);
    expect(api.returnedLoanId, isNull);

    await tester.tap(find.text('Ainda não'));
    await tester.pumpAndSettle();
    expect(api.returnedLoanId, isNull);

    await tester.tap(find.text('Registrar devolução'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar devolução'));
    await tester.pumpAndSettle();
    expect(api.returnedLoanId, 'loan-1');
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

final _asset = Asset(
  id: '500',
  patrimonio: 'PAT-500',
  descricao: 'Projetor de teste',
  categoria: 'Eletrônicos',
  localizacao: AssetLocation(
    secretaria: 'Secretaria A',
    departamento: 'Departamento A',
    sala: 'Sala A',
  ),
  valor: 900,
  status: 'ativo',
);

class _LoanApiFake extends ApiService {
  Map<String, dynamic>? payload;
  String? returnedLoanId;

  @override
  Future<List<Map<String, dynamic>>> getLoans({String? status}) async => [
    {
      'id': 'loan-1',
      'status': 'ativo',
      'bemDescricao': 'Projetor emprestado',
      'patrimonio': 'PAT-500',
      'origem': {
        'secretaria': 'Secretaria A',
        'departamento': 'Departamento A',
        'sala': 'Sala A',
      },
      'destino': {
        'secretaria': 'Secretaria B',
        'departamento': 'Departamento B',
        'sala': 'Sala B',
      },
      'responsavelRecebimento': 'Pessoa Teste',
      'dataEmprestimo': '2026-09-30',
      'dataPrevistaDevolucao': '2026-10-07',
      'motivo': 'Uso temporário',
    },
  ];

  @override
  Future<void> returnLoan(String id, {String? notes}) async {
    returnedLoanId = id;
  }

  @override
  Future<CurrentUserSession?> getCurrentUserSession() async =>
      const CurrentUserSession(nome: 'Gestor de teste', role: 'gestor');

  @override
  Future<List<Map<String, dynamic>>> getSecretarias({
    bool forceRefresh = false,
  }) async => [
    {'id': 1, 'nome': 'Secretaria A'},
    {'id': 2, 'nome': 'Secretaria B'},
  ];

  @override
  Future<List<Map<String, dynamic>>> getDepartamentos(int secretariaId) async =>
      [
        {
          'id': secretariaId * 10,
          'nome': secretariaId == 1 ? 'Departamento A' : 'Departamento B',
        },
      ];

  @override
  Future<List<Map<String, dynamic>>> getSalas(int departamentoId) async => [
    {
      'id': departamentoId * 10,
      'nome': departamentoId == 10 ? 'Sala A' : 'Sala B',
    },
  ];

  @override
  Future<void> createLoan(Map<String, dynamic> loanPayload) async {
    payload = loanPayload;
  }
}
