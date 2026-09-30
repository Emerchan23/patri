import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:sis_patrimonio_mobile/services/settings_service.dart';

class ViewerApiException implements Exception {
  final int? statusCode;
  final String message;

  const ViewerApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class ApiService {
  static const String _defaultServerUrl = 'http://10.0.2.2:3005';
  final SettingsService _settings = SettingsService();

  Future<String> _getBaseUrl() async {
    final saved = await _settings.getServerUrl();
    return saved.isEmpty ? _defaultServerUrl : saved;
  }

  Future<Map<String, dynamic>> consultar(String qrcode) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      '$baseUrl/api/public/consulta',
    ).replace(queryParameters: {'busca': qrcode});

    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 12));
      final body = response.body.isNotEmpty ? json.decode(response.body) : {};

      if (response.statusCode == 200) {
        return body as Map<String, dynamic>;
      }

      final serverError = body is Map<String, dynamic>
          ? body['error']?.toString()
          : null;

      if (response.statusCode == 404) {
        throw const ViewerApiException(
          'Nenhum bem ou sala foi encontrado para este código.',
          statusCode: 404,
        );
      }

      if (response.statusCode == 429) {
        throw const ViewerApiException(
          'Muitas consultas em sequência. Aguarde um pouco e tente novamente.',
          statusCode: 429,
        );
      }

      if (response.statusCode >= 500) {
        throw ViewerApiException(
          serverError ??
              'O servidor encontrou um erro interno ao processar a consulta.',
          statusCode: response.statusCode,
        );
      }

      throw ViewerApiException(
        serverError ?? 'Falha inesperada ao consultar o servidor.',
        statusCode: response.statusCode,
      );
    } on ViewerApiException {
      rethrow;
    } on SocketException {
      throw const ViewerApiException(
        'Não foi possível conectar ao servidor configurado. Verifique o endereço e a rede.',
      );
    } on http.ClientException {
      throw const ViewerApiException(
        'Falha de comunicação com o servidor. Confira o endereço configurado.',
      );
    } on FormatException {
      throw const ViewerApiException(
        'O servidor respondeu em um formato inválido.',
      );
    } catch (_) {
      throw const ViewerApiException(
        'Não foi possível concluir a consulta. Tente novamente.',
      );
    }
  }

  Future<void> saveServerUrl(String url) async {
    await _settings.setServerUrl(url);
  }

  Future<String> getServerUrl() async {
    return await _getBaseUrl();
  }

  Future<void> testServerUrl(String url) async {
    final normalized = _normalizeServerUrl(url);
    final uri = Uri.parse('$normalized/api/public/consulta');

    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 8));

      if (response.statusCode == 400 || response.statusCode == 200) {
        return;
      }

      if (response.statusCode >= 500) {
        throw const ViewerApiException(
          'Servidor encontrado, mas respondeu com erro interno.',
          statusCode: 500,
        );
      }

      throw ViewerApiException(
        'Não foi possível validar o servidor. Status ${response.statusCode}.',
        statusCode: response.statusCode,
      );
    } on ViewerApiException {
      rethrow;
    } on SocketException {
      throw const ViewerApiException(
        'Não foi possível conectar ao servidor informado.',
      );
    } on http.ClientException {
      throw const ViewerApiException(
        'Falha ao validar o endereço do servidor.',
      );
    } catch (e) {
      throw const ViewerApiException(
        'Não foi possível validar o servidor. Confira o endereço e tente novamente.',
      );
    }
  }

  String normalizeServerUrl(String input) => _normalizeServerUrl(input);

  String _normalizeServerUrl(String input) {
    var value = input.trim();
    if (value.isEmpty) return _defaultServerUrl;
    if (!value.startsWith('http://') && !value.startsWith('https://')) {
      value = 'http://$value';
    }
    return value.replaceFirst(RegExp(r'/+$'), '');
  }
}
