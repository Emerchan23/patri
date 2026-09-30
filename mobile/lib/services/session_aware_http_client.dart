import 'dart:convert';

import 'package:http/http.dart' as http;

/// Small facade for the HTTP verbs used by ApiService.
///
/// A 401 from an authenticated request invalidates the local session. Public
/// probes and failed login attempts have no Cookie header and do not log the
/// user out.
class SessionAwareHttpClient {
  final http.Client _client;
  final void Function() onUnauthorized;

  SessionAwareHttpClient({http.Client? client, required this.onUnauthorized})
    : _client = client ?? http.Client();

  Future<http.Response> get(Uri url, {Map<String, String>? headers}) async =>
      _inspect(await _client.get(url, headers: headers), headers);

  Future<http.Response> post(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
    Encoding? encoding,
  }) async => _inspect(
    await _client.post(url, headers: headers, body: body, encoding: encoding),
    headers,
  );

  Future<http.Response> put(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
    Encoding? encoding,
  }) async => _inspect(
    await _client.put(url, headers: headers, body: body, encoding: encoding),
    headers,
  );

  Future<http.Response> patch(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
    Encoding? encoding,
  }) async => _inspect(
    await _client.patch(url, headers: headers, body: body, encoding: encoding),
    headers,
  );

  Future<http.Response> delete(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
    Encoding? encoding,
  }) async => _inspect(
    await _client.delete(url, headers: headers, body: body, encoding: encoding),
    headers,
  );

  http.Response _inspect(http.Response response, Map<String, String>? headers) {
    final hasSessionCookie =
        headers?.keys.any((key) => key.toLowerCase() == 'cookie') ?? false;
    if (response.statusCode == 401 && hasSessionCookie) onUnauthorized();
    return response;
  }
}
