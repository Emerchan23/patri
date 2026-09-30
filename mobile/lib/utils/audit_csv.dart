import 'dart:convert';

/// Converts audit rows to a spreadsheet-friendly CSV using the app's locale.
String auditLogsToCsv(Iterable<Map<String, dynamic>> rows) {
  final csv = StringBuffer('Data;Ação;Descrição;Usuário;Entidade;Detalhes\r\n');
  for (final row in rows) {
    final user = row['usuario'] is Map ? (row['usuario'] as Map)['nome'] : '';
    final entity = row['entidade'] is Map
        ? (row['entidade'] as Map)['descricao']
        : '';
    csv.writeln(
      [
        row['dataHora'],
        row['acao'],
        row['descricao'],
        user,
        entity,
        row['detalhes'],
      ].map(_csvCell).join(';'),
    );
  }
  return csv.toString();
}

String _csvCell(dynamic value) {
  var text = value?.toString() ?? '';
  if (RegExp(r'^[\s\x00-\x1F]*[=+@-]').hasMatch(text)) text = "'$text";
  return '"${text.replaceAll('"', '""')}"';
}

/// Makes the string usable as UTF-8 when writing or sharing the export.
List<int> auditCsvBytes(Iterable<Map<String, dynamic>> rows) => [
  0xEF,
  0xBB,
  0xBF,
  ...utf8.encode(auditLogsToCsv(rows)),
];
