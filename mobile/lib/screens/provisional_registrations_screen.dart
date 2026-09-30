import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/screens/create_provisional_registration_screen.dart';

class ProvisionalRegistrationsScreen extends StatefulWidget {
  const ProvisionalRegistrationsScreen({super.key});

  @override
  State<ProvisionalRegistrationsScreen> createState() =>
      _ProvisionalRegistrationsScreenState();
}

class _ProvisionalRegistrationsScreenState
    extends State<ProvisionalRegistrationsScreen> {
  final ApiService _api = ApiService();
  late Future<CurrentUserSession?> _userFuture;
  List<Map<String, dynamic>> _registrations = [];
  String _status = 'todos';
  bool _loading = true;
  String? _error;
  String? _actingOn;

  @override
  void initState() {
    super.initState();
    _userFuture = _api.getCurrentUserSession();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _api.getProvisionalRegistrations(status: _status);
      if (!mounted) return;
      setState(() {
        _registrations = data;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _act(Map<String, dynamic> item, String action) async {
    final id = item['id']?.toString();
    if (id == null) return;
    String? reason;
    if (action == 'rejeitar' || action == 'devolver') {
      reason = await _askReason(
        action == 'rejeitar' ? 'Rejeitar cadastro' : 'Devolver para ajuste',
      );
      if (reason == null) return;
    } else {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Aprovar cadastro?'),
          content: Text(
            'O cadastro ${item['codigo'] ?? ''} será convertido em bem patrimonial oficial. Essa ação altera os dados do sistema.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Aprovar'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }
    setState(() => _actingOn = id);
    try {
      await _api.updateProvisionalRegistration(
        id: id,
        action: action,
        reason: reason,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            action == 'aprovar'
                ? 'Cadastro aprovado e convertido.'
                : action == 'rejeitar'
                ? 'Cadastro rejeitado.'
                : action == 'encaminhar'
                ? 'Cadastro encaminhado para análise final.'
                : 'Cadastro devolvido para ajuste.',
          ),
        ),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      if (mounted) setState(() => _actingOn = null);
    }
  }

  Future<String?> _askReason(String title) async {
    final controller = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Motivo',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              final text = controller.text.trim();
              if (text.isNotEmpty) Navigator.pop(context, text);
            },
            child: Text(title.startsWith('Rejeitar') ? 'Rejeitar' : 'Devolver'),
          ),
        ],
      ),
    );
    controller.dispose();
    return value;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cadastros provisórios'),
        actions: [
          IconButton(
            onPressed: _load,
            tooltip: 'Atualizar',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 58,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                _filter('todos', 'Todos'),
                _filter('enviado_pela_unidade', 'Novos'),
                _filter('em_ajuste_almoxarifado', 'Em análise'),
                _filter('devolvido_para_ajuste', 'Precisam de ajuste'),
                _filter('definitivado', 'Aprovados'),
                _filter('rejeitado', 'Rejeitados'),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(_error!, textAlign: TextAlign.center),
                    ),
                  )
                : _registrations.isEmpty
                ? const Center(child: Text('Não há cadastros nesta situação.'))
                : FutureBuilder<CurrentUserSession?>(
                    future: _userFuture,
                    builder: (context, snapshot) => RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _registrations.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) =>
                            _card(_registrations[index], snapshot.data),
                      ),
                    ),
                  ),
          ),
        ],
      ),
      floatingActionButton: FutureBuilder<CurrentUserSession?>(
        future: _userFuture,
        builder: (context, snapshot) {
          if (!(snapshot.data?.role == 'assistente' &&
              snapshot.data!.hasPermission('acessarCadastrosProvisorios'))) {
            return const SizedBox.shrink();
          }
          return FloatingActionButton.extended(
            onPressed: () async {
              final created = await Navigator.push<bool>(
                context,
                MaterialPageRoute(
                  builder: (_) => const CreateProvisionalRegistrationScreen(),
                ),
              );
              if (created == true) _load();
            },
            icon: const Icon(Icons.add),
            label: const Text('Novo cadastro'),
          );
        },
      ),
    );
  }

  Widget _filter(String status, String label) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(
      label: Text(label),
      selected: _status == status,
      onSelected: (_) {
        setState(() => _status = status);
        _load();
      },
    ),
  );

  Widget _card(Map<String, dynamic> item, CurrentUserSession? user) {
    final status = item['status']?.toString() ?? '';
    final flow = item['fluxo'] is Map
        ? Map<String, dynamic>.from(item['fluxo'])
        : <String, dynamic>{};
    final pending = status != 'definitivado' && status != 'rejeitado';
    final canManage =
        user?.hasPermission('acessarCadastrosProvisorios') == true &&
        user?.role != 'assistente' &&
        pending;
    final canForward =
        canManage &&
        status == 'em_ajuste_almoxarifado' &&
        user?.hasPermission('atribuirPatrimonioDefinitivo') == true;
    final canEdit =
        user?.role == 'assistente' && status == 'devolvido_para_ajuste';
    final busy = _actingOn == item['id']?.toString();
    final localization = item['localizacao'] is Map
        ? Map<String, dynamic>.from(item['localizacao'])
        : <String, dynamic>{};
    return Card(
      child: ExpansionTile(
        title: Text(
          item['descricao']?.toString() ?? 'Bem sem descrição',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          '${item['codigo'] ?? 'Sem código'} · ${_statusLabel(status)}',
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Solicitante: ${item['solicitante']?['nome'] ?? '—'}'),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Local: ${localization['secretaria'] ?? '—'} / ${localization['departamento'] ?? '—'} / ${localization['sala'] ?? '—'}',
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Categoria: ${item['categoria'] ?? '—'} · Quantidade: ${item['quantidade'] ?? 1}',
            ),
          ),
          if (flow['motivoDevolucao']?.toString().isNotEmpty == true)
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Ajuste solicitado: ${flow['motivoDevolucao']}'),
            ),
          if (flow['motivoRejeicao']?.toString().isNotEmpty == true)
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Motivo da rejeição: ${flow['motivoRejeicao']}'),
            ),
          if (canEdit)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: busy ? null : () => _editReturned(item),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Corrigir cadastro'),
              ),
            ),
          if (canManage)
            Wrap(
              alignment: WrapAlignment.end,
              spacing: 8,
              runSpacing: 8,
              children: [
                if (canForward)
                  OutlinedButton(
                    onPressed: busy ? null : () => _act(item, 'encaminhar'),
                    child: const Text('Encaminhar para análise final'),
                  ),
                OutlinedButton(
                  onPressed: busy ? null : () => _act(item, 'devolver'),
                  child: const Text('Devolver para ajuste'),
                ),
                OutlinedButton(
                  onPressed: busy ? null : () => _act(item, 'rejeitar'),
                  child: const Text('Rejeitar'),
                ),
                FilledButton(
                  onPressed: busy ? null : () => _act(item, 'aprovar'),
                  child: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Aprovar'),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Future<void> _editReturned(Map<String, dynamic> item) async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CreateProvisionalRegistrationScreen(existing: item),
      ),
    );
    if (created == true) _load();
  }

  String _statusLabel(String status) => switch (status) {
    'enviado_pela_unidade' => 'Enviado pela unidade',
    'em_ajuste_almoxarifado' => 'Em análise',
    'devolvido_para_ajuste' => 'Precisa de ajuste',
    'definitivado' => 'Aprovado',
    'rejeitado' => 'Rejeitado',
    'rascunho' => 'Rascunho',
    _ => status.isEmpty ? 'Sem status' : status,
  };
}
