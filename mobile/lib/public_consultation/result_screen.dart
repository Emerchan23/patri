import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:sis_patrimonio_mobile/public_consultation/api_service.dart';

class ResultScreen extends StatefulWidget {
  final String code;

  const ResultScreen({super.key, required this.code});

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _data;
  String? _type;
  String? _baseUrl;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    try {
      final result = await _apiService.consultar(widget.code);
      final url = await _apiService.getServerUrl();

      if (!mounted) return;
      setState(() {
        _data = result['data'];
        _type = result['type'];
        _baseUrl = url;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _generatePdf(Map<String, dynamic> data) async {
    final pdf = pw.Document();

    if (_type == 'sala') {
      final sala = data['sala'];
      final departamento = data['departamento'];
      final secretaria = data['secretaria'];
      final List<dynamic> bens = data['bens'] ?? [];

      pdf.addPage(
        pw.Page(
          build: (pw.Context context) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Header(
                  level: 0,
                  child: pw.Text(
                    'Relatório de Bens Patrimoniais',
                    style: pw.TextStyle(
                      fontSize: 24,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                ),
                pw.SizedBox(height: 20),
                pw.Text(
                  'Localização',
                  style: pw.TextStyle(
                    fontSize: 16,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.Text(
                  'Secretaria: ${secretaria != null ? secretaria['nome'] : "N/A"}',
                ),
                pw.Text(
                  'Departamento: ${departamento != null ? departamento['nome'] : "N/A"}',
                ),
                pw.Text('Sala: ${sala['nome']}'),
                pw.SizedBox(height: 20),
                pw.Text(
                  'Total de bens: ${bens.length}',
                  style: pw.TextStyle(
                    fontSize: 14,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 10),
                pw.TableHelper.fromTextArray(
                  context: context,
                  data: <List<String>>[
                    <String>['Patrimônio', 'Descrição', 'Categoria', 'Status'],
                    ...bens.map(
                      (item) => [
                        item['patrimonio'] ??
                            item['patrimonio_provisorio'] ??
                            '-',
                        item['descricao'] ?? '-',
                        item['categoria'] ?? '-',
                        item['status'] ?? '-',
                      ],
                    ),
                  ],
                ),
                pw.Footer(
                  margin: const pw.EdgeInsets.only(top: 20),
                  title: pw.Text(
                    'Gerado em: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}',
                  ),
                ),
              ],
            );
          },
        ),
      );

      await Printing.sharePdf(
        bytes: await pdf.save(),
        filename: 'relatorio_sala_${sala['id']}.pdf',
      );
    } else if (_type == 'bem') {
      final asset = data;
      pdf.addPage(
        pw.Page(
          build: (pw.Context context) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Header(
                  level: 0,
                  child: pw.Text(
                    'Detalhes do Bem Patrimonial',
                    style: pw.TextStyle(
                      fontSize: 24,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                ),
                pw.SizedBox(height: 20),
                pw.Text(
                  'Descrição: ${asset['descricao'] ?? "N/A"}',
                  style: pw.TextStyle(
                    fontSize: 18,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.SizedBox(height: 10),
                pw.Text(
                  'Patrimônio: ${asset['patrimonio'] ?? asset['patrimonio_provisorio'] ?? "N/A"}',
                ),
                pw.Text('Categoria: ${asset['categoria'] ?? "N/A"}'),
                pw.Text('Grupo: ${asset['grupo'] ?? "N/A"}'),
                pw.Text('Marca: ${asset['marca'] ?? "N/A"}'),
                pw.Text('Modelo: ${asset['modelo'] ?? "N/A"}'),
                pw.Text('Número de série: ${asset['numero_serie'] ?? "N/A"}'),
                pw.Text('Fornecedor: ${asset['fornecedor'] ?? "N/A"}'),
                pw.Text('Status: ${asset['status'] ?? "N/A"}'),
                pw.SizedBox(height: 20),
                pw.Text(
                  'Localização',
                  style: pw.TextStyle(
                    fontSize: 16,
                    fontWeight: pw.FontWeight.bold,
                  ),
                ),
                pw.Text(_parseLocation(asset['localizacao'])),
                pw.Footer(
                  margin: const pw.EdgeInsets.only(top: 20),
                  title: pw.Text(
                    'Gerado em: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}',
                  ),
                ),
              ],
            );
          },
        ),
      );

      await Printing.sharePdf(
        bytes: await pdf.save(),
        filename: 'detalhes_bem_${asset['id']}.pdf',
      );
    }
  }

  String _parseLocation(dynamic localizacao) {
    if (localizacao == null) return 'Não informado';

    Map<String, dynamic>? map;
    if (localizacao is String) {
      try {
        map = json.decode(localizacao) as Map<String, dynamic>;
      } catch (_) {
        return localizacao;
      }
    } else if (localizacao is Map) {
      map = Map<String, dynamic>.from(localizacao);
    }

    if (map == null) return localizacao.toString();

    final sala = map['sala'] ?? 'Não informado';
    final departamento = map['departamento'] ?? 'Não informado';
    final secretaria = map['secretaria'] ?? 'Não informado';

    return 'Secretaria: $secretaria\nDepartamento: $departamento\nSala: $sala';
  }

  String _errorTitle() {
    if (_error == null) return 'Erro';
    if (_error!.contains('Não foi possível conectar') ||
        _error!.contains('Nao foi possivel conectar')) {
      return 'Servidor indisponível';
    }
    if (_error!.contains('Muitas consultas')) {
      return 'Consultas temporariamente limitadas';
    }
    if (_error!.contains('Nenhum bem ou sala')) {
      return 'Código não encontrado';
    }
    return 'Falha na consulta';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Resultado da consulta')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _buildErrorState()
          : _type == 'bem'
          ? _buildAssetDetails(_data!)
          : _buildRoomDetails(_data!),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 56, color: Colors.redAccent),
            const SizedBox(height: 16),
            Text(
              _errorTitle(),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            Text(
              _error ?? 'Erro inesperado.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Voltar para o scanner'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAssetDetails(Map<String, dynamic> asset) {
    final patrimonio =
        asset['patrimonio'] ??
        asset['patrimonio_provisorio'] ??
        'Não informado';
    final descricao = asset['descricao'] ?? 'Sem descrição';
    final status = asset['status'] ?? 'Não informado';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _headerActions(asset),
        const SizedBox(height: 8),
        if (asset['imagem'] != null && _baseUrl != null)
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Image.network(
              asset['imagem'].startsWith('http')
                  ? asset['imagem']
                  : '$_baseUrl/${asset['imagem']}',
              height: 220,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => Container(
                height: 180,
                color: Colors.grey.shade100,
                child: const Center(child: Icon(Icons.broken_image, size: 72)),
              ),
            ),
          ),
        const SizedBox(height: 16),
        _HeroCard(
          title: descricao,
          badge: status,
          subtitle: patrimonio,
          icon: Icons.inventory_2_outlined,
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Localização atual',
          icon: Icons.location_on_outlined,
          child: Text(
            _parseLocation(asset['localizacao']),
            style: const TextStyle(height: 1.5),
          ),
        ),
        const SizedBox(height: 12),
        _SectionCard(
          title: 'Detalhes complementares',
          icon: Icons.info_outline,
          child: Column(
            children: [
              _detailRow('Categoria', asset['categoria'] ?? 'Não informado'),
              _detailRow('Grupo', asset['grupo'] ?? 'Não informado'),
              _detailRow('Marca', asset['marca'] ?? 'Não informado'),
              _detailRow('Modelo', asset['modelo'] ?? 'Não informado'),
              _detailRow(
                'Número de série',
                asset['numero_serie'] ?? 'Não informado',
              ),
              _detailRow('Fornecedor', asset['fornecedor'] ?? 'Não informado'),
              _detailRow(
                'Emenda',
                asset['emenda_parlamentar'] ?? 'Não informado',
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _SectionCard(
          title: 'Observacoes',
          icon: Icons.notes_outlined,
          child: Text(
            asset['observacoes'] ?? 'Nenhuma observação registrada.',
            style: const TextStyle(height: 1.5),
          ),
        ),
      ],
    );
  }

  Widget _headerActions(Map<String, dynamic> data) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        FilledButton.icon(
          onPressed: () => _generatePdf(data),
          icon: const Icon(Icons.picture_as_pdf),
          label: const Text('PDF'),
        ),
      ],
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  Widget _buildRoomDetails(Map<String, dynamic> data) {
    final sala = data['sala'];
    final departamento = data['departamento'];
    final secretaria = data['secretaria'];
    final List<dynamic> bens = data['bens'] ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _headerActions(data),
        const SizedBox(height: 8),
        _HeroCard(
          title: sala['nome'] ?? 'Sala sem nome',
          badge: '${bens.length} bens',
          subtitle: 'Consulta por sala',
          icon: Icons.meeting_room_outlined,
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Localização consultada',
          icon: Icons.apartment_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Secretaria: ${secretaria?['nome'] ?? 'Não informado'}'),
              const SizedBox(height: 6),
              Text('Departamento: ${departamento?['nome'] ?? 'Não informado'}'),
              const SizedBox(height: 6),
              Text('Sala: ${sala['nome'] ?? 'Não informado'}'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          bens.isEmpty
              ? 'Nenhum bem encontrado nesta sala.'
              : 'Bens encontrados',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 10),
        if (bens.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.orange.shade100),
            ),
            child: const Text(
              'A sala foi localizada, mas não há bens ativos vinculados a ela no momento.',
            ),
          )
        else
          ...bens.map(
            (bem) => _RoomAssetCard(
              bem: Map<String, dynamic>.from(bem),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => Scaffold(
                      appBar: AppBar(title: const Text('Detalhes do bem')),
                      body: _buildAssetDetails(Map<String, dynamic>.from(bem)),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _HeroCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String badge;
  final IconData icon;

  const _HeroCard({
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.blue.shade600, Colors.blue.shade800],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: Colors.white),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  badge,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.92)),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: Colors.blue.shade700),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _RoomAssetCard extends StatelessWidget {
  final Map<String, dynamic> bem;
  final VoidCallback onTap;

  const _RoomAssetCard({required this.bem, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final patrimonio =
        bem['patrimonio'] ?? bem['patrimonio_provisorio'] ?? 'Não informado';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Ink(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    Icons.inventory_2_outlined,
                    color: Colors.blue.shade700,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        bem['descricao'] ?? 'Sem descricao',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(patrimonio),
                      const SizedBox(height: 6),
                      Text(
                        'Status: ${bem['status'] ?? 'Não informado'}',
                        style: TextStyle(color: Colors.grey.shade700),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
