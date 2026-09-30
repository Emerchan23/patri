import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:sis_patrimonio_mobile/screens/loans_screen.dart';
import 'package:sis_patrimonio_mobile/screens/movement_requests_screen.dart';
import 'package:sis_patrimonio_mobile/screens/provisional_registrations_screen.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final ApiService _api = ApiService();
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = true;
  bool _markingAll = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final notifications = await _api.getNotifications();
      if (!mounted) return;
      setState(() {
        _notifications = notifications;
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

  Future<void> _markAllRead() async {
    setState(() => _markingAll = true);
    try {
      await _api.markAllNotificationsRead();
      if (!mounted) return;
      setState(() {
        _notifications = _notifications
            .map((item) => {...item, 'lida': true})
            .toList();
      });
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  Future<void> _openNotification(Map<String, dynamic> item) async {
    final id = item['id']?.toString();
    if (item['lida'] != true && id != null) {
      try {
        await _api.markNotificationRead(id);
        if (!mounted) return;
        setState(() {
          _notifications = _notifications
              .map(
                (notification) => notification['id']?.toString() == id
                    ? {...notification, 'lida': true}
                    : notification,
              )
              .toList();
        });
      } catch (error) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(error.toString().replaceFirst('Exception: ', '')),
          ),
        );
      }
    }
    if (!mounted) return;
    final link = item['link']?.toString() ?? '';
    final Widget? destination = link.contains('moviment')
        ? const MovementRequestsScreen()
        : link.contains('provisor')
        ? const ProvisionalRegistrationsScreen()
        : link.contains('emprest')
        ? const LoansScreen()
        : null;
    if (destination != null) {
      await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => destination),
      );
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Notificações'),
      actions: [
        IconButton(
          onPressed: _load,
          tooltip: 'Atualizar',
          icon: const Icon(Icons.refresh),
        ),
        IconButton(
          onPressed:
              _markingAll || !_notifications.any((item) => item['lida'] != true)
              ? null
              : _markAllRead,
          tooltip: 'Marcar todas como lidas',
          icon: _markingAll
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.done_all),
        ),
      ],
    ),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(_error!, textAlign: TextAlign.center),
            ),
          )
        : _notifications.isEmpty
        ? const Center(child: Text('Você está em dia. Não há notificações.'))
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: _notifications.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) =>
                  _notificationTile(_notifications[index]),
            ),
          ),
  );

  Widget _notificationTile(Map<String, dynamic> item) {
    final unread = item['lida'] != true;
    final created = _formatDate(item['criadoEm']);
    final color = switch (item['tipo']?.toString()) {
      'error' => Colors.red,
      'warning' => Colors.deepOrange,
      'success' => Colors.green,
      _ => Colors.blue,
    };
    return Card(
      color: unread
          ? Theme.of(
              context,
            ).colorScheme.primaryContainer.withValues(alpha: 0.35)
          : null,
      child: ListTile(
        onTap: () => _openNotification(item),
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.13),
          child: Icon(
            unread
                ? Icons.notifications_active_outlined
                : Icons.notifications_none,
            color: color,
          ),
        ),
        title: Text(
          item['titulo']?.toString() ?? 'Notificação',
          style: TextStyle(
            fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item['mensagem']?.toString() ?? ''),
              if (created.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  created,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                ),
              ],
            ],
          ),
        ),
        trailing: unread
            ? const Icon(Icons.circle, size: 10, color: Colors.blue)
            : null,
      ),
    );
  }

  String _formatDate(dynamic value) {
    if (value == null) return '';
    try {
      return DateFormat(
        'dd/MM/yyyy HH:mm',
      ).format(DateTime.parse(value.toString()).toLocal());
    } catch (_) {
      return value.toString();
    }
  }
}
