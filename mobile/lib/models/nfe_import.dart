import 'package:xml/xml.dart';

class NfeImport {
  const NfeImport({required this.invoice, required this.items});

  final NfeInvoice invoice;
  final List<NfeItem> items;

  factory NfeImport.parse(String content) {
    final document = XmlDocument.parse(content);
    final info = document.descendants
        .whereType<XmlElement>()
        .where((element) => element.name.local == 'infNFe')
        .firstOrNull;
    if (info == null) {
      throw const FormatException('Este arquivo não contém uma NF-e válida.');
    }

    final ide = _firstDescendant(info, 'ide');
    final emitter = _firstDescendant(info, 'emit');
    final issuerAddress = emitter == null
        ? null
        : _firstDescendant(emitter, 'enderEmit');
    final total = _firstDescendant(info, 'ICMSTot');
    final idAttribute = info.getAttribute('Id') ?? '';
    final invoiceDate = _readText(ide, 'dhEmi').isNotEmpty
        ? _readText(ide, 'dhEmi')
        : _readText(ide, 'dEmi');

    final lineItems = <NfeItem>[];
    for (final detail in info.descendants.whereType<XmlElement>().where(
      (element) => element.name.local == 'det',
    )) {
      final product = _firstDescendant(detail, 'prod');
      if (product == null) continue;
      final originalDescription = _readText(product, 'xProd');
      if (originalDescription.isEmpty) continue;
      final rawQuantity = _decimal(_readText(product, 'qCom'), fallback: 1);
      final quantity = rawQuantity.round().clamp(1, 99999);
      final unitValue = _decimal(_readText(product, 'vUnCom'));
      final lineTotal = _decimal(
        _readText(product, 'vProd'),
        fallback: unitValue * quantity,
      );
      lineItems.add(
        NfeItem(
          description: _cleanDescription(originalDescription),
          originalDescription: originalDescription,
          quantity: quantity,
          unitValue: unitValue,
          totalValue: lineTotal,
          ncm: _readText(product, 'NCM'),
          cfop: _readText(product, 'CFOP'),
          unit: _readText(product, 'uCom'),
          suggestedCategory: _guessCategory(originalDescription),
        ),
      );
    }
    if (lineItems.isEmpty) {
      throw const FormatException('Nenhum produto foi encontrado no XML.');
    }

    return NfeImport(
      invoice: NfeInvoice(
        number: _readText(ide, 'nNF'),
        series: _readText(ide, 'serie'),
        accessKey: idAttribute.startsWith('NFe')
            ? idAttribute.substring(3)
            : idAttribute,
        issueDate: DateTime.tryParse(
          invoiceDate,
        )?.toIso8601String().split('T').first,
        supplierName: _readText(emitter, 'xFant').isNotEmpty
            ? _readText(emitter, 'xFant')
            : _readText(emitter, 'xNome'),
        supplierDocument: _readText(emitter, 'CNPJ').isNotEmpty
            ? _readText(emitter, 'CNPJ')
            : _readText(emitter, 'CPF'),
        supplierAddress: [
          _readText(issuerAddress, 'xLgr'),
          _readText(issuerAddress, 'nro'),
          _readText(issuerAddress, 'xBairro'),
        ].where((part) => part.isNotEmpty).join(', '),
        supplierCity: _readText(issuerAddress, 'xMun'),
        supplierState: _readText(issuerAddress, 'UF'),
        totalValue: _decimal(_readText(total, 'vNF')),
      ),
      items: lineItems,
    );
  }
}

class NfeInvoice {
  const NfeInvoice({
    required this.number,
    required this.series,
    required this.accessKey,
    required this.issueDate,
    required this.supplierName,
    required this.supplierDocument,
    required this.supplierAddress,
    required this.supplierCity,
    required this.supplierState,
    required this.totalValue,
  });

  final String number;
  final String series;
  final String accessKey;
  final String? issueDate;
  final String supplierName;
  final String supplierDocument;
  final String supplierAddress;
  final String supplierCity;
  final String supplierState;
  final double totalValue;
}

class NfeItem {
  const NfeItem({
    required this.description,
    required this.originalDescription,
    required this.quantity,
    required this.unitValue,
    required this.totalValue,
    required this.ncm,
    required this.cfop,
    required this.unit,
    required this.suggestedCategory,
    this.category,
    this.group,
    this.brand,
    this.model,
    this.imageDataUrl,
  });

  final String description;
  final String originalDescription;
  final int quantity;
  final double unitValue;
  final double totalValue;
  final String ncm;
  final String cfop;
  final String unit;
  final String suggestedCategory;
  final String? category;
  final String? group;
  final String? brand;
  final String? model;
  final String? imageDataUrl;

  NfeItem copyWith({
    String? description,
    int? quantity,
    double? unitValue,
    String? category,
    String? group,
    String? brand,
    String? model,
    String? imageDataUrl,
    bool removeImage = false,
  }) => NfeItem(
    description: description ?? this.description,
    originalDescription: originalDescription,
    quantity: quantity ?? this.quantity,
    unitValue: unitValue ?? this.unitValue,
    totalValue: (quantity ?? this.quantity) * (unitValue ?? this.unitValue),
    ncm: ncm,
    cfop: cfop,
    unit: unit,
    suggestedCategory: suggestedCategory,
    category: category ?? this.category,
    group: group ?? this.group,
    brand: brand ?? this.brand,
    model: model ?? this.model,
    imageDataUrl: removeImage ? null : imageDataUrl ?? this.imageDataUrl,
  );
}

XmlElement? _firstDescendant(XmlNode? node, String localName) => node
    ?.descendants
    .whereType<XmlElement>()
    .where((element) => element.name.local == localName)
    .firstOrNull;

String _readText(XmlNode? node, String localName) =>
    _firstDescendant(node, localName)?.innerText.trim() ?? '';

double _decimal(String value, {double fallback = 0}) =>
    double.tryParse(value.trim().replaceAll(',', '.')) ?? fallback;

String _cleanDescription(String value) {
  final words = value.trim().replaceAll(RegExp(r'\s+'), ' ').split(' ');
  if (value == value.toUpperCase()) {
    return words
        .map(
          (word) => word.isEmpty
              ? word
              : '${word.substring(0, 1)}${word.substring(1).toLowerCase()}',
        )
        .join(' ');
  }
  return value.trim();
}

String _guessCategory(String description) {
  final normalized = description.toLowerCase();
  if ([
    'computador',
    'notebook',
    'impressora',
    'monitor',
    'scanner',
    'servidor',
    'mouse',
    'teclado',
    'ssd',
    'hd externo',
    'no-break',
    'nobreak',
    'projetor',
  ].any(normalized.contains)) {
    return 'informatica';
  }
  if ([
    'mesa',
    'cadeira',
    'armario',
    'gaveteiro',
    'estante',
    'arquivo',
    'balcao',
    'sofa',
    'poltrona',
    'bancada',
  ].any(normalized.contains)) {
    return 'movel';
  }
  if ([
    'ar condicionado',
    'refrigerador',
    'geladeira',
    'microondas',
    'bebedouro',
    'fogao',
    'ventilador',
    'purificador',
  ].any(normalized.contains)) {
    return 'equipamento';
  }
  if ([
    'tv',
    'televisor',
    'caixa de som',
    'amplificador',
    'telefone',
    'camera',
    'câmera',
    'radio',
    'rádio',
  ].any(normalized.contains)) {
    return 'eletronico';
  }
  return '';
}
