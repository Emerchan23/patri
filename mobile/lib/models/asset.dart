class Asset {
  final String id;
  final String? patrimonio;
  final String? patrimonioProvisorio;
  final String? patrimonioTipo;
  final String? etiquetaStatus;
  final String descricao;
  final String categoria;
  final AssetLocation? localizacao;
  final AssetResponsible? responsavel;
  final String? dataAquisicao;
  final double valor;
  final String status;
  final String? marca;
  final String? modelo;
  final String? numeroSerie;
  final String? estadoConservacao;
  final String? observacoes;
  final String? imagem;
  final String? grupo;
  final int? tempoGarantia;
  final String? fornecedor;
  final String? emendaParlamentar;
  final String? placa;
  final int? ano;
  final int? kmAtual;

  Asset({
    required this.id,
    this.patrimonio,
    this.patrimonioProvisorio,
    this.patrimonioTipo,
    this.etiquetaStatus,
    required this.descricao,
    required this.categoria,
    this.localizacao,
    this.responsavel,
    this.dataAquisicao,
    required this.valor,
    required this.status,
    this.marca,
    this.modelo,
    this.numeroSerie,
    this.estadoConservacao,
    this.observacoes,
    this.imagem,
    this.grupo,
    this.tempoGarantia,
    this.fornecedor,
    this.emendaParlamentar,
    this.placa,
    this.ano,
    this.kmAtual,
  });

  factory Asset.fromJson(Map<String, dynamic> json) {
    return Asset(
      id: json['id'].toString(),
      patrimonio: json['patrimonio'],
      patrimonioProvisorio: json['patrimonioProvisorio'],
      patrimonioTipo: json['patrimonioTipo'],
      etiquetaStatus: json['etiquetaStatus']?.toString(),
      descricao: json['descricao'] ?? '',
      categoria: json['categoria'] ?? '',
      localizacao: json['localizacao'] != null
          ? AssetLocation.fromJson(json['localizacao'])
          : null,
      responsavel: json['responsavel'] != null
          ? AssetResponsible.fromJson(json['responsavel'])
          : null,
      dataAquisicao: json['dataAquisicao'],
      valor: (json['valor'] ?? 0).toDouble(),
      status: json['status'] ?? 'ativo',
      marca: json['marca'],
      modelo: json['modelo'],
      numeroSerie: json['numeroSerie'],
      estadoConservacao: json['estadoConservacao'],
      observacoes: json['observacoes'],
      imagem: json['imagem'],
      grupo: json['grupo'],
      tempoGarantia: json['tempoGarantia'],
      fornecedor: json['fornecedor'],
      emendaParlamentar: json['emendaParlamentar'],
      placa: json['placa']?.toString(),
      ano: int.tryParse(json['ano']?.toString() ?? ''),
      kmAtual: int.tryParse(json['kmAtual']?.toString() ?? ''),
    );
  }
}

class AssetLocation {
  final String? secretaria;
  final String? departamento;
  final String? sala;

  AssetLocation({this.secretaria, this.departamento, this.sala});

  factory AssetLocation.fromJson(Map<String, dynamic> json) {
    return AssetLocation(
      secretaria: json['secretaria'],
      departamento: json['departamento'],
      sala: json['sala'],
    );
  }
}

class AssetResponsible {
  final String? nome;
  final String? cargo;

  AssetResponsible({this.nome, this.cargo});

  factory AssetResponsible.fromJson(Map<String, dynamic> json) {
    return AssetResponsible(nome: json['nome'], cargo: json['cargo']);
  }
}
