import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sis_patrimonio_mobile/screens/dashboard_screen.dart';
import 'package:sis_patrimonio_mobile/screens/home_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

void main() {
  testWidgets('painel cabe em celular estreito com texto ampliado', (
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
            child: DashboardScreen(statsLoader: (_) async => _sampleStats),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Visão geral do patrimônio'), findsOneWidget);
    expect(find.text('Resumo dos bens'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Movimentações recentes'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Movimentações recentes'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Distribuição por categoria'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Distribuição por categoria'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('painel explica falha de conexão e permite tentar novamente', (
    tester,
  ) async {
    var attempts = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: DashboardScreen(
          statsLoader: (_) async {
            attempts++;
            if (attempts == 1) throw Exception('Falha de conexão simulada');
            return _sampleStats;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Falha de conexão simulada'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsOneWidget);

    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();

    expect(find.text('Resumo dos bens'), findsOneWidget);
    expect(attempts, 2);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'menu do assistente oferece solicitação sem gestão privilegiada',
    (tester) async {
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
              child: HomeScreen(
                userSessionLoader: () async => const CurrentUserSession(
                  nome: 'Assistente de teste',
                  role: 'assistente',
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.drag(find.byType(ListView).first, const Offset(0, -450));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Escanear ou consultar'));
      await tester.pumpAndSettle();
      expect(find.text('Escanear ou consultar'), findsOneWidget);
      await tester.ensureVisible(find.text('Visão geral do patrimônio'));
      await tester.pumpAndSettle();
      expect(find.text('Visão geral do patrimônio'), findsOneWidget);
      expect(find.text('Movimentar bens'), findsNothing);

      await tester.ensureVisible(find.textContaining('Mais funções'));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Mais funções'));
      await tester.pumpAndSettle();

      expect(find.text('Solicitar mudança de local'), findsOneWidget);
      expect(find.text('Usuários e acessos'), findsNothing);
      expect(find.text('Integrações e API'), findsNothing);
      expect(find.text('Configurações globais'), findsNothing);
      expect(find.text('Backups automáticos'), findsNothing);
      expect(find.text('Empréstimos'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('atalhos administrativos aparecem somente para administrador', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          userSessionLoader: () async => const CurrentUserSession(
            nome: 'Admin de teste',
            role: 'administrador',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.textContaining('Mais funções'));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Mais funções'));
    await tester.pumpAndSettle();
    expect(find.text('Integrações e API'), findsOneWidget);
    expect(find.text('Configurações globais'), findsOneWidget);
    expect(find.text('Backups automáticos'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

final Map<String, dynamic> _sampleStats = {
  'totalBens': 1250,
  'totalAtivos': 1170,
  'totalManutencao': 20,
  'totalBaixados': 35,
  'totalProvisorio': 25,
  'totalVeiculos': 18,
  'valorTotal': 1234567.89,
  'emprestimosAtivos': 12,
  'emprestimosAtrasados': 2,
  'movimentacoesRecentes': [
    {
      'bem_descricao': 'Computador de mesa para atendimento',
      'de_departamento': 'Departamento de Tecnologia',
      'para_departamento': 'Unidade de Saúde',
      'responsavel': 'Pessoa de teste',
      'data_movimentacao': '2026-09-28T12:00:00.000Z',
    },
  ],
  'provisorios': [
    {
      'numero_provisorio': 'PROV-2026-001',
      'descricao': 'Equipamento provisório',
      'departamento': 'Unidade de Saúde',
    },
  ],
  'porCategoria': [
    {'categoria': 'informatica', 'quantidade': 500},
    {'categoria': 'mobiliario', 'quantidade': 300},
  ],
};
