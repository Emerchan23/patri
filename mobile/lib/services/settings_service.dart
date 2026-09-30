import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsService {
  static const String _keyServerUrl = 'server_url';

  static const String _defaultWebUrl = 'http://localhost:3005';
  static const String _defaultAndroidUrl = 'http://10.0.2.2:3005';
  static const List<String> _legacyUrls = [
    'http://localhost:3000',
    'http://10.0.2.2:3000',
  ];

  String get _defaultUrl => kIsWeb ? _defaultWebUrl : _defaultAndroidUrl;

  Future<String> getServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final storedValue = prefs.getString(_keyServerUrl)?.trim();

    if (storedValue == null || storedValue.isEmpty) {
      return _defaultUrl;
    }

    if (_legacyUrls.contains(storedValue)) {
      await prefs.setString(_keyServerUrl, _defaultUrl);
      return _defaultUrl;
    }

    return storedValue;
  }

  Future<void> setServerUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyServerUrl, url.trim());
  }
}
