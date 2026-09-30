import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class UsersAdminScreen extends StatefulWidget {
  final ApiService? apiService;

  const UsersAdminScreen({super.key, this.apiService});

  @override
  State<UsersAdminScreen> createState() => _UsersAdminScreenState();
}

class _UsersAdminScreenState extends State<UsersAdminScreen> {
  late final ApiService _api;
  final _search = TextEditingController();
  List<Map<String, dynamic>> _users = [];
  List<Map<String, dynamic>> _secretarias = [];
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String _currentUserId = '';

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? ApiService();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await Future.wait<dynamic>([
        _api.getUsers(),
        _api.getSecretarias(forceRefresh: true),
        _api.getCurrentUserSession(),
      ]);
      if (!mounted) return;
      setState(() {
        _users = result[0];
        _secretarias = result[1];
        _currentUserId = (result[2] as CurrentUserSession?)?.id ?? '';
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

  Future<void> _edit([Map<String, dynamic>? user]) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _UserForm(user: user, secretarias: _secretarias),
    );
    if (result == null) return;
    setState(() => _busy = true);
    try {
      await _api.saveUser(id: user?['id']?.toString(), data: result);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Usuário salvo.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggle(Map<String, dynamic> user) async {
    final wasActive = user['ativo'] == true;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(wasActive ? 'Desativar acesso?' : 'Reativar acesso?'),
        content: Text(
          '${user['nome']} não poderá entrar no sistema enquanto estiver inativo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(wasActive ? 'Desativar' : 'Reativar'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await _api.setUserActive(id: user['id'].toString(), active: !wasActive);
      await _load();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete(Map<String, dynamic> user) async {
    final name = user['nome']?.toString() ?? '';
    final accepted = await showDialog<bool>(
      context: context,
      builder: (_) => _DeleteUserConfirmationDialog(name: name),
    );
    if (accepted != true) return;
    setState(() => _busy = true);
    try {
      await _api.deleteUser(user['id'].toString());
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$name foi excluído.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _search.text.toLowerCase();
    final users = _users
        .where(
          (u) => '${u['nome']} ${u['email']} ${u['cargo']}'
              .toLowerCase()
              .contains(query),
        )
        .toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Usuários e acessos'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : () => _edit(),
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('Novo usuário'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Tentar novamente'),
                    ),
                  ],
                ),
              ),
            )
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Buscar nome, e-mail ou cargo',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _load,
                    child: users.isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 120),
                              Center(child: Text('Nenhum usuário encontrado.')),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(12, 0, 12, 100),
                            itemCount: users.length,
                            itemBuilder: (context, index) {
                              final user = users[index];
                              final active = user['ativo'] == true;
                              final unit = user['unidade'] is Map
                                  ? (user['unidade'] as Map)['secretaria']
                                        ?.toString()
                                  : null;
                              return Card(
                                child: ListTile(
                                  leading: CircleAvatar(
                                    child: Text(
                                      (user['nome']?.toString().isNotEmpty ==
                                                  true
                                              ? user['nome'].toString()[0]
                                              : '?')
                                          .toUpperCase(),
                                    ),
                                  ),
                                  title: Text(
                                    user['nome']?.toString() ?? 'Sem nome',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  subtitle: Text(
                                    '${user['email'] ?? ''}\n${user['cargo'] ?? ''} · ${user['role'] ?? ''}${unit == null ? '' : '\n$unit'}\n${active ? 'Ativo' : 'Inativo'} · app ${user['acessoApp'] == true ? 'permitido' : 'bloqueado'}',
                                  ),
                                  isThreeLine: true,
                                  trailing: PopupMenuButton<String>(
                                    onSelected: (value) {
                                      if (value == 'edit') _edit(user);
                                      if (value == 'toggle') _toggle(user);
                                      if (value == 'delete') _delete(user);
                                    },
                                    itemBuilder: (_) => [
                                      const PopupMenuItem(
                                        value: 'edit',
                                        child: Text('Editar'),
                                      ),
                                      if (user['id']?.toString() !=
                                          _currentUserId)
                                        PopupMenuItem(
                                          value: 'toggle',
                                          child: Text(
                                            active ? 'Desativar' : 'Reativar',
                                          ),
                                        ),
                                      if (user['id']?.toString() !=
                                          _currentUserId)
                                        const PopupMenuItem(
                                          value: 'delete',
                                          child: Text('Excluir'),
                                        ),
                                    ],
                                  ),
                                  onTap: () => _edit(user),
                                ),
                              );
                            },
                          ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _DeleteUserConfirmationDialog extends StatefulWidget {
  const _DeleteUserConfirmationDialog({required this.name});

  final String name;

  @override
  State<_DeleteUserConfirmationDialog> createState() =>
      _DeleteUserConfirmationDialogState();
}

class _DeleteUserConfirmationDialogState
    extends State<_DeleteUserConfirmationDialog> {
  final TextEditingController _confirmation = TextEditingController();

  @override
  void dispose() {
    _confirmation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Excluir usuário permanentemente?'),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Esta ação removerá ${widget.name} e não poderá ser desfeita.'),
        const SizedBox(height: 12),
        TextField(
          controller: _confirmation,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(
            labelText: 'Digite o nome para confirmar',
            border: OutlineInputBorder(),
          ),
        ),
      ],
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context, false),
        child: const Text('Cancelar'),
      ),
      FilledButton(
        onPressed: _confirmation.text.trim() == widget.name
            ? () => Navigator.pop(context, true)
            : null,
        child: const Text('Excluir usuário'),
      ),
    ],
  );
}

class _UserForm extends StatefulWidget {
  const _UserForm({required this.secretarias, this.user});
  final List<Map<String, dynamic>> secretarias;
  final Map<String, dynamic>? user;
  @override
  State<_UserForm> createState() => _UserFormState();
}

class _UserFormState extends State<_UserForm> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(
    text: widget.user?['nome']?.toString(),
  );
  late final _email = TextEditingController(
    text: widget.user?['email']?.toString(),
  );
  late final _job = TextEditingController(
    text: widget.user?['cargo']?.toString(),
  );
  final _password = TextEditingController();
  late String _role = widget.user?['role']?.toString() ?? 'assistente';
  late bool _appAccess = widget.user?['acessoApp'] == true;
  late bool _canCreateAsset = widget.user?['podeCadastrarBem'] == true;
  late bool _canCreateProvisional =
      widget.user?['podeCadastroProvisorioUnidade'] == true;
  late String? _secretary = (widget.user?['unidade'] as Map?)?['secretaria']
      ?.toString();
  late final Set<String> _departments =
      ((widget.user?['unidade'] as Map?)?['departamentos'] as List? ?? [])
          .map((e) => e.toString())
          .toSet();
  late final Set<String> _managedSecretaries =
      (widget.user?['secretariasGerenciadas'] as List? ?? [])
          .map((e) => e.toString())
          .toSet();

  List<Map<String, dynamic>> get _departmentsForSecretary =>
      widget.secretarias.firstWhere(
            (s) => s['nome'] == _secretary,
            orElse: () => const {},
          )['departamentos']
          is List
      ? List<Map<String, dynamic>>.from(
          widget.secretarias.firstWhere(
                (s) => s['nome'] == _secretary,
              )['departamentos']
              as List,
        )
      : const [];

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _job.dispose();
    _password.dispose();
    super.dispose();
  }

  void _save() {
    if (!_form.currentState!.validate()) return;
    final deps = _departments.toList();
    Navigator.pop(context, {
      'nome': _name.text.trim(),
      'email': _email.text.trim(),
      'cargo': _job.text.trim(),
      'role': _role,
      'senha': _password.text.isEmpty ? null : _password.text,
      'acessoApp': _appAccess,
      'secretaria': _role == 'assistente' ? _secretary : null,
      'departamentosAssistente': _role == 'assistente' ? deps : <String>[],
      'secretariasGerenciadas': _role == 'gestor'
          ? _managedSecretaries.toList()
          : <String>[],
      'podeCadastrarBem': _role == 'assistente' ? _canCreateAsset : null,
      'podeCadastroProvisorioUnidade': _role == 'assistente'
          ? _canCreateProvisional
          : null,
    });
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.user != null;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Form(
        key: _form,
        child: ListView(
          shrinkWrap: true,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    editing ? 'Editar usuário' : 'Novo usuário',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Nome completo *'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Informe o nome' : null,
            ),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'E-mail *'),
              validator: (v) => v == null || !v.contains('@')
                  ? 'Informe um e-mail válido'
                  : null,
            ),
            TextFormField(
              controller: _job,
              decoration: const InputDecoration(labelText: 'Cargo *'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Informe o cargo' : null,
            ),
            TextFormField(
              controller: _password,
              obscureText: true,
              decoration: InputDecoration(
                labelText: editing
                    ? 'Nova senha (opcional)'
                    : 'Senha inicial *',
              ),
              validator: (v) => !editing && (v == null || v.length < 8)
                  ? 'Use pelo menos 8 caracteres'
                  : null,
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: _role,
              decoration: const InputDecoration(labelText: 'Perfil'),
              items: const [
                DropdownMenuItem(
                  value: 'administrador',
                  child: Text('Administrador'),
                ),
                DropdownMenuItem(value: 'gestor', child: Text('Gestor')),
                DropdownMenuItem(
                  value: 'assistente',
                  child: Text('Assistente'),
                ),
              ],
              onChanged: (v) => setState(() => _role = v ?? 'assistente'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Permitir acesso ao app'),
              value: _appAccess,
              onChanged: (v) => setState(() => _appAccess = v),
            ),
            if (_role == 'assistente') ...[
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue:
                    widget.secretarias.any((s) => s['nome'] == _secretary)
                    ? _secretary
                    : null,
                decoration: const InputDecoration(labelText: 'Secretaria'),
                items: widget.secretarias
                    .map(
                      (s) => DropdownMenuItem(
                        value: s['nome']?.toString(),
                        child: Text(
                          s['nome']?.toString() ?? '',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() {
                  _secretary = v;
                  _departments.clear();
                }),
              ),
              if (_secretary != null) ...[
                const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text('Departamentos permitidos'),
                ),
                ..._departmentsForSecretary.map((dep) {
                  final name = dep['nome']?.toString() ?? '';
                  return CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(name),
                    value: _departments.contains(name),
                    onChanged: (v) => setState(() {
                      v == true
                          ? _departments.add(name)
                          : _departments.remove(name);
                    }),
                  );
                }),
              ],
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Pode cadastrar bens'),
                value: _canCreateAsset,
                onChanged: (v) => setState(() => _canCreateAsset = v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Pode cadastrar bens provisórios da unidade'),
                value: _canCreateProvisional,
                onChanged: (v) => setState(() => _canCreateProvisional = v),
              ),
            ],
            if (_role == 'gestor') ...[
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text('Secretarias gerenciadas'),
              ),
              ...widget.secretarias.map((s) {
                final name = s['nome']?.toString() ?? '';
                return CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(name),
                  value: _managedSecretaries.contains(name),
                  onChanged: (v) => setState(() {
                    v == true
                        ? _managedSecretaries.add(name)
                        : _managedSecretaries.remove(name);
                  }),
                );
              }),
            ],
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.save_outlined),
              label: const Text('Salvar usuário'),
            ),
          ],
        ),
      ),
    );
  }
}
