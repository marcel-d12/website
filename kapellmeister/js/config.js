// Zentrale Einstellungen. proxyUrl zeigt auf den Cloudflare Worker, der den API-Schlüssel hält
// (siehe proxy/ANLEITUNG.md). Leer lassen, solange kein Proxy läuft: Dann fragt die App nach
// einem eigenen API-Schlüssel, der nur im Browser bleibt.
export const CONFIG = {
  proxyUrl: "",
  model: "claude-opus-5-5",
  maxTokens: 32000,
  soundFonts: {
    standard: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/",
    hochwertig: "https://paulrosen.github.io/midi-js-soundfonts/MusyngKite/",
  },
};
