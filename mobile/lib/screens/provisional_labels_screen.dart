import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:sis_patrimonio_mobile/services/api_service.dart';

typedef PdfSaveCallback =
    Future<String?> Function({
      required Uint8List bytes,
      required String filename,
    });

class ProvisionalLabelsScreen extends StatefulWidget {
  const ProvisionalLabelsScreen({super.key, this.apiService, this.savePdf});

  final ApiService? apiService;
  final PdfSaveCallback? savePdf;

  @override
  State<ProvisionalLabelsScreen> createState() =>
      _ProvisionalLabelsScreenState();
}

class _ProvisionalLabelsScreenState extends State<ProvisionalLabelsScreen> {
  late final ApiService _api;
  late final PdfSaveCallback _savePdf;
  List<Map<String, dynamic>> _lots = [];
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? ApiService();
    _savePdf = widget.savePdf ?? _savePdfToDevice;
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final lots = await _api.getProvisionalLabelLots();
      if (!mounted) return;
      setState(() {
        _lots = lots;
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

  Future<void> _reserve() async {
    final formKey = GlobalKey<FormState>();
    final quantity = TextEditingController(text: '10');
    final rangeStart = TextEditingController();
    final rangeEnd = TextEditingController();
    final note = TextEditingController();
    final amendment = TextEditingController();
    var manualRange = false;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Reservar etiquetas'),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: false, label: Text('Automática')),
                      ButtonSegment(value: true, label: Text('Faixa manual')),
                    ],
                    selected: {manualRange},
                    onSelectionChanged: (selection) =>
                        setDialogState(() => manualRange = selection.first),
                  ),
                  if (manualRange) ...[
                    TextFormField(
                      controller: rangeStart,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Número inicial',
                      ),
                      validator: (value) {
                        if (!manualRange) return null;
                        final number = int.tryParse(value ?? '');
                        return number == null || number < 1
                            ? 'Informe um número inicial válido'
                            : null;
                      },
                    ),
                    TextFormField(
                      controller: rangeEnd,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Número final',
                      ),
                      validator: (value) {
                        if (!manualRange) return null;
                        final start = int.tryParse(rangeStart.text);
                        final end = int.tryParse(value ?? '');
                        if (start == null || end == null || end < start) {
                          return 'O número final precisa ser igual ou maior que o inicial';
                        }
                        return end - start >= 500
                            ? 'A faixa deve ter no máximo 500 etiquetas'
                            : null;
                      },
                    ),
                  ] else
                    TextFormField(
                      controller: quantity,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Quantidade',
                      ),
                      validator: (value) {
                        if (manualRange) return null;
                        final number = int.tryParse(value ?? '');
                        return number == null || number < 1 || number > 500
                            ? 'Informe de 1 a 500 etiquetas'
                            : null;
                      },
                    ),
                  TextField(
                    controller: note,
                    decoration: const InputDecoration(
                      labelText: 'Observação (opcional)',
                    ),
                  ),
                  TextField(
                    controller: amendment,
                    decoration: const InputDecoration(
                      labelText: 'Emenda parlamentar (opcional)',
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('A reserva grava um novo lote no sistema.'),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  Navigator.pop(context, true);
                }
              },
              child: const Text('Reservar'),
            ),
          ],
        ),
      ),
    );
    if (accepted != true) return;
    setState(() => _busy = true);
    try {
      final result = await _api.reserveProvisionalLabels(
        quantity: manualRange
            ? int.parse(rangeEnd.text) - int.parse(rangeStart.text) + 1
            : int.parse(quantity.text),
        year: DateTime.now().year,
        startSequence: manualRange ? int.parse(rangeStart.text) : null,
        endSequence: manualRange ? int.parse(rangeEnd.text) : null,
        observation: note.text.trim().isEmpty ? null : note.text.trim(),
        parliamentaryAmendment: amendment.text.trim().isEmpty
            ? null
            : amendment.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${result['count'] ?? (manualRange ? int.parse(rangeEnd.text) - int.parse(rangeStart.text) + 1 : quantity.text)} etiquetas reservadas. Lote #${result['loteId']}.',
          ),
        ),
      );
      await _load();
    } catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<String?> _savePdfToDevice({
    required Uint8List bytes,
    required String filename,
  }) => FilePicker.saveFile(
    dialogTitle: 'Salvar etiquetas em PDF',
    fileName: filename,
    type: FileType.custom,
    allowedExtensions: const ['pdf'],
    bytes: bytes,
  );

  Future<void> _saveLotPdf(Map<String, dynamic> lot) async {
    final id = lot['id']?.toString();
    if (id == null) return;
    setState(() => _busy = true);
    try {
      final labels = await _api.getProvisionalLotLabels(id);
      if (labels.isEmpty) {
        throw Exception(
          'Este lote não possui etiquetas pendentes para gerar o PDF.',
        );
      }
      final savedPath = await _savePdf(
        bytes: await _buildPdf(labels),
        filename: 'etiquetas-lote-$id.pdf',
      );
      if (savedPath != null && mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('PDF salvo com sucesso.')));
      }
    } catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancelLot(Map<String, dynamic> lot) async {
    final id = lot['id']?.toString();
    if (id == null) return;
    final approved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Liberar saldo do lote?'),
        content: Text(
          'As etiquetas ainda não usadas do lote #$id ficarão disponíveis para reutilização. O histórico será mantido.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Voltar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Liberar saldo'),
          ),
        ],
      ),
    );
    if (approved != true) return;
    setState(() => _busy = true);
    try {
      await _api.cancelProvisionalLabelLot(id);
      await _load();
    } catch (error) {
      if (mounted) _showError(error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<Uint8List> _buildPdf(List<Map<String, dynamic>> labels) async {
    final document = pw.Document();
    final regularFont = pw.Font.ttf(
      await rootBundle.load('assets/fonts/Roboto-Regular.ttf'),
    );
    final mediumFont = pw.Font.ttf(
      await rootBundle.load('assets/fonts/Roboto-Medium.ttf'),
    );
    const perPage = 24;
    for (var start = 0; start < labels.length; start += perPage) {
      final pageLabels = labels.skip(start).take(perPage).toList();
      document.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(18),
          build: (context) => pw.GridView(
            crossAxisCount: 3,
            childAspectRatio: 2.05,
            children: pageLabels.map((label) {
              final code = label['codigo']?.toString() ?? '';
              return pw.Container(
                margin: const pw.EdgeInsets.all(4),
                padding: const pw.EdgeInsets.all(6),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(color: PdfColors.grey600),
                ),
                child: pw.Row(
                  children: [
                    pw.BarcodeWidget(
                      barcode: pw.Barcode.qrCode(),
                      data: code,
                      drawText: false,
                      width: 35,
                      height: 35,
                    ),
                    pw.SizedBox(width: 6),
                    pw.Expanded(
                      child: pw.Column(
                        mainAxisAlignment: pw.MainAxisAlignment.center,
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            'PATRIMÔNIO PROVISÓRIO',
                            style: pw.TextStyle(
                              font: regularFont,
                              fontSize: 5,
                              color: PdfColors.grey700,
                            ),
                          ),
                          pw.SizedBox(height: 3),
                          pw.Text(
                            code,
                            style: pw.TextStyle(font: mediumFont, fontSize: 8),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      );
    }
    return document.save();
  }

  void _showError(Object error) => ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(error.toString().replaceFirst('Exception: ', ''))),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Etiquetas provisórias'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: SizedBox(
            height: 52,
            child: FilledButton.icon(
              onPressed: _busy ? null : _reserve,
              icon: const Icon(Icons.add),
              label: const Text('Reservar lote'),
            ),
          ),
        ),
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
                    FilledButton.icon(
                      onPressed: _load,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Tentar novamente'),
                    ),
                  ],
                ),
              ),
            )
          : _lots.isEmpty
          ? const Center(child: Text('Nenhum lote de etiquetas encontrado.'))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                itemCount: _lots.length,
                itemBuilder: (context, index) {
                  final lot = _lots[index];
                  final id = lot['id']?.toString() ?? '?';
                  final initial = lot['faixa_inicial']?.toString() ?? '';
                  final finalCode = lot['faixa_final']?.toString() ?? '';
                  final pending = lot['pendentes'] ?? 0;
                  final pendingCount = pending is num
                      ? pending.toInt()
                      : int.tryParse('$pending') ?? 0;
                  final quantityCount =
                      int.tryParse('${lot['quantidade']}') ?? 0;
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Lote #$id · ${lot['status'] ?? 'sem status'}',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '$quantityCount ${quantityCount == 1 ? 'etiqueta' : 'etiquetas'} · '
                            '$pendingCount ${pendingCount == 1 ? 'pendente' : 'pendentes'}',
                          ),
                          if (initial.isNotEmpty) Text('$initial a $finalCode'),
                          if ((lot['observacao'] ?? '').toString().isNotEmpty)
                            Text(lot['observacao'].toString()),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            children: [
                              OutlinedButton.icon(
                                onPressed: _busy
                                    ? null
                                    : () => _saveLotPdf(lot),
                                icon: const Icon(Icons.save_alt_outlined),
                                label: const Text('Salvar PDF A4'),
                              ),
                              if (pendingCount > 0)
                                TextButton.icon(
                                  onPressed: _busy
                                      ? null
                                      : () => _cancelLot(lot),
                                  icon: const Icon(Icons.undo),
                                  label: const Text('Liberar saldo'),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
