import 'package:flutter/material.dart';
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';
import 'package:sis_patrimonio_mobile/screens/asset_details_screen.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

class RoomAssetsScreen extends StatefulWidget {
  final String roomName;
  final String roomId;

  const RoomAssetsScreen({
    super.key,
    required this.roomName,
    required this.roomId,
  });

  @override
  State<RoomAssetsScreen> createState() => _RoomAssetsScreenState();
}

class _RoomAssetsScreenState extends State<RoomAssetsScreen> {
  final ApiService _apiService = ApiService();
  late Future<List<Asset>> _assetsFuture;

  @override
  void initState() {
    super.initState();
    _loadAssets();
  }

  void _loadAssets() {
    setState(() {
      _assetsFuture = _apiService.getAssetsByRoom(widget.roomName);
    });
  }

  Future<void> _generateAndSharePdf() async {
    final assets = await _assetsFuture;
    if (!mounted) return;
    if (assets.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não há itens para gerar relatório')),
      );
      return;
    }

    final pdf = pw.Document();

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context context) {
          return [
            pw.Header(
              level: 0,
              child: pw.Text('Relatório de Bens - ${widget.roomName}'),
            ),
            pw.Paragraph(
              text:
                  'Data de geração: ${DateTime.now().toString().split('.')[0]}',
            ),
            pw.SizedBox(height: 20),
            pw.TableHelper.fromTextArray(
              context: context,
              headers: ['Patrimônio', 'Descrição', 'Status', 'Responsável'],
              data: assets
                  .map(
                    (asset) => [
                      asset.patrimonio ?? 'S/P',
                      asset.descricao,
                      asset.status,
                      asset.responsavel?.nome ?? '-',
                    ],
                  )
                  .toList(),
            ),
            pw.SizedBox(height: 20),
            pw.Paragraph(text: 'Total de itens: ${assets.length}'),
          ];
        },
      ),
    );

    // Save and Share
    try {
      final output = await getTemporaryDirectory();
      final file = File('${output.path}/relatorio_sala_${widget.roomId}.pdf');
      await file.writeAsBytes(await pdf.save());

      await Share.shareXFiles([
        XFile(file.path),
      ], text: 'Relatório de Bens - ${widget.roomName}');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Erro ao gerar PDF: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Bens na Sala', style: TextStyle(fontSize: 16)),
            Text(
              widget.roomName,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            tooltip: 'Gerar PDF',
            onPressed: _generateAndSharePdf,
          ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadAssets),
        ],
      ),
      body: FutureBuilder<List<Asset>>(
        future: _assetsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Text('Erro ao buscar bens: ${snapshot.error}'),
            );
          }

          final assets = snapshot.data ?? [];

          if (assets.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.inbox, size: 64, color: Colors.grey),
                  const SizedBox(height: 16),
                  Text(
                    'Nenhum bem encontrado na sala\n${widget.roomName}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.grey),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            itemCount: assets.length,
            padding: const EdgeInsets.all(8),
            itemBuilder: (context, index) {
              final asset = assets[index];
              return Card(
                child: ListTile(
                  leading: SizedBox(
                    width: 50,
                    height: 50,
                    child: asset.imagem != null
                        ? FutureBuilder<String?>(
                            future: _apiService.getImageUrl(asset.imagem),
                            builder: (context, snapshot) {
                              if (snapshot.hasData && snapshot.data != null) {
                                return ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: Image.network(
                                    snapshot.data!,
                                    fit: BoxFit.cover,
                                  ),
                                );
                              }
                              return const CircleAvatar(
                                child: Icon(Icons.inventory_2),
                              );
                            },
                          )
                        : const CircleAvatar(child: Icon(Icons.inventory_2)),
                  ),
                  title: Text(
                    asset.descricao,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    '${asset.patrimonio ?? "S/P"} • ${asset.grupo ?? "Geral"}',
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => AssetDetailsScreen(
                          patrimonyCode: asset.patrimonio ?? '',
                        ),
                      ),
                    ).then((_) => _loadAssets()); // Reload when returning
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }
}
