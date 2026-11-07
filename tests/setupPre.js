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
