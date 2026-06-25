// MVP cipher: XOR + base64, no native crypto needed (Expo Go compatible)
// Post-MVP: replace with react-native-quick-crypto in a dev client build
const KEY = process.env.EXPO_PUBLIC_ENCRYPTION_KEY ?? 'vive_mvp_key_2026';

function xorBase64(input: string, encode: boolean): string {
  // encodeURIComponent keeps all chars in ASCII range (0–127) before XOR
  const text = encode ? encodeURIComponent(input) : atob(input);
  const out = text
    .split('')
    .map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length)))
    .join('');
  return encode ? btoa(out) : decodeURIComponent(out);
}

export function encryptMessage(text: string): string {
  try {
    return xorBase64(text, true);
  } catch {
    return text;
  }
}

export function decryptMessage(encrypted: string): string {
  try {
    return xorBase64(encrypted, false);
  } catch {
    return encrypted;
  }
}
