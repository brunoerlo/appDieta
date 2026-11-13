// Pre-evaluate Expo winter lazy getters while still in setup phase,
// before Jest transitions to 'betweenTests'.
try {
  void globalThis.TextDecoderStream;
  void globalThis.TextEncoderStream;
  void globalThis.URL;
  void globalThis.URLSearchParams;
  void globalThis.DOMException;
  void globalThis.__ExpoImportMetaRegistry;
  void globalThis.structuredClone;
  void globalThis.fetch;
} catch (_) {}

process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://test-project.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY || 'test-publishable-key';
