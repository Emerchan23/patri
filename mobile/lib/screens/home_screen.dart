import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/screens/assets_list_screen.dart';
import 'package:sis_patrimonio_mobile/screens/create_asset_screen.dart';
import 'package:sis_patrimonio_mobile/screens/movement_scan_screen.dart';
import 'package:sis_patrimonio_mobile/screens/movement_requests_screen.dart';
import 'package:sis_patrimonio_mobile/screens/provisional_registrations_screen.dart';
import 'package:sis_patrimonio_mobile/screens/loans_screen.dart';
import 'package:sis_patrimonio_mobile/screens/vehicles_screen.dart';
import 'package:sis_patrimonio_mobile/screens/notifications_screen.dart';
import 'package:sis_patrimonio_mobile/screens/reports_screen.dart';
import 'package:sis_patrimonio_mobile/screens/dashboard_screen.dart';
import 'package:sis_patrimonio_mobile/screens/pending_assets_screen.dart';
import 'package:sis_patrimonio_mobile/screens/alienations_screen.dart';
import 'package:sis_patrimonio_mobile/screens/audit_logs_screen.dart';
import 'package:sis_patrimonio_mobile/screens/provisional_labels_screen.dart';
import 'package:sis_patrimonio_mobile/screens/users_admin_screen.dart';
import 'package:sis_patrimonio_mobile/screens/api_keys_screen.dart';
import 'package:sis_patrimonio_mobile/screens/system_admin_settings_screen.dart';
import 'package:sis_patrimonio_mobile/screens/backup_admin_screen.dart';
import 'package:sis_patrimonio_mobile/screens/auxiliary_catalogs_screen.dart';
import 'package:sis_patrimonio_mobile/screens/nfe_batch_screen.dart';
import 'package:sis_patrimonio_mobile/screens/scanner_screen.dart';
import 'package:sis_patrimonio_mobile/screens/settings_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/public_consultation/home_screen.dart'
    as viewer;

class HomeScreen extends StatefulWidget {
  final Future<CurrentUserSession?> Function()? userSessionLoader;

  const HomeScreen({super.key, this.userSessionLoader});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ApiService _api = ApiService();
  late Future<CurrentUserSession?> _userFuture;

  @override
  void initState() {
    super.initState();
    _userFuture = _loadUserSession();
  }

  Future<CurrentUserSession?> _loadUserSession() =>
      widget.userSessionLoader?.call() ?? _api.getCurrentUserSession();

  @override
  Widget build(BuildContext context) {
    const accentColor = Color(0xFF0F172A);

    return Scaffold(
      appBar: AppBar(
        title: const Text('SisPatrimônio'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none),
            tooltip: 'Notificações',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const NotificationsScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            tooltip: 'Consulta rápida',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const viewer.HomeScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          setState(() {
            _userFuture = _loadUserSession();
          });
          await _userFuture;
        },
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: accentColor,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Patrimônio na palma da mão',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Acesse rapidamente as principais funções do aplicativo.',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  FutureBuilder<CurrentUserSession?>(
                    future: _userFuture,
                    builder: (context, snapshot) {
                      final user = snapshot.data;
                      return Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.12),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?.nome.isNotEmpty == true
                                  ? user!.nome
                                  : 'Usuario conectado',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _buildScopeSummary(user),
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 13,
                                height: 1.3,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Ações principais',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            FutureBuilder<CurrentUserSession?>(
              future: _userFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }

                final user = snapshot.data;
                if (user == null) {
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Não consegui carregar seu perfil e permissões.',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          TextButton.icon(
                            onPressed: () => setState(
                              () => _userFuture = _loadUserSession(),
                            ),
                            icon: const Icon(Icons.refresh),
                            label: const Text('Tentar novamente'),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                final actions = <_ActionCard>[];
                void addAction(_ActionCard action) {
                  actions.add(action);
                }

                if (user.hasPermission('registrarMovimentacao')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.drive_file_move_outline,
                      title: 'Movimentar bens',
                      subtitle:
                          'Escaneie um ou vários bens e escolha o destino uma só vez.',
                      accentColor: const Color(0xFF6D28D9),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const MovementScanScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('acessarMovimentacoes')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.fact_check_outlined,
                      title: 'Solicitações de movimentação',
                      subtitle: user.hasPermission('aprovarMovimentacao')
                          ? 'Revise pedidos da unidade e aprove ou rejeite.'
                          : 'Acompanhe o andamento dos pedidos enviados.',
                      accentColor: const Color(0xFFB45309),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const MovementRequestsScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.role == 'assistente' &&
                    user.hasPermission('acessarMovimentacoes') &&
                    user.hasPermission('verBensUnidade')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.outgoing_mail,
                      title: 'Solicitar mudança de local',
                      subtitle:
                          'Selecione bens da sua unidade e envie o pedido ao gestor.',
                      accentColor: const Color(0xFF0F766E),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              const AssetsListScreen(selectForRequest: true),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('acessarCadastrosProvisorios')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.assignment_outlined,
                      title: 'Cadastros provisórios',
                      subtitle: user.role == 'assistente'
                          ? 'Envie bens da unidade e acompanhe ajustes e aprovação.'
                          : 'Confira cadastros recebidos e aprove, rejeite ou devolva para ajuste.',
                      accentColor: const Color(0xFF0369A1),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              const ProvisionalRegistrationsScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('usarScanner')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.qr_code_scanner,
                      title: 'Escanear ou consultar',
                      subtitle:
                          'Leia um código para localizar o bem e abrir seus detalhes.',
                      accentColor: accentColor,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ScannerScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('verTodosBens') ||
                    user.hasPermission('verBensUnidade')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.list_alt,
                      title: 'Consultar bens',
                      subtitle:
                          'Busque patrimônios, confira a localização e abra os detalhes.',
                      accentColor: const Color(0xFF1D4ED8),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AssetsListScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('registrarMovimentacao')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.checklist,
                      title: 'Selecionar bens da lista',
                      subtitle:
                          'Monte uma transferência pela busca, sem usar a câmera.',
                      accentColor: const Color(0xFF7C3AED),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              const AssetsListScreen(selectForMovement: true),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('cadastrarBem')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.receipt_long_outlined,
                      title: 'Entrada por nota fiscal',
                      subtitle:
                          'Importe o XML, revise os itens e cadastre vários bens de uma vez.',
                      accentColor: const Color(0xFF047857),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const NfeBatchScreen(),
                        ),
                      ),
                    ),
                  );
                  addAction(
                    _ActionCard(
                      icon: Icons.add_box_outlined,
                      title: 'Cadastrar novo bem',
                      subtitle:
                          'Registre um bem pelo celular com as informações essenciais.',
                      accentColor: const Color(0xFF0F766E),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const CreateAssetScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('gerenciarEmprestimos')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.handshake_outlined,
                      title: 'Empréstimos',
                      subtitle:
                          'Registre empréstimos, confira prazos e dê baixa na devolução.',
                      accentColor: const Color(0xFFBE123C),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const LoansScreen()),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('verVeiculos')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.directions_car_outlined,
                      title: 'Veículos',
                      subtitle:
                          'Consulte veículos, placa, localização e situação do bem.',
                      accentColor: const Color(0xFF334155),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const VehiclesScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('verRelatorios')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.analytics_outlined,
                      title: 'Relatórios',
                      subtitle:
                          'Consulte patrimônio, movimentações, empréstimos e baixas.',
                      accentColor: const Color(0xFF4F46E5),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ReportsScreen(),
                        ),
                      ),
                    ),
                  );
                }

                final canViewGeneralDashboard = user.hasPermission(
                  'verDashboardGeral',
                );
                final canViewUnitDashboard = user.hasPermission(
                  'verDashboardUnidade',
                );
                if (canViewGeneralDashboard || canViewUnitDashboard) {
                  addAction(
                    _ActionCard(
                      icon: Icons.space_dashboard_outlined,
                      title: 'Visão geral do patrimônio',
                      subtitle:
                          'Veja totais, valor, empréstimos e movimentações recentes.',
                      accentColor: const Color(0xFF0E7490),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => DashboardScreen(
                            unitOnly: !canViewGeneralDashboard,
                          ),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('verPendenciasPatrimonio')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.warning_amber_outlined,
                      title: 'Pendências patrimoniais',
                      subtitle:
                          'Veja etiquetas, localização, conservação e empréstimos atrasados.',
                      accentColor: const Color(0xFFB45309),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const PendingAssetsScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('gerenciarAlienacoes')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.gavel_outlined,
                      title: 'Alienações',
                      subtitle:
                          'Consulte processos, bens vinculados e comissão responsável.',
                      accentColor: const Color(0xFF7C2D12),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AlienationsScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('gerenciarCadastrosAuxiliares')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.category_outlined,
                      title: 'Cadastros auxiliares',
                      subtitle:
                          'Consulte fornecedores e gerencie categorias, marcas e locais.',
                      accentColor: const Color(0xFF0F766E),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AuxiliaryCatalogsScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.hasPermission('gerarEtiquetas')) {
                  addAction(
                    _ActionCard(
                      icon: Icons.label_outline,
                      title: 'Etiquetas provisórias',
                      subtitle:
                          'Reserve lotes, gere PDF com QR e libere saldo não utilizado.',
                      accentColor: const Color(0xFF0369A1),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ProvisionalLabelsScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (user.role == 'administrador') {
                  addAction(
                    _ActionCard(
                      icon: Icons.backup_outlined,
                      title: 'Backups automáticos',
                      subtitle:
                          'Consulte arquivos e configure a rotina de proteção dos dados.',
                      accentColor: const Color(0xFFB45309),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const BackupAdminScreen(),
                        ),
                      ),
                    ),
                  );
                  addAction(
                    _ActionCard(
                      icon: Icons.tune_outlined,
                      title: 'Configurações globais',
                      subtitle:
                          'Defina cores, links e validade das sessões do sistema.',
                      accentColor: const Color(0xFF7C3AED),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const SystemAdminSettingsScreen(),
                        ),
                      ),
                    ),
                  );
                  addAction(
                    _ActionCard(
                      icon: Icons.key_outlined,
                      title: 'Integrações e API',
                      subtitle: 'Crie e revogue chaves para sistemas externos.',
                      accentColor: const Color(0xFF0F766E),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ApiKeysScreen(),
                        ),
                      ),
                    ),
                  );
                  addAction(
                    _ActionCard(
                      icon: Icons.manage_accounts_outlined,
                      title: 'Usuários e acessos',
                      subtitle:
                          'Gerencie perfis, unidades e acesso ao aplicativo.',
                      accentColor: const Color(0xFF4338CA),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const UsersAdminScreen(),
                        ),
                      ),
                    ),
                  );
                  addAction(
                    _ActionCard(
                      icon: Icons.history,
                      title: 'Histórico de auditoria',
                      subtitle:
                          'Consulte registros recentes de ações do sistema.',
                      accentColor: const Color(0xFF475569),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AuditLogsScreen(),
                        ),
                      ),
                    ),
                  );
                }

                if (actions.isEmpty) {
                  return const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text(
                        'Seu perfil não tem ações móveis habilitadas. Consulte o administrador do sistema.',
                      ),
                    ),
                  );
                }
                const priority = {
                  'Movimentar bens': 0,
                  'Escanear ou consultar': 1,
                  'Visão geral do patrimônio': 2,
                  'Consultar bens': 3,
                  'Solicitar mudança de local': 4,
                };
                actions.sort((a, b) {
                  return (priority[a.title] ?? 10).compareTo(
                    priority[b.title] ?? 10,
                  );
                });
                final quickActions = actions.take(3).toList();
                final moreActions = actions.skip(3).toList();
                return Column(
                  children: [
                    ...quickActions,
                    if (moreActions.isNotEmpty)
                      Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                          side: BorderSide(color: Colors.grey.shade200),
                        ),
                        child: ExpansionTile(
                          title: Text('Mais funções (${moreActions.length})'),
                          subtitle: const Text(
                            'Gestão, relatórios e tarefas adicionais',
                          ),
                          leading: const Icon(Icons.apps),
                          childrenPadding: const EdgeInsets.fromLTRB(
                            12,
                            0,
                            12,
                            12,
                          ),
                          children: moreActions,
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  String _buildScopeSummary(CurrentUserSession? user) {
    if (user == null) {
      return 'Os dados mostrados aqui seguem o escopo de acesso do seu usuário.';
    }

    final locationParts = <String>[
      if (user.secretaria != null && user.secretaria!.isNotEmpty)
        user.secretaria!,
      if (user.departamento != null && user.departamento!.isNotEmpty)
        user.departamento!,
    ];

    if (locationParts.isEmpty) {
      return 'Os dados mostrados aqui seguem o escopo do seu usuário no sistema.';
    }

    return 'Escopo atual: ${locationParts.join(' • ')}. Os dados mostrados seguem esse vínculo.';
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color accentColor;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accentColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Container(
                height: 52,
                width: 52,
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: accentColor),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.35,
                        color: Colors.grey.shade700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              const Icon(Icons.arrow_forward_ios, size: 16),
            ],
          ),
        ),
      ),
    );
  }
}
