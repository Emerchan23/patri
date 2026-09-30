import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/users_admin_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  testWidgets('menu do usuário atual não oferece desativação nem exclusão', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: UsersAdminScreen(apiService: _UsersApiFake())),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(PopupMenuButton<String>).first);
    await tester.pumpAndSettle();
    expect(find.text('Editar'), findsOneWidget);
    expect(find.text('Desativar'), findsNothing);
    expect(find.text('Excluir'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('exclusão exige digitar o nome e confirmar', (tester) async {
    final api = _UsersApiFake();
    await tester.pumpWidget(
      MaterialApp(home: UsersAdminScreen(apiService: api)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Maria de Teste'), findsOneWidget);
    await _openDeleteMenu(tester);
    await tester.tap(find.text('Excluir'));
    await tester.pumpAndSettle();

    final disabledDelete = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Excluir usuário'),
    );
    expect(disabledDelete.onPressed, isNull);
    expect(api.deletedId, isNull);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(api.deletedId, isNull);

    await _openDeleteMenu(tester);
    await tester.tap(find.text('Excluir'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'Maria de Teste');
    await tester.pumpAndSettle();
    final enabledDelete = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Excluir usuário'),
    );
    expect(enabledDelete.onPressed, isNotNull);
    await tester.tap(find.text('Excluir usuário'));
    await tester.pumpAndSettle();

    expect(api.deletedId, '2');
    expect(tester.takeException(), isNull);
  });
}

Future<void> _openDeleteMenu(WidgetTester tester) async {
  await tester.tap(find.byType(PopupMenuButton<String>).last);
  await tester.pumpAndSettle();
}

class _UsersApiFake extends ApiService {
  String? deletedId;

  @override
  Future<List<Map<String, dynamic>>> getUsers() async => [
    {
      'id': '1',
      'nome': 'Admin de Teste',
      'email': 'admin@example.test',
      'cargo': 'Administrador',
      'role': 'administrador',
      'ativo': true,
      'acessoApp': true,
    },
    {
      'id': '2',
      'nome': 'Maria de Teste',
      'email': 'maria@example.test',
      'cargo': 'Assistente',
      'role': 'assistente',
      'ativo': true,
      'acessoApp': true,
    },
  ];

  @override
  Future<List<Map<String, dynamic>>> getSecretarias({
    bool forceRefresh = false,
  }) async => [];

  @override
  Future<CurrentUserSession?> getCurrentUserSession() async =>
      const CurrentUserSession(
        id: '1',
        nome: 'Admin de Teste',
        role: 'administrador',
      );

  @override
  Future<void> deleteUser(String id) async {
    deletedId = id;
  }
}
