import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sis_patrimonio_mobile/services/session_aware_http_client.dart';

void main() {
  test('401 invalidates only a request that carried an auth cookie', () async {
    var invalidations = 0;
    final client = SessionAwareHttpClient(
      client: MockClient((_) async => http.Response('', 401)),
      onUnauthorized: () => invalidations++,
    );
    final uri = Uri.parse('https://patrimonio.example/api/auth/me');

    await client.get(uri);
    expect(invalidations, 0);

    await client.get(uri, headers: {'Cookie': 'session=expired'});
    expect(invalidations, 1);
  });

  test('403 permission denial does not invalidate the session', () async {
    var invalidations = 0;
    final client = SessionAwareHttpClient(
      client: MockClient((_) async => http.Response('', 403)),
      onUnauthorized: () => invalidations++,
    );

    await client.get(
      Uri.parse('https://patrimonio.example/api/admin'),
      headers: {'Cookie': 'session=valid'},
    );

    expect(invalidations, 0);
  });
}
