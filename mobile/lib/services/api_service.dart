import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http_types;
import 'package:sis_patrimonio_mobile/models/asset.dart';
import 'package:sis_patrimonio_mobile/services/session_aware_http_client.dart';
import 'package:sis_patrimonio_mobile/services/settings_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

final http = SessionAwareHttpClient(
  onUnauthorized: ApiService._handleUnauthorized,
);

void _debugLog(String message) {
  if (kDebugMode) debugPrint(message);
}

class LoginResult {
  final bool success;
  final int statusCode;
  final String message;

  const LoginResult({
    required this.success,
    required this.statusCode,
    required this.message,
  });
}

class ApiAccessKey {
  final String id;
  final String name;
  final String maskedKey;
  final bool active;
  final DateTime? createdAt;

  const ApiAccessKey({
    required this.id,
    required this.name,
    required this.maskedKey,
    required this.active,
    this.createdAt,
  });

  factory ApiAccessKey.fromJson(Map<String, dynamic> json) => ApiAccessKey(
    id: json['id']?.toString() ?? '',
    name: json['nome']?.toString() ?? '',
    maskedKey: json['chave']?.toString() ?? '',
    active: json['ativo'] == true || json['ativo']?.toString() == '1',
    createdAt: DateTime.tryParse(json['criado_em']?.toString() ?? ''),
  );
}

class SystemAdminSettings {
  final String themeColor;
  final String sidebarColor;
  final String linkExtensaoXml;
  final String linkPortalSefaz;
  final int sessionDaysWeb;
  final int sessionDaysMobile;

  const SystemAdminSettings({
    required this.themeColor,
    required this.sidebarColor,
    required this.linkExtensaoXml,
    required this.linkPortalSefaz,
    required this.sessionDaysWeb,
    required this.sessionDaysMobile,
  });

  factory SystemAdminSettings.fromJson(Map<String, dynamic> json) =>
      SystemAdminSettings(
        themeColor: json['themeColor']?.toString() ?? 'blue',
        sidebarColor: json['sidebarColor']?.toString() ?? 'dark',
        linkExtensaoXml: json['linkExtensaoXml']?.toString() ?? '',
        linkPortalSefaz: json['linkPortalSefaz']?.toString() ?? '',
        sessionDaysWeb:
            int.tryParse(json['sessionDaysWeb']?.toString() ?? '') ?? 3,
        sessionDaysMobile:
            int.tryParse(json['sessionDaysMobile']?.toString() ?? '') ?? 30,
      );

  Map<String, dynamic> toJson() => {
    'themeColor': themeColor,
    'sidebarColor': sidebarColor,
    'linkExtensaoXml': linkExtensaoXml,
    'linkPortalSefaz': linkPortalSefaz,
    'sessionDaysWeb': sessionDaysWeb,
    'sessionDaysMobile': sessionDaysMobile,
  };
}

class BackupSchedule {
  final bool enabled;
  final String frequency;
  final String time;
  final int keepCount;

  const BackupSchedule({
    required this.enabled,
    required this.frequency,
    required this.time,
    required this.keepCount,
  });

  factory BackupSchedule.fromJson(Map<String, dynamic> json) => BackupSchedule(
    enabled: json['enabled'] == true || json['enabled']?.toString() == '1',
    frequency: json['frequency']?.toString() ?? 'daily',
    time: json['time']?.toString() ?? '00:00',
    keepCount: int.tryParse(json['keep_count']?.toString() ?? '') ?? 7,
  );

  Map<String, dynamic> toJson() => {
    'enabled': enabled,
    'frequency': frequency,
    'time': time,
    'keep_count': keepCount,
  };
}

class BackupFileInfo {
  final String name;
  final int size;
  final DateTime? createdAt;

  const BackupFileInfo({
    required this.name,
    required this.size,
    required this.createdAt,
  });

  factory BackupFileInfo.fromJson(Map<String, dynamic> json) => BackupFileInfo(
    name: json['name']?.toString() ?? '',
    size: int.tryParse(json['size']?.toString() ?? '') ?? 0,
    createdAt: DateTime.tryParse(json['created_at']?.toString() ?? ''),
  );
}

class CurrentUserSession {
  final String id;
  final String nome;
  final String role;
  final String? secretaria;
  final String? departamento;
  final List<String> departamentos;
  final Map<String, bool>? permissions;

  const CurrentUserSession({
    this.id = '',
    required this.nome,
    required this.role,
    this.secretaria,
    this.departamento,
    this.departamentos = const [],
    this.permissions,
  });

  factory CurrentUserSession.fromJson(Map<String, dynamic> json) {
    final unidade = json['unidade'] is Map<String, dynamic>
        ? json['unidade'] as Map<String, dynamic>
        : const <String, dynamic>{};

    return CurrentUserSession(
      id: json['id']?.toString() ?? '',
      nome: json['nome']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
      secretaria: unidade['secretaria']?.toString(),
      departamento: unidade['departamento']?.toString(),
      departamentos: unidade['departamentos'] is List
          ? (unidade['departamentos'] as List)
                .map((value) => value.toString())
                .toList()
          : const [],
      permissions: json['permissions'] is Map
          ? (json['permissions'] as Map).map(
              (key, value) => MapEntry(key.toString(), value == true),
            )
          : null,
    );
  }

  bool hasPermission(String permission) {
    final explicitPermissions = permissions;
    if (explicitPermissions != null) {
      return explicitPermissions[permission] ?? false;
    }
    final defaults = switch (role) {
      'administrador' => const {
        'acessarMovimentacoes',
        'verDashboardGeral',
        'verDashboardUnidade',
        'cadastrarBem',
        'editarBem',
        'baixarBem',
        'atribuirPatrimonioDefinitivo',
        'verTodosBens',
        'verBensUnidade',
        'registrarMovimentacao',
        'aprovarMovimentacao',
        'acessarCadastrosProvisorios',
        'gerenciarVeiculos',
        'verVeiculos',
        'usarScanner',
        'gerenciarUsuarios',
        'verRelatorios',
        'verPendenciasPatrimonio',
        'gerarEtiquetas',
        'gerenciarEmprestimos',
        'gerenciarCadastrosAuxiliares',
        'excluirBem',
        'gerenciarAlienacoes',
      },
      'gestor' => const {
        'acessarMovimentacoes',
        'verDashboardGeral',
        'verDashboardUnidade',
        'cadastrarBem',
        'editarBem',
        'atribuirPatrimonioDefinitivo',
        'verTodosBens',
        'verBensUnidade',
        'registrarMovimentacao',
        'aprovarMovimentacao',
        'acessarCadastrosProvisorios',
        'gerenciarVeiculos',
        'verVeiculos',
        'usarScanner',
        'verRelatorios',
        'verPendenciasPatrimonio',
        'gerarEtiquetas',
        'gerenciarEmprestimos',
        'gerenciarCadastrosAuxiliares',
        'excluirBem',
        'gerenciarAlienacoes',
      },
      'assistente' => const {
        'acessarMovimentacoes',
        'verDashboardUnidade',
        'verBensUnidade',
        'verVeiculos',
        'usarScanner',
      },
      _ => const <String>{},
    };
    return defaults.contains(permission);
  }
}

class ApiService {
  static final ValueNotifier<bool> sessionExpired = ValueNotifier(false);
  static bool _sessionInvalidated = false;

  final SettingsService _settingsService = SettingsService();
  String? _token;

  // Cache storage
  List<Map<String, dynamic>>? _cachedCategorias;
  List<Map<String, dynamic>>? _cachedGrupos;
  List<Map<String, dynamic>>? _cachedMarcas;
  List<Map<String, dynamic>>? _cachedSecretarias;
  List<Map<String, dynamic>>? _cachedServidores;
  List<Map<String, dynamic>>? _cachedFornecedores;

  Future<void> _loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_cookie');
  }

  Future<String> _getBaseUrl() async {
    return await _settingsService.getServerUrl();
  }

  Future<Map<String, String>> _getHeaders() async {
    final headers = {'Content-Type': 'application/json'};
    if (!_sessionInvalidated && _token == null) await _loadToken();
    if (!_sessionInvalidated && _token != null) {
      headers['Cookie'] = _token!;
    }
    return headers;
  }

  static void _handleUnauthorized() {
    if (_sessionInvalidated) return;
    _sessionInvalidated = true;
    sessionExpired.value = true;
    unawaited(
      SharedPreferences.getInstance().then(
        (prefs) => prefs.remove('auth_cookie'),
      ),
    );
  }

  Future<void> clearStoredSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_cookie');
    _token = null;
    _sessionInvalidated = true;
  }

  Future<void> _saveSessionCookie(String rawCookie) async {
    final int index = rawCookie.indexOf(';');
    final cookieValue = (index == -1)
        ? rawCookie
        : rawCookie.substring(0, index);

    _token = cookieValue;
    _sessionInvalidated = false;
    sessionExpired.value = false;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_cookie', _token!);
  }

  dynamic _decodeResponseBody(http_types.Response response) {
    return json.decode(utf8.decode(response.bodyBytes));
  }

  List<Map<String, dynamic>> _normalizeListResponse(dynamic decoded) {
    final dynamic rawList = decoded is List
        ? decoded
        : decoded is Map<String, dynamic> && decoded['data'] is List
        ? decoded['data']
        : const [];

    return List<Map<String, dynamic>>.from(
      (rawList as List).map((item) => Map<String, dynamic>.from(item as Map)),
    );
  }

  Future<List<Map<String, dynamic>>> _fetchCatalog(
    Uri uri, {
    required String name,
  }) async {
    try {
      final response = await http
          .get(uri, headers: await _getHeaders())
          .timeout(const Duration(seconds: 15));
      if (response.statusCode != 200) {
        throw Exception(
          _parseErrorMessage(
            response,
            fallback: 'Não foi possível carregar $name.',
          ),
        );
      }
      final decoded = _decodeResponseBody(response);
      if (decoded is! List &&
          (decoded is! Map<String, dynamic> || decoded['data'] is! List)) {
        throw Exception('Resposta inválida ao carregar $name.');
      }
      return _normalizeListResponse(decoded);
    } on TimeoutException {
      throw Exception('A consulta de $name demorou demais. Tente novamente.');
    } catch (error) {
      if (error.toString().startsWith('Exception:')) rethrow;
      throw Exception('Falha de conexão ao carregar $name. Verifique a rede.');
    }
  }

  String _parseErrorMessage(http_types.Response response, {String? fallback}) {
    try {
      final dynamic decoded = json.decode(response.body);
      if (decoded is Map<String, dynamic>) {
        final error = decoded['error']?.toString().trim();
        if (error != null && error.isNotEmpty) {
          return error;
        }
      }
    } catch (_) {
      // Keep fallback below when response body is not JSON.
    }

    return fallback ?? 'Falha ao processar o login.';
  }

  bool _isRetryableLoginStatus(int statusCode) {
    return statusCode == 500 ||
        statusCode == 502 ||
        statusCode == 503 ||
        statusCode == 504;
  }

  Future<LoginResult> _performLoginRequest(
    Uri uri,
    String email,
    String password,
  ) async {
    final response = await http
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: json.encode({
            'email': email,
            'senha': password,
            'isMobile': true,
          }),
        )
        .timeout(const Duration(seconds: 12));

    if (response.statusCode == 200) {
      final rawCookie = response.headers['set-cookie'];
      if (rawCookie == null || rawCookie.isEmpty) {
        return const LoginResult(
          success: false,
          statusCode: 500,
          message: 'Sessao criada sem cookie de autenticacao. Tente novamente.',
        );
      }

      await _saveSessionCookie(rawCookie);
      return const LoginResult(
        success: true,
        statusCode: 200,
        message: 'Login realizado com sucesso.',
      );
    }

    return LoginResult(
      success: false,
      statusCode: response.statusCode,
      message: _parseErrorMessage(
        response,
        fallback: 'Falha no login. Tente novamente em instantes.',
      ),
    );
  }

  Future<LoginResult> login(String email, String password) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/auth/login');

    try {
      final firstAttempt = await _performLoginRequest(uri, email, password);
      if (firstAttempt.success ||
          !_isRetryableLoginStatus(firstAttempt.statusCode)) {
        return firstAttempt;
      }

      await Future.delayed(const Duration(milliseconds: 700));
      return await _performLoginRequest(uri, email, password);
    } catch (e) {
      _debugLog('Login error: $e');
      await Future.delayed(const Duration(milliseconds: 700));

      try {
        return await _performLoginRequest(uri, email, password);
      } catch (retryError) {
        _debugLog('Login retry error: $retryError');
        return const LoginResult(
          success: false,
          statusCode: 0,
          message:
              'Nao foi possivel conectar ao servidor. Verifique a conexao e tente novamente.',
        );
      }
    }
  }

  Future<bool> hasValidSession() async {
    if (_token == null) {
      await _loadToken();
    }

    if (_token == null || _token!.isEmpty) {
      return false;
    }

    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/auth/me');

    try {
      final response = await http
          .get(uri, headers: await _getHeaders())
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        return true;
      }

      if (response.statusCode == 401 || response.statusCode == 403) {
        await clearStoredSession();
      }
      return false;
    } catch (e) {
      _debugLog('Session check error: $e');
      return false;
    }
  }

  Future<CurrentUserSession?> getCurrentUserSession() async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/auth/me');

    try {
      final response = await http
          .get(uri, headers: await _getHeaders())
          .timeout(const Duration(seconds: 8));

      if (response.statusCode != 200) {
        return null;
      }

      final data = json.decode(response.body) as Map<String, dynamic>;
      final user = data['user'];
      if (user is! Map<String, dynamic>) {
        return null;
      }

      return CurrentUserSession.fromJson(user);
    } catch (e) {
      _debugLog('Erro ao buscar sessao atual: $e');
      return null;
    }
  }

  Future<bool> testConnection() async {
    final baseUrl = await _getBaseUrl();
    try {
      final uri = Uri.parse('$baseUrl/api/auth/me');
      final response = await http.get(uri).timeout(const Duration(seconds: 5));
      return response.statusCode == 200 || response.statusCode == 401;
    } catch (e) {
      _debugLog('Erro de conexão: $e');
      return false;
    }
  }

  // --- ASSETS ---

  Future<List<Asset>> getAssets({String? search}) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/bens');
    final queryParams = <String, String>{};
    if (search != null && search.isNotEmpty) {
      queryParams['busca'] = search;
    }

    try {
      final headers = await _getHeaders();
      final response = await http.get(
        uri.replace(queryParameters: queryParams),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        if (decoded is! Map<String, dynamic> || decoded['data'] is! List) {
          throw Exception('Resposta inválida ao carregar os bens.');
        }
        final List<dynamic> assetsJson = decoded['data'] as List<dynamic>;
        return assetsJson.map((json) => Asset.fromJson(json)).toList();
      }
      throw Exception(
        _parseErrorMessage(
          response,
          fallback:
              'Não foi possível carregar os bens (HTTP ${response.statusCode}).',
        ),
      );
    } catch (e) {
      _debugLog('Erro ao buscar bens: $e');
      rethrow;
    }
  }

  Future<Asset?> getAssetByPatrimony(String patrimony) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      '$baseUrl/api/bens',
    ).replace(queryParameters: {'patrimonio': patrimony});

    try {
      final headers = await _getHeaders();

      // Retry logic for unstable connections
      http_types.Response? response;
      int attempts = 0;
      while (attempts < 3) {
        try {
          response = await http
              .get(uri, headers: headers)
              .timeout(const Duration(seconds: 10));
          if (response.statusCode == 200 || response.statusCode >= 400) break;
        } catch (_) {
          // ignore error and retry
        }
        attempts++;
        if (attempts < 3) {
          await Future.delayed(const Duration(milliseconds: 500));
        }
      }

      if (response != null && response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body);
        final List<dynamic> assetsJson = data['data'];

        if (assetsJson.isNotEmpty) {
          return Asset.fromJson(assetsJson.first);
        }
        return null;
      }

      if (response != null) {
        throw Exception(
          _parseErrorMessage(
            response,
            fallback:
                'Não foi possível consultar este bem (HTTP ${response.statusCode}).',
          ),
        );
      }

      throw Exception(
        'Não foi possível conectar ao servidor. Verifique a conexão.',
      );
    } catch (e) {
      _debugLog('Erro ao buscar bem: $e');
      rethrow;
    }
  }

  Future<Asset> getAssetById(String id) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(Uri.parse('$baseUrl/api/bens/$id'), headers: await _getHeaders())
        .timeout(const Duration(seconds: 12));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback:
              'Não foi possível abrir este bem (HTTP ${response.statusCode}).',
        ),
      );
    }
    final decoded = _decodeResponseBody(response);
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Resposta inválida ao carregar os detalhes do bem.');
    }
    return Asset.fromJson(decoded);
  }

  Future<List<Asset>> getAssetsByRoom(String roomName) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      '$baseUrl/api/bens',
    ).replace(queryParameters: {'sala': roomName});

    try {
      final headers = await _getHeaders();
      final response = await http
          .get(uri, headers: headers)
          .timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body);
        final List<dynamic> assetsJson = data['data'];
        return assetsJson.map((json) => Asset.fromJson(json)).toList();
      }
      throw Exception(
        _parseErrorMessage(
          response,
          fallback:
              'Não foi possível carregar os bens desta sala (HTTP ${response.statusCode}).',
        ),
      );
    } catch (e) {
      _debugLog('Erro ao buscar bens da sala: $e');
      rethrow;
    }
  }

  Future<String?> getRoomNameById(String id) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/salas/$id');

    try {
      final headers = await _getHeaders();
      final response = await http
          .get(uri, headers: headers)
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['nome'] as String?;
      }
      if (response.statusCode == 404) return null;
      throw Exception(
        _parseErrorMessage(
          response,
          fallback:
              'Não foi possível localizar a sala (HTTP ${response.statusCode}).',
        ),
      );
    } catch (e) {
      _debugLog('Erro ao buscar nome da sala: $e');
      rethrow;
    }
  }

  // --- AUXILIARY LISTS ---

  Future<List<Map<String, dynamic>>> getCategorias({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh &&
        _cachedCategorias != null &&
        _cachedCategorias!.isNotEmpty) {
      return _cachedCategorias!;
    }

    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      '$baseUrl/api/categorias',
    ).replace(queryParameters: {'all': 'true'});
    final data = await _fetchCatalog(uri, name: 'as categorias');
    _cachedCategorias = data;
    return data;
  }

  Future<List<Map<String, dynamic>>> getGrupos({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh && _cachedGrupos != null && _cachedGrupos!.isNotEmpty) {
      return _cachedGrupos!;
    }

    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      '$baseUrl/api/grupos',
    ).replace(queryParameters: {'all': 'true'});
    final data = await _fetchCatalog(uri, name: 'os grupos');
    _cachedGrupos = data;
    return data;
  }

  Future<List<Map<String, dynamic>>> getMarcas({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh && _cachedMarcas != null && _cachedMarcas!.isNotEmpty) {
      return _cachedMarcas!;
    }

    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      '$baseUrl/api/marcas',
    ).replace(queryParameters: {'all': 'true'});
    final data = await _fetchCatalog(uri, name: 'as marcas');
    _cachedMarcas = data;
    return data;
  }

  // --- LOCATIONS (AUXILIARY) ---

  Future<List<Map<String, dynamic>>> getSecretarias({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh &&
        _cachedSecretarias != null &&
        _cachedSecretarias!.isNotEmpty) {
      return _cachedSecretarias!;
    }

    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      '$baseUrl/api/secretarias',
    ).replace(queryParameters: {'all': 'true'});
    final data = await _fetchCatalog(uri, name: 'as secretarias');
    _cachedSecretarias = data;
    return data;
  }

  Future<List<Map<String, dynamic>>> getDepartamentos(int secretariaId) async {
    // Note: The API structure for departments might be nested in secretarias or separate.
    // Based on backend file list, we have `api/secretarias/[id]/departamentos`.
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      '$baseUrl/api/secretarias/$secretariaId/departamentos',
    );
    return _fetchCatalog(uri, name: 'os departamentos');
  }

  Future<List<Map<String, dynamic>>> getSalas(int departamentoId) async {
    // Based on backend file list: `api/departamentos/[id]/salas`
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/departamentos/$departamentoId/salas');
    return _fetchCatalog(uri, name: 'as salas');
  }

  // --- MOVEMENTS ---

  Future<void> createMovement({
    required List<String> assetIds,
    required Map<String, String?> destination,
    required String motivo,
  }) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/movimentacoes');

    try {
      final headers = await _getHeaders();
      final body = {
        'assetIds': assetIds,
        'para': destination,
        'data': DateTime.now().toIso8601String().split('T')[0],
        'motivo': motivo,
      };

      final response = await http
          .post(uri, headers: headers, body: json.encode(body))
          .timeout(const Duration(seconds: 90));
      if (response.statusCode != 201) {
        throw Exception(
          _parseErrorMessage(
            response,
            fallback:
                'A transferência não foi concluída (HTTP ${response.statusCode}).',
          ),
        );
      }
    } catch (e) {
      _debugLog('Erro ao movimentar: $e');
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> getMovementRequests({
    String status = 'todas',
  }) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      '$baseUrl/api/solicitacoes-movimentacao',
    ).replace(queryParameters: {'status': status, 'limit': '100'});
    final response = await http
        .get(uri, headers: await _getHeaders())
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar as solicitações.',
        ),
      );
    }
    return _normalizeListResponse(_decodeResponseBody(response));
  }

  Future<void> createMovementRequest({
    required List<String> assetIds,
    required String secretariaDestino,
    required String departamentoDestino,
    required String salaDestino,
    required String motivo,
  }) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/solicitacoes-movimentacao');
    final response = await http
        .post(
          uri,
          headers: await _getHeaders(),
          body: json.encode({
            'assetIds': assetIds,
            'secretariaDestino': secretariaDestino,
            'departamentoDestino': departamentoDestino,
            'salaDestino': salaDestino,
            'motivo': motivo,
          }),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 201) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível enviar a solicitação.',
        ),
      );
    }
  }

  Future<void> updateMovementRequest({
    required String id,
    required String action,
    String? rejectionReason,
  }) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/solicitacoes-movimentacao/$id');
    final response = await http
        .patch(
          uri,
          headers: await _getHeaders(),
          body: json.encode({
            'action': action,
            ...?(rejectionReason == null
                ? null
                : {'motivoRejeicao': rejectionReason}),
          }),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível atualizar a solicitação.',
        ),
      );
    }
  }

  Future<List<Map<String, dynamic>>> getProvisionalRegistrations({
    String status = 'todos',
  }) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      '$baseUrl/api/cadastros-provisorios',
    ).replace(queryParameters: {'status': status});
    final response = await http
        .get(uri, headers: await _getHeaders())
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar os cadastros provisórios.',
        ),
      );
    }
    return _normalizeListResponse(_decodeResponseBody(response));
  }

  Future<void> createProvisionalRegistration(
    Map<String, dynamic> payload,
  ) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/cadastros-provisorios');
    final response = await http
        .post(uri, headers: await _getHeaders(), body: json.encode(payload))
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 201) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível enviar o cadastro provisório.',
        ),
      );
    }
  }

  Future<void> saveProvisionalRegistration({
    String? id,
    required Map<String, dynamic> payload,
  }) async {
    if (id == null) {
      await createProvisionalRegistration(payload);
      return;
    }
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/cadastros-provisorios/$id');
    final response = await http
        .put(uri, headers: await _getHeaders(), body: json.encode(payload))
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível salvar as correções do cadastro.',
        ),
      );
    }
  }

  Future<void> updateProvisionalRegistration({
    required String id,
    required String action,
    String? reason,
  }) async {
    final baseUrl = await _getBaseUrl();
    final path = switch (action) {
      'aprovar' => 'aprovar',
      'rejeitar' => 'rejeitar',
      'devolver' => 'devolver',
      'encaminhar' => 'encaminhar',
      _ => throw ArgumentError.value(action, 'action'),
    };
    final uri = Uri.parse('$baseUrl/api/cadastros-provisorios/$id/$path');
    final response = await http
        .post(
          uri,
          headers: await _getHeaders(),
          body: json.encode({
            if (action == 'encaminhar') 'observacao': reason,
            if (action != 'encaminhar') 'motivo': reason,
          }),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível atualizar o cadastro provisório.',
        ),
      );
    }
  }

  Future<List<Map<String, dynamic>>> getLoans({String? status}) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/emprestimos').replace(
      queryParameters: {
        'limit': '100',
        if (status != null && status != 'todos') 'status': status,
      },
    );
    final response = await http
        .get(uri, headers: await _getHeaders())
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar os empréstimos.',
        ),
      );
    }
    return _normalizeListResponse(_decodeResponseBody(response));
  }

  Future<void> createLoan(Map<String, dynamic> payload) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .post(
          Uri.parse('$baseUrl/api/emprestimos'),
          headers: await _getHeaders(),
          body: json.encode(payload),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 201) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível registrar o empréstimo.',
        ),
      );
    }
  }

  Future<void> returnLoan(String id, {String? notes}) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .patch(
          Uri.parse('$baseUrl/api/emprestimos/$id/devolver'),
          headers: await _getHeaders(),
          body: json.encode({'observacoes': notes}),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível registrar a devolução.',
        ),
      );
    }
  }

  Future<List<Map<String, dynamic>>> getVehicles() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(Uri.parse('$baseUrl/api/veiculos'), headers: await _getHeaders())
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar os veículos.',
        ),
      );
    }
    return _normalizeListResponse(_decodeResponseBody(response));
  }

  Future<void> deleteVehicle(String id, {required String reason}) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .delete(
          Uri.parse('$baseUrl/api/veiculos/$id'),
          headers: await _getHeaders(),
          body: json.encode({'motivo': reason}),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível excluir o veículo.',
        ),
      );
    }
  }

  Future<List<Map<String, dynamic>>> getNotifications() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(
          Uri.parse('$baseUrl/api/notificacoes'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 12));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar as notificações.',
        ),
      );
    }
    return _normalizeListResponse(_decodeResponseBody(response));
  }

  Future<void> markNotificationRead(String id) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .patch(
          Uri.parse('$baseUrl/api/notificacoes/$id/ler'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 12));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível atualizar a notificação.',
        ),
      );
    }
  }

  Future<void> markAllNotificationsRead() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .patch(
          Uri.parse('$baseUrl/api/notificacoes'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 12));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível atualizar as notificações.',
        ),
      );
    }
  }

  Future<void> updateAssetLabelStatus({
    required String assetId,
    required String action,
  }) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .patch(
          Uri.parse('$baseUrl/api/bens/$assetId/etiqueta'),
          headers: await _getHeaders(),
          body: json.encode({'action': action}),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível atualizar a etiqueta.',
        ),
      );
    }
  }

  Future<List<Map<String, dynamic>>> getProvisionalLabelLots() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(
          Uri.parse('$baseUrl/api/etiquetas-provisorias'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar os lotes de etiquetas.',
        ),
      );
    }
    return _normalizeListResponse(_decodeResponseBody(response));
  }

  Future<List<Map<String, dynamic>>> getProvisionalLotLabels(
    String lotId,
  ) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(
          Uri.parse('$baseUrl/api/etiquetas-provisorias?loteId=$lotId'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar as etiquetas deste lote.',
        ),
      );
    }
    return _normalizeListResponse(_decodeResponseBody(response));
  }

  Future<Map<String, dynamic>> reserveProvisionalLabels({
    required int quantity,
    required int year,
    int? startSequence,
    int? endSequence,
    String? observation,
    String? parliamentaryAmendment,
  }) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .post(
          Uri.parse('$baseUrl/api/etiquetas-provisorias'),
          headers: await _getHeaders(),
          body: json.encode({
            'mode': startSequence == null ? 'automatico' : 'faixa',
            'quantidade': quantity,
            'ano': year.toString(),
            'observacao': observation,
            'emendaParlamentar': parliamentaryAmendment,
            ...?(startSequence == null
                ? null
                : {'seqInicial': startSequence, 'strict': true}),
            ...?(endSequence == null ? null : {'seqFinal': endSequence}),
          }),
        )
        .timeout(const Duration(seconds: 30));
    if (response.statusCode != 201) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível reservar as etiquetas.',
        ),
      );
    }
    return _decodeResponseBody(response) as Map<String, dynamic>;
  }

  Future<void> cancelProvisionalLabelLot(String lotId) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .patch(
          Uri.parse('$baseUrl/api/etiquetas-provisorias'),
          headers: await _getHeaders(),
          body: json.encode({'action': 'cancelar_saldo', 'loteId': lotId}),
        )
        .timeout(const Duration(seconds: 30));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível liberar o saldo deste lote.',
        ),
      );
    }
  }

  Future<List<Map<String, dynamic>>> getUsers() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(Uri.parse('$baseUrl/api/usuarios'), headers: await _getHeaders())
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar os usuários.',
        ),
      );
    }
    return _normalizeListResponse(_decodeResponseBody(response));
  }

  Future<List<ApiAccessKey>> getApiAccessKeys() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(Uri.parse('$baseUrl/api/chaves'), headers: await _getHeaders())
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar as chaves de integração.',
        ),
      );
    }
    return _normalizeListResponse(
      _decodeResponseBody(response),
    ).map(ApiAccessKey.fromJson).toList();
  }

  Future<String> createApiAccessKey(String name) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .post(
          Uri.parse('$baseUrl/api/chaves'),
          headers: await _getHeaders(),
          body: json.encode({'nome': name.trim()}),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível criar a chave de integração.',
        ),
      );
    }
    final result = _decodeResponseBody(response) as Map<String, dynamic>;
    final key = result['key']?.toString();
    if (key == null || key.isEmpty) {
      throw Exception('O servidor não retornou a nova chave.');
    }
    return key;
  }

  Future<void> revokeApiAccessKey(String id) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .delete(
          Uri.parse('$baseUrl/api/chaves/$id'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível revogar esta chave.',
        ),
      );
    }
  }

  Future<SystemAdminSettings> getSystemAdminSettings() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(
          Uri.parse('$baseUrl/api/configuracoes/sistema'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar as configurações do sistema.',
        ),
      );
    }
    return SystemAdminSettings.fromJson(
      _decodeResponseBody(response) as Map<String, dynamic>,
    );
  }

  Future<void> saveSystemAdminSettings(SystemAdminSettings settings) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .put(
          Uri.parse('$baseUrl/api/configuracoes/sistema'),
          headers: await _getHeaders(),
          body: json.encode(settings.toJson()),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível salvar as configurações do sistema.',
        ),
      );
    }
  }

  Future<BackupSchedule> getBackupSchedule() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(
          Uri.parse('$baseUrl/api/configuracoes/backup'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar o agendamento de backup.',
        ),
      );
    }
    return BackupSchedule.fromJson(
      _decodeResponseBody(response) as Map<String, dynamic>,
    );
  }

  Future<void> saveBackupSchedule(BackupSchedule schedule) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .put(
          Uri.parse('$baseUrl/api/configuracoes/backup'),
          headers: await _getHeaders(),
          body: json.encode(schedule.toJson()),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível salvar o agendamento de backup.',
        ),
      );
    }
  }

  Future<List<BackupFileInfo>> getBackupFiles() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(
          Uri.parse('$baseUrl/api/configuracoes/backup/list'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar a lista de backups.',
        ),
      );
    }
    return _normalizeListResponse(
      _decodeResponseBody(response),
    ).map(BackupFileInfo.fromJson).toList();
  }

  Future<void> saveUser({
    String? id,
    required Map<String, dynamic> data,
  }) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse(
      id == null ? '$baseUrl/api/usuarios' : '$baseUrl/api/usuarios/$id',
    );
    final response = id == null
        ? await http.post(
            uri,
            headers: await _getHeaders(),
            body: json.encode(data),
          )
        : await http.put(
            uri,
            headers: await _getHeaders(),
            body: json.encode(data),
          );
    if (response.statusCode != (id == null ? 201 : 200)) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível salvar o usuário.',
        ),
      );
    }
  }

  Future<void> setUserActive({required String id, required bool active}) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .patch(
          Uri.parse('$baseUrl/api/usuarios/$id'),
          headers: await _getHeaders(),
          body: json.encode({'ativo': active}),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível atualizar o acesso deste usuário.',
        ),
      );
    }
  }

  Future<void> deleteUser(String id) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .delete(
          Uri.parse('$baseUrl/api/usuarios/$id'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível excluir este usuário.',
        ),
      );
    }
  }

  Future<dynamic> getReport(String type) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(
          Uri.parse(
            '$baseUrl/api/relatorios',
          ).replace(queryParameters: {'tipo': type}),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível gerar o relatório.',
        ),
      );
    }
    return _decodeResponseBody(response);
  }

  Future<Map<String, dynamic>> getDashboardStats({
    bool unitOnly = false,
  }) async {
    final baseUrl = await _getBaseUrl();
    var uri = Uri.parse('$baseUrl/api/dashboard/stats');
    if (unitOnly) {
      uri = uri.replace(queryParameters: const {'unidade': 'true'});
    }
    final response = await http
        .get(uri, headers: await _getHeaders())
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar o painel de patrimônio.',
        ),
      );
    }
    final decoded = _decodeResponseBody(response);
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Resposta inválida ao carregar o painel.');
    }
    return decoded;
  }

  Future<Map<String, dynamic>> getPendingAssets() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(
          Uri.parse(
            '$baseUrl/api/pendencias',
          ).replace(queryParameters: const {'page': '1', 'limit': '100'}),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar as pendências patrimoniais.',
        ),
      );
    }
    final decoded = _decodeResponseBody(response);
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Resposta inválida ao carregar as pendências.');
    }
    return decoded;
  }

  Future<List<Map<String, dynamic>>> getAlienations() async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(Uri.parse('$baseUrl/api/alienacoes'), headers: await _getHeaders())
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar os processos de alienação.',
        ),
      );
    }
    final decoded = _decodeResponseBody(response);
    if (decoded is! List) {
      throw Exception('Resposta inválida ao carregar as alienações.');
    }
    return decoded
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  Future<Map<String, dynamic>> getAlienation(String id) async {
    final baseUrl = await _getBaseUrl();
    final response = await http
        .get(
          Uri.parse('$baseUrl/api/alienacoes/$id'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível abrir o processo de alienação.',
        ),
      );
    }
    final decoded = _decodeResponseBody(response);
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Resposta inválida ao carregar o processo.');
    }
    return decoded;
  }

  Future<void> createAlienation(Map<String, dynamic> data) async {
    final uri = Uri.parse('${await _getBaseUrl()}/api/alienacoes');
    final response = await http
        .post(uri, headers: await _getHeaders(), body: json.encode(data))
        .timeout(const Duration(seconds: 30));
    if (response.statusCode != 201) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível abrir o processo de alienação.',
        ),
      );
    }
  }

  Future<void> concludeAlienation(String id, Map<String, dynamic> data) async {
    final uri = Uri.parse('${await _getBaseUrl()}/api/alienacoes/$id');
    final response = await http
        .put(
          uri,
          headers: await _getHeaders(),
          body: json.encode({...data, 'concluir': true}),
        )
        .timeout(const Duration(seconds: 30));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível concluir a alienação.',
        ),
      );
    }
  }

  Future<void> addAlienationAsset(String alienationId, String assetId) async {
    final uri = Uri.parse(
      '${await _getBaseUrl()}/api/alienacoes/$alienationId/itens',
    );
    final response = await http
        .post(
          uri,
          headers: await _getHeaders(),
          body: json.encode({'bem_id': int.tryParse(assetId)}),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível vincular o bem.',
        ),
      );
    }
  }

  Future<void> removeAlienationAsset(
    String alienationId,
    String assetId,
  ) async {
    final uri = Uri.parse(
      '${await _getBaseUrl()}/api/alienacoes/$alienationId/itens',
    ).replace(queryParameters: {'bemId': assetId});
    final response = await http
        .delete(uri, headers: await _getHeaders())
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível remover o bem.',
        ),
      );
    }
  }

  Future<void> deleteAlienation(String id) async {
    final response = await http
        .delete(
          Uri.parse('${await _getBaseUrl()}/api/alienacoes/$id'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível excluir o processo.',
        ),
      );
    }
  }

  Future<void> updateAlienation(String id, Map<String, dynamic> data) async {
    final response = await http
        .put(
          Uri.parse('${await _getBaseUrl()}/api/alienacoes/$id'),
          headers: await _getHeaders(),
          body: json.encode(data),
        )
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível atualizar o processo.',
        ),
      );
    }
  }

  Future<Map<String, dynamic>> getAuditLogs({
    int page = 1,
    String? search,
    String? action,
    String? user,
    String? startDate,
    String? endDate,
    int limit = 50,
  }) async {
    final baseUrl = await _getBaseUrl();
    final query = <String, String>{
      'page': '$page',
      'limit': '${limit.clamp(1, 100)}',
    };
    if (search != null && search.trim().isNotEmpty) {
      query['busca'] = search.trim();
    }
    if (action != null && action.trim().isNotEmpty) {
      query['acao'] = action.trim();
    }
    if (user != null && user.trim().isNotEmpty) {
      query['usuario'] = user.trim();
    }
    if (startDate != null) query['dataInicio'] = startDate;
    if (endDate != null) query['dataFim'] = endDate;
    final response = await http
        .get(
          Uri.parse('$baseUrl/api/logs').replace(queryParameters: query),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível carregar o histórico de auditoria.',
        ),
      );
    }
    final decoded = _decodeResponseBody(response);
    if (decoded is! Map<String, dynamic> || decoded['data'] is! List) {
      throw Exception('Resposta inválida ao carregar o histórico.');
    }
    return decoded;
  }

  // --- EDIT ---

  Future<bool> updateAsset(String id, Map<String, dynamic> data) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/bens/$id');

    try {
      final headers = await _getHeaders();
      final response = await http.put(
        uri,
        headers: headers,
        body: json.encode(data),
      );

      if (response.statusCode != 200) {
        _debugLog('Erro API (${response.statusCode}): ${response.body}');
      }

      return response.statusCode == 200;
    } catch (e) {
      _debugLog('Erro ao atualizar bem: $e');
      return false;
    }
  }

  // --- CREATE ---

  Future<dynamic> createAsset(Map<String, dynamic> data) async {
    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/bens');

    try {
      final headers = await _getHeaders();
      final response = await http.post(
        uri,
        headers: headers,
        body: json.encode(data),
      );

      if (response.statusCode != 201) {
        _debugLog('Erro API (${response.statusCode}): ${response.body}');
        try {
          final errorData = json.decode(utf8.decode(response.bodyBytes));
          return errorData['error'] ?? 'Erro desconhecido ao criar bem';
        } catch (_) {
          return 'Erro ao criar bem: ${response.statusCode}';
        }
      }

      return true;
    } catch (e) {
      _debugLog('Erro ao criar bem: $e');
      return 'Erro de conexão: $e';
    }
  }

  Future<Map<String, dynamic>> createAssetsBatch(
    List<Map<String, dynamic>> assets,
  ) async {
    if (assets.isEmpty) throw ArgumentError('A lista de bens está vazia.');
    final uri = Uri.parse('${await _getBaseUrl()}/api/bens');
    final response = await http
        .post(uri, headers: await _getHeaders(), body: json.encode(assets))
        .timeout(const Duration(seconds: 90));
    dynamic decoded;
    try {
      decoded = _decodeResponseBody(response);
    } catch (_) {
      decoded = null;
    }
    if (response.statusCode != 201) {
      final message = decoded is Map<String, dynamic>
          ? decoded['error']?.toString()
          : null;
      final conflictCode = decoded is Map<String, dynamic>
          ? decoded['conflictingCode']?.toString()
          : null;
      final itemIndex = decoded is Map<String, dynamic>
          ? int.tryParse(decoded['itemIndex']?.toString() ?? '')
          : null;
      final details = [
        if (message != null && message.isNotEmpty) message,
        if (conflictCode != null && conflictCode.isNotEmpty)
          'Patrimônio em conflito: $conflictCode${itemIndex == null ? '' : ' (item ${itemIndex + 1})'}.',
        if (message == null || message.isEmpty)
          'A API recusou o lote (HTTP ${response.statusCode}).',
      ].join('\n');
      throw Exception(details);
    }
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Resposta inválida ao cadastrar os bens da nota.');
    }
    return decoded;
  }

  // --- SERVIDORES ---

  Future<List<Map<String, dynamic>>> getServidores({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh &&
        _cachedServidores != null &&
        _cachedServidores!.isNotEmpty) {
      return _cachedServidores!;
    }

    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/servidores');
    final data = await _fetchCatalog(uri, name: 'os servidores');
    _cachedServidores = data;
    return data;
  }

  // --- FORNECEDORES ---

  Future<List<Map<String, dynamic>>> getFornecedores({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh &&
        _cachedFornecedores != null &&
        _cachedFornecedores!.isNotEmpty) {
      return _cachedFornecedores!;
    }

    final baseUrl = await _getBaseUrl();
    final uri = Uri.parse('$baseUrl/api/fornecedores');
    final data = await _fetchCatalog(uri, name: 'os fornecedores');
    _cachedFornecedores = data;
    return data;
  }

  Future<void> createFornecedor(Map<String, dynamic> supplier) async {
    final baseUrl = await _getBaseUrl();
    final response = await http.post(
      Uri.parse('$baseUrl/api/mobile/fornecedores'),
      headers: await _getHeaders(),
      body: json.encode(supplier),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível cadastrar o fornecedor.',
        ),
      );
    }
    _cachedFornecedores = null;
  }

  Future<void> updateFornecedor({
    required String id,
    required Map<String, dynamic> supplier,
  }) async {
    final baseUrl = await _getBaseUrl();
    final response = await http.put(
      Uri.parse('$baseUrl/api/mobile/fornecedores/$id'),
      headers: await _getHeaders(),
      body: json.encode(supplier),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível atualizar o fornecedor.',
        ),
      );
    }
    _cachedFornecedores = null;
  }

  Future<void> deleteFornecedor(String id) async {
    final baseUrl = await _getBaseUrl();
    final response = await http.delete(
      Uri.parse('$baseUrl/api/mobile/fornecedores/$id'),
      headers: await _getHeaders(),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível excluir o fornecedor.',
        ),
      );
    }
    _cachedFornecedores = null;
  }

  Future<void> createAuxiliaryCatalogItem({
    required String catalog,
    required String name,
  }) async {
    const endpoints = {
      'categorias': 'categorias',
      'marcas': 'marcas',
      'secretarias': 'secretarias',
    };
    final endpoint = endpoints[catalog];
    if (endpoint == null) throw ArgumentError.value(catalog, 'catalog');
    final response = await http
        .post(
          Uri.parse('${await _getBaseUrl()}/api/$endpoint'),
          headers: await _getHeaders(),
          body: json.encode({'nome': name.trim()}),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível cadastrar o item.',
        ),
      );
    }
    switch (catalog) {
      case 'categorias':
        _cachedCategorias = null;
      case 'marcas':
        _cachedMarcas = null;
      case 'secretarias':
        _cachedSecretarias = null;
    }
  }

  Future<void> createAuxiliaryLocationChild({
    required String parentCatalog,
    required String parentId,
    required String name,
  }) async {
    final path = switch (parentCatalog) {
      'secretarias' => 'secretarias/$parentId/departamentos',
      'departamentos' => 'departamentos/$parentId/salas',
      _ => throw ArgumentError.value(parentCatalog, 'parentCatalog'),
    };
    final response = await http
        .post(
          Uri.parse('${await _getBaseUrl()}/api/$path'),
          headers: await _getHeaders(),
          body: json.encode({'nome': name.trim()}),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível cadastrar o local.',
        ),
      );
    }
    _invalidateAuxiliaryCatalogCache(parentCatalog);
  }

  Future<void> updateAuxiliaryCatalogItem({
    required String catalog,
    required String id,
    required String name,
  }) async {
    const endpoints = {
      'categorias': 'categorias',
      'marcas': 'marcas',
      'secretarias': 'secretarias',
      'departamentos': 'departamentos',
      'salas': 'salas',
    };
    final endpoint = endpoints[catalog];
    if (endpoint == null) throw ArgumentError.value(catalog, 'catalog');
    final response = await http
        .put(
          Uri.parse('${await _getBaseUrl()}/api/$endpoint/$id'),
          headers: await _getHeaders(),
          body: json.encode({'nome': name.trim()}),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível atualizar o item.',
        ),
      );
    }
    _invalidateAuxiliaryCatalogCache(catalog);
  }

  Future<void> deleteAuxiliaryCatalogItem({
    required String catalog,
    required String id,
  }) async {
    const endpoints = {
      'categorias': 'categorias',
      'marcas': 'marcas',
      'secretarias': 'secretarias',
      'departamentos': 'departamentos',
      'salas': 'salas',
    };
    final endpoint = endpoints[catalog];
    if (endpoint == null) throw ArgumentError.value(catalog, 'catalog');
    final response = await http
        .delete(
          Uri.parse('${await _getBaseUrl()}/api/$endpoint/$id'),
          headers: await _getHeaders(),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _parseErrorMessage(
          response,
          fallback: 'Não foi possível excluir o item.',
        ),
      );
    }
    _invalidateAuxiliaryCatalogCache(catalog);
  }

  void _invalidateAuxiliaryCatalogCache(String catalog) {
    switch (catalog) {
      case 'categorias':
        _cachedCategorias = null;
      case 'marcas':
        _cachedMarcas = null;
      case 'secretarias' || 'departamentos' || 'salas':
        _cachedSecretarias = null;
    }
  }

  // --- SYNC ---

  Future<void> syncAllData({Function(String, double)? onProgress}) async {
    try {
      int totalSteps = 6;
      int currentStep = 0;

      void updateProgress(String message) {
        currentStep++;
        if (onProgress != null) {
          onProgress(message, currentStep / totalSteps);
        }
      }

      // 1. Categorias
      await getCategorias(forceRefresh: true);
      updateProgress('Sincronizando categorias...');

      // 2. Grupos
      await getGrupos(forceRefresh: true);
      updateProgress('Sincronizando grupos...');

      // 3. Marcas
      await getMarcas(forceRefresh: true);
      updateProgress('Sincronizando marcas...');

      // 4. Secretarias
      await getSecretarias(forceRefresh: true);
      updateProgress('Sincronizando locais...');

      // 5. Servidores
      await getServidores(forceRefresh: true);
      updateProgress('Sincronizando servidores...');

      // 6. Fornecedores
      await getFornecedores(forceRefresh: true);
      updateProgress('Sincronizando fornecedores...');
    } catch (e) {
      _debugLog('Erro na sincronização: $e');
    }
  }

  // --- HELPERS ---

  Future<String?> getImageUrl(String? imagePath) async {
    if (imagePath == null || imagePath.isEmpty) return null;
    if (imagePath.startsWith('http')) return imagePath;

    final baseUrl = await _getBaseUrl();
    final cleanPath = imagePath.startsWith('/')
        ? imagePath.substring(1)
        : imagePath;
    final cleanBase = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;

    return '$cleanBase/$cleanPath';
  }
}
