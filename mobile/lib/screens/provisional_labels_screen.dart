import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:sis_patrimonio_mobile/services/api_service.dart';

const _defaultLabelLayout = <String, dynamic>{
  'title': '',
  'subtitle': '',
  'showDescription': true,
  'showEmenda': true,
  'showFooter': true,
  'qrSizeMm': 16,
  'offsetXMm': 0,
  'offsetYMm': 1,
  'offsetColuna2Mm': 3,
  'alturaExtraMm': 20,
  'innerPaddingMm': 1.5,
};

class ProvisionalLabelsScreen extends StatefulWidget {
  const ProvisionalLabelsScreen({super.key});

  @override
  State<ProvisionalLabelsScreen> createState() =>
      _ProvisionalLabelsScreenState();
}

class _ProvisionalLabelsScreenState extends State<ProvisionalLabelsScreen> {
  final ApiService _api = ApiService();
  List<Map<String, dynamic>> _lots = [];
  bool _loading = true;
  bool _busy = false;
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

  Future<void> _printLot(Map<String, dynamic> lot) async {
    final id = lot['id']?.toString();
    if (id == null) return;
    final printOptions = await showDialog<LabelPrintOptions>(
      context: context,
      builder: (context) => const LabelPrintDialog(),
    );
    if (printOptions == null) return;
    setState(() => _busy = true);
    try {
      final labels = await _api.getProvisionalLotLabels(id);
      if (labels.isEmpty) {
        throw Exception(
          'Este lote não possui etiquetas pendentes para imprimir.',
        );
      }
      var layout = _defaultLabelLayout;
      if (printOptions.zebra) {
        try {
          layout = await _api.getProvisionalLabelLayoutConfig();
        } catch (_) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Preset do sistema indisponível; usando o padrão do aplicativo.',
                ),
              ),
            );
          }
        }
      }
      await Printing.layoutPdf(
        onLayout: (_) => printOptions.zebra
            ? _buildZebraPdf(labels, printOptions.columns, layout)
            : _buildPdf(labels),
        name: printOptions.zebra
            ? 'etiquetas-zebra-lote-$id.pdf'
            : 'etiquetas-lote-$id.pdf',
      );
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
                              fontSize: 5,
                              color: PdfColors.grey700,
                            ),
                          ),
                          pw.SizedBox(height: 3),
                          pw.Text(
                            code,
                            style: pw.TextStyle(
                              fontSize: 8,
                              fontWeight: pw.FontWeight.bold,
                            ),
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

  Future<Uint8List> _buildZebraPdf(
    List<Map<String, dynamic>> labels,
    int columns,
    Map<String, dynamic> layout,
  ) async {
    final document = pw.Document();
    const labelWidthMm = 50.0;
    final labelHeightMm = 25 + _layoutNumber(layout, 'alturaExtraMm', 20);
    final qrSizeMm = _layoutNumber(layout, 'qrSizeMm', 16).clamp(8, 22);
    final innerPaddingMm = _layoutNumber(layout, 'innerPaddingMm', 1.5);
    final title = layout['title']?.toString().trim() ?? '';
    final subtitle = layout['subtitle']?.toString().trim() ?? '';
    final showDescription = layout['showDescription'] != false;
    final showAmendment = layout['showEmenda'] != false;
    final showFooter = layout['showFooter'] != false;
    final horizontalOffset = _layoutNumber(layout, 'offsetXMm', 0);
    final verticalOffset = _layoutNumber(layout, 'offsetYMm', 1);
    final secondColumnOffset = _layoutNumber(layout, 'offsetColuna2Mm', 3);
    final pageFormat = PdfPageFormat(
      labelWidthMm * columns * PdfPageFormat.mm,
      labelHeightMm * PdfPageFormat.mm,
      marginAll: 0,
    );

    for (var start = 0; start < labels.length; start += columns) {
      final row = labels.skip(start).take(columns).toList();
      document.addPage(
        pw.Page(
          pageFormat: pageFormat,
          margin: pw.EdgeInsets.zero,
          build: (context) => pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: row.indexed.map((entry) {
              final index = entry.$1;
              final label = entry.$2;
              final code = label['codigo']?.toString() ?? '';
              final observation = label['observacao']?.toString().trim();
              final amendment = label['emenda_parlamentar']?.toString().trim();
              final columnOffset =
                  horizontalOffset +
                  (columns == 2 && index == 1 ? secondColumnOffset : 0);
              return pw.SizedBox(
                width: labelWidthMm * PdfPageFormat.mm,
                height: labelHeightMm * PdfPageFormat.mm,
                child: pw.Padding(
                  padding: pw.EdgeInsets.only(
                    left: (columnOffset + innerPaddingMm) * PdfPageFormat.mm,
                    right: innerPaddingMm * PdfPageFormat.mm,
                    top: (verticalOffset + innerPaddingMm) * PdfPageFormat.mm,
                    bottom: innerPaddingMm * PdfPageFormat.mm,
                  ),
                  child: pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.center,
                    children: [
                      pw.BarcodeWidget(
                        barcode: pw.Barcode.qrCode(),
                        data: code,
                        width: qrSizeMm * PdfPageFormat.mm,
                        height: qrSizeMm * PdfPageFormat.mm,
                      ),
                      pw.SizedBox(width: 2 * PdfPageFormat.mm),
                      pw.Expanded(
                        child: pw.Column(
                          mainAxisAlignment: pw.MainAxisAlignment.center,
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            if (title.isNotEmpty)
                              pw.Text(
                                title,
                                maxLines: 1,
                                style: pw.TextStyle(
                                  fontSize: 5,
                                  color: PdfColors.grey700,
                                ),
                              ),
                            if (subtitle.isNotEmpty)
                              pw.Text(
                                subtitle,
                                maxLines: 1,
                                style: const pw.TextStyle(fontSize: 4.4),
                              ),
                            pw.SizedBox(height: 1.5),
                            pw.Text(
                              code,
                              maxLines: 1,
                              style: pw.TextStyle(
                                fontSize: 7,
                                fontWeight: pw.FontWeight.bold,
                              ),
                            ),
                            if (showDescription &&
                                observation?.isNotEmpty == true) ...[
                              pw.SizedBox(height: 2),
                              pw.Text(
                                observation!,
                                maxLines: 2,
                                style: const pw.TextStyle(fontSize: 5.5),
                              ),
                            ],
                            if (showAmendment &&
                                amendment?.isNotEmpty == true) ...[
                              pw.SizedBox(height: 2),
                              pw.Text(
                                amendment!,
                                maxLines: 2,
                                style: const pw.TextStyle(fontSize: 5),
                              ),
                            ],
                            if (showFooter)
                              pw.Align(
                                alignment: pw.Alignment.centerRight,
                                child: pw.Text(
                                  'SisPatrimonio',
                                  style: pw.TextStyle(fontSize: 4),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      );
    }
    return document.save();
  }

  double _layoutNumber(
    Map<String, dynamic> layout,
    String key,
    double fallback,
  ) {
    return double.tryParse(layout[key]?.toString() ?? '') ?? fallback;
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : _reserve,
        icon: const Icon(Icons.add),
        label: const Text('Reservar lote'),
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
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                itemCount: _lots.length,
                itemBuilder: (context, index) {
                  final lot = _lots[index];
                  final id = lot['id']?.toString() ?? '?';
                  final initial = lot['faixa_inicial']?.toString() ?? '';
                  final finalCode = lot['faixa_final']?.toString() ?? '';
                  final pending = lot['pendentes'] ?? 0;
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
                            '${lot['quantidade'] ?? 0} etiquetas · $pending pendentes',
                          ),
                          if (initial.isNotEmpty) Text('$initial a $finalCode'),
                          if ((lot['observacao'] ?? '').toString().isNotEmpty)
                            Text(lot['observacao'].toString()),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            children: [
                              OutlinedButton.icon(
                                onPressed: _busy ? null : () => _printLot(lot),
                                icon: const Icon(Icons.print_outlined),
                                label: const Text('Imprimir pendentes'),
                              ),
                              if ((pending is num
                                      ? pending
                                      : int.tryParse('$pending') ?? 0) >
                                  0)
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
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
    );
  }
}

class LabelPrintOptions {
  final bool zebra;
  final int columns;
  final Map<String, dynamic> layout;

  const LabelPrintOptions({
    required this.zebra,
    required this.columns,
    required this.layout,
  });
}

class LabelPrintDialog extends StatefulWidget {
  final Map<String, dynamic> layout;

  const LabelPrintDialog({super.key, this.layout = _defaultLabelLayout});

  @override
  State<LabelPrintDialog> createState() => _LabelPrintDialogState();
}

class _LabelPrintDialogState extends State<LabelPrintDialog> {
  bool _zebra = false;
  int _columns = 1;

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Formato de impressão'),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RadioGroup<bool>(
          groupValue: _zebra,
          onChanged: (value) => setState(() => _zebra = value ?? false),
          child: const Column(
            children: [
              RadioListTile<bool>(
                value: false,
                title: Text('Folha A4'),
                subtitle: Text('Grade de 3 colunas para impressora comum.'),
                contentPadding: EdgeInsets.zero,
              ),
              RadioListTile<bool>(
                value: true,
                title: Text('Etiqueta térmica (Zebra)'),
                subtitle: Text('Rolo de 50 mm, uma etiqueta por linha.'),
                contentPadding: EdgeInsets.zero,
              ),
            ],
          ),
        ),
        if (_zebra) ...[
          const SizedBox(height: 8),
          const Text('Largura do rolo'),
          const SizedBox(height: 4),
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 1, label: Text('50 mm')),
              ButtonSegment(value: 2, label: Text('100 mm · 2 colunas')),
            ],
            selected: {_columns},
            onSelectionChanged: (values) =>
                setState(() => _columns = values.first),
          ),
          const SizedBox(height: 8),
          Text(
            'O tamanho final também depende da configuração da impressora. Faça um teste em papel antes de usar etiquetas adesivas.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ],
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(
          context,
          LabelPrintOptions(
            zebra: _zebra,
            columns: _columns,
            layout: widget.layout,
          ),
        ),
        child: const Text('Continuar'),
      ),
    ],
  );
}
