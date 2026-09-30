import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  group('CurrentUserSession permissions', () {
    test('default role matrix matches the web permission matrix', () {
      const administrator = CurrentUserSession(
        nome: 'Admin',
        role: 'administrador',
      );
      const manager = CurrentUserSession(nome: 'Gestor', role: 'gestor');
      const assistant = CurrentUserSession(
        nome: 'Assistente',
        role: 'assistente',
      );

      expect(_enabledPermissions(administrator), _permissionNames);
      expect(_enabledPermissions(manager), {
        'acessarMovimentacoes',
        'verDashboardGeral',
        'verDashboardUnidade',
        'cadastrarBem',
        'editarBem',
        'atribuirPatrimonioDefinitivo',
        'verTodosBens',
        'verBensUnidade',
        'registrarMovimentacao',
        'aprovarMovimentacao',
        'acessarCadastrosProvisorios',
        'gerenciarVeiculos',
        'verVeiculos',
        'usarScanner',
        'verRelatorios',
        'verPendenciasPatrimonio',
        'gerarEtiquetas',
        'gerenciarEmprestimos',
        'gerenciarCadastrosAuxiliares',
        'excluirBem',
        'gerenciarAlienacoes',
      });
      expect(_enabledPermissions(assistant), {
        'acessarMovimentacoes',
        'verDashboardUnidade',
        'verBensUnidade',
        'verVeiculos',
        'usarScanner',
      });
    });

    test('uses explicit server permission overrides', () {
      final user = CurrentUserSession.fromJson({
        'nome': 'Gestor de teste',
        'role': 'gestor',
        'permissions': {'registrarMovimentacao': false, 'cadastrarBem': true},
      });

      expect(user.hasPermission('registrarMovimentacao'), isFalse);
      expect(user.hasPermission('cadastrarBem'), isTrue);
    });

    test(
      'fails closed when an explicit server permission map is incomplete',
      () {
        final user = CurrentUserSession.fromJson({
          'nome': 'Gestor com resposta parcial',
          'role': 'gestor',
          'permissions': {'registrarMovimentacao': true},
        });

        expect(user.hasPermission('registrarMovimentacao'), isTrue);
        expect(user.hasPermission('gerenciarEmprestimos'), isFalse);
        expect(user.hasPermission('gerenciarAlienacoes'), isFalse);
      },
    );

    test('falls back to assistant capabilities when overrides are absent', () {
      const user = CurrentUserSession(nome: 'Assistente', role: 'assistente');

      expect(user.hasPermission('usarScanner'), isTrue);
      expect(user.hasPermission('verBensUnidade'), isTrue);
      expect(user.hasPermission('registrarMovimentacao'), isFalse);
      expect(user.hasPermission('cadastrarBem'), isFalse);
    });

    test('does not give user administration to a gestor by default', () {
      const user = CurrentUserSession(nome: 'Gestor', role: 'gestor');

      expect(user.hasPermission('registrarMovimentacao'), isTrue);
      expect(user.hasPermission('aprovarMovimentacao'), isTrue);
      expect(user.hasPermission('gerenciarUsuarios'), isFalse);
      expect(user.hasPermission('baixarBem'), isFalse);
    });

    test('empréstimos ficam restritos aos perfis autorizados', () {
      const admin = CurrentUserSession(nome: 'Admin', role: 'administrador');
      const gestor = CurrentUserSession(nome: 'Gestor', role: 'gestor');
      const assistant = CurrentUserSession(
        nome: 'Assistente',
        role: 'assistente',
      );

      expect(admin.hasPermission('gerenciarEmprestimos'), isTrue);
      expect(gestor.hasPermission('gerenciarEmprestimos'), isTrue);
      expect(assistant.hasPermission('gerenciarEmprestimos'), isFalse);
    });

    test(
      'administração e etiquetas seguem o perfil/permissões do servidor',
      () {
        const admin = CurrentUserSession(nome: 'Admin', role: 'administrador');
        const assistant = CurrentUserSession(
          nome: 'Assistente',
          role: 'assistente',
        );
        final restrictedAdmin = CurrentUserSession.fromJson({
          'nome': 'Admin restrito',
          'role': 'administrador',
          'permissions': {'gerarEtiquetas': false},
        });

        expect(admin.hasPermission('gerenciarUsuarios'), isTrue);
        expect(admin.hasPermission('gerarEtiquetas'), isTrue);
        expect(assistant.hasPermission('gerenciarUsuarios'), isFalse);
        expect(assistant.hasPermission('gerarEtiquetas'), isFalse);
        expect(restrictedAdmin.hasPermission('gerarEtiquetas'), isFalse);
      },
    );

    test(
      'assistant may submit unit requests, but cannot approve or transfer',
      () {
        const user = CurrentUserSession(nome: 'Assistente', role: 'assistente');

        expect(user.hasPermission('acessarMovimentacoes'), isTrue);
        expect(user.hasPermission('verBensUnidade'), isTrue);
        expect(user.hasPermission('aprovarMovimentacao'), isFalse);
        expect(user.hasPermission('registrarMovimentacao'), isFalse);
      },
    );
  });
}

Set<String> _enabledPermissions(CurrentUserSession user) =>
    _permissionNames.where(user.hasPermission).toSet();

const _permissionNames = <String>{
  'acessarMovimentacoes',
  'verDashboardGeral',
  'verDashboardUnidade',
  'cadastrarBem',
  'editarBem',
  'baixarBem',
  'atribuirPatrimonioDefinitivo',
  'verTodosBens',
  'verBensUnidade',
  'registrarMovimentacao',
  'aprovarMovimentacao',
  'acessarCadastrosProvisorios',
  'gerenciarVeiculos',
  'verVeiculos',
  'usarScanner',
  'gerenciarUsuarios',
  'verRelatorios',
  'verPendenciasPatrimonio',
  'gerarEtiquetas',
  'gerenciarEmprestimos',
  'gerenciarCadastrosAuxiliares',
  'excluirBem',
  'gerenciarAlienacoes',
};
