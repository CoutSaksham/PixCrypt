# PIXCRYPT

> Browser-based image encryption using XOR ciphers and pixel scrambling with quantum-generated or manually configured keys — no server, no uploads, fully client-side.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
  - [XOR Cipher](#xor-cipher)
  - [Scramble Mode](#scramble-mode)
  - [Decryption](#decryption)
  - [Key Files](#key-files)
- [Quantum Randomness](#quantum-randomness)
- [Manual Key Configuration](#manual-key-configuration)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [File Structure](#file-structure)
- [Technical Reference](#technical-reference)
  - [XOR Algorithm](#xor-algorithm)
  - [Pixel Scrambling](#pixel-scrambling)
  - [Seeded RNG](#seeded-rng)
  - [Key File Schema](#key-file-schema)
- [Security Considerations](#security-considerations)
- [Browser Compatibility](#browser-compatibility)
- [License](#license)

---

## Overview

PIXCRYPT is a client-side image encryption tool that runs entirely in the browser — no data ever leaves your machine. It encrypts images using two techniques: a multi-round XOR cipher applied to pixel colour channels, and a seeded Fisher-Yates pixel scramble that randomises the spatial arrangement of every pixel in the image. Both methods can be used independently or in combination. Encryption keys are sourced from the [ANU Quantum Random Number Generator](https://qrng.anu.edu.au/) by default, with a seamless fallback to the browser's built-in `crypto.getRandomValues` if the quantum API is unavailable. All parameters are also fully configurable by hand through the UI.

---

## Features

- **XOR encryption** — five successive bitwise XOR passes over RGB channels using independent keys
- **Pixel scrambling** — full spatial permutation of every pixel using a seeded shuffle
- **Quantum key generation** — keys and seeds sourced from a true quantum random number generator
- **Manual key configuration** — set all five XOR keys (0–255) and the scramble seed (2048–4096) via sliders in the UI
- **Portable key files** — encryption parameters exported as a JSON file; the same file is used for decryption
- **Three-panel live preview** — original, encrypted, and decrypted canvases update in real time
- **Fully client-side** — no server, no network requests for image data, no storage
- **Drag-and-drop upload** — supports PNG, JPG, BMP, and GIF

---

## How It Works

### XOR Cipher

XOR encryption works by performing a bitwise exclusive-OR between each pixel's colour value and a key byte. The same operation with the same key reverses it, making XOR inherently symmetric — the encryption and decryption functions are identical.

PIXCRYPT applies this in five rounds, each using a different key:

```
for each round (0 to 4):
    for each pixel:
        R = R XOR key[round]
        G = G XOR key[round]
        B = B XOR key[round]
        A = A (unchanged)
```

Using five independent keys across five passes increases diffusion — a single-byte key change in any round produces a completely different ciphertext. The alpha channel is left untouched so image transparency is preserved.

### Scramble Mode

Scramble mode applies XOR first, then rearranges every pixel in the image using a permutation derived from a seed value. The permutation is generated via a seeded Fisher-Yates shuffle, meaning the same seed always produces the same permutation, and therefore the same scrambled output.

```
Step 1 — XOR:     apply five-round XOR to all pixels
Step 2 — Shuffle: move each pixel to a new position defined by permutation[i]
```

The result is an image that is both chromatically and spatially randomised — pixels are individually distorted by XOR and their positions are completely rearranged.

### Decryption

Decryption is the exact inverse:

```
Step 1 — Unshuffle: restore each pixel to its original position using the inverse permutation
Step 2 — XOR:       apply the same five-round XOR to reverse the cipher (XOR is self-inverse)
```

The user is prompted to provide the key file generated during encryption. Without the correct key file, decryption is not possible.

### Key Files

Every encryption operation exports a `encryption_keys.json` file containing all parameters needed for decryption:

```json
{
  "xorKeys": [214, 87, 193, 41, 255],
  "scrambleSeed": 3721,
  "isScrambled": true,
  "timestamp": "2025-01-15T10:32:44.000Z"
}
```

Keep this file safe — it is the only way to decrypt an image encrypted with PIXCRYPT. The file format is identical whether keys were quantum-generated or manually configured.

---

## Quantum Randomness

By default, PIXCRYPT sources keys and seeds from the [ANU Quantum Random Number Generator](https://qrng.anu.edu.au/) — a service operated by the Australian National University that produces true random numbers by measuring quantum vacuum fluctuations. This is a physically random process, not a computational one, making the keys fundamentally unpredictable.

For XOR keys, five `uint8` values (0–255) are requested. For the scramble seed, four `uint8` values are requested and combined into a single 32-bit unsigned integer:

```js
seed = (byte[0] << 24) | (byte[1] << 16) | (byte[2] << 8) | byte[3]
```

This gives a seed range of **0 to 4,294,967,295**.

If the ANU API is unreachable (network error, CORS, downtime), PIXCRYPT automatically falls back to `crypto.getRandomValues`, which uses the operating system's cryptographically secure pseudorandom number generator. The fallback is silent — behaviour is identical from the user's perspective.

---

## Manual Key Configuration

Both the XOR keys and the scramble seed can be configured manually through the UI, bypassing the quantum API entirely.

**XOR Keys** — click `▾ MANUAL KEYS` below the XOR Cipher button to expand the panel. Enable the `USE MANUAL KEYS` toggle, then use the five sliders to set KEY 01 through KEY 05. Each accepts a value between **0 and 255**, displayed in both decimal and hexadecimal.

**Scramble Seed** — click `▾ MANUAL SEED` below the Scramble button. Enable the `USE MANUAL SEED` toggle and use the slider to set a value between **2048 and 4096**.

The two toggles are independent. You can use manual XOR keys with a quantum seed, a quantum seed with manual XOR keys, or fully manual across both. The resulting key file format is the same regardless.

> **Note:** Manual keys are suitable for testing and reproducible outputs. For security-sensitive use cases, quantum or system-random keys are strongly recommended.

---

## Getting Started

PIXCRYPT requires no build step, no package manager, and no dependencies. Clone the repo and open `index.html` directly in any modern browser.

```bash
git clone https://github.com/your-username/pixcrypt.git
cd pixcrypt
open index.html
```

Or serve it locally to avoid any file:// protocol restrictions with the quantum API:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Then open `http://localhost:8080` in your browser.

---

## Usage Guide

**Encrypting with XOR**

1. Click the upload zone or drag an image onto it
2. Optionally expand `▾ MANUAL KEYS` and enable manual key entry
3. Click **XOR CIPHER**
4. The encrypted image appears in the centre panel
5. A `encryption_keys.json` file is automatically downloaded — keep it

**Encrypting with Scramble**

1. Upload an image
2. Optionally configure manual XOR keys and/or a manual seed
3. Click **SCRAMBLE**
4. Both XOR and pixel shuffle are applied; the result appears in the centre panel
5. A `encryption_keys.json` file is downloaded with all parameters

**Decrypting**

1. Upload the encrypted image
2. Click **DECRYPT**
3. When prompted, select the `encryption_keys.json` file from the original encryption
4. The restored image appears in the right panel

> Decryption always reads from the `encryptedCanvas`. Make sure the encrypted image is loaded before clicking Decrypt.

---

## File Structure

```
pixcrypt/
├── index.html       # UI markup and inline UI logic
├── styles.css       # All visual styling
└── app.js           # Core encryption/decryption logic
```

All three files are self-contained vanilla JavaScript, HTML, and CSS with no external runtime dependencies. Google Fonts (Orbitron, Share Tech Mono) are loaded from a CDN for typography only.

---

## Technical Reference

### XOR Algorithm

```js
function applyXOR(imageData, keys) {
    const data = new Uint8ClampedArray(imageData.data);
    for (let round = 0; round < 5; round++) {
        const key = keys[round];
        for (let i = 0; i < data.length; i += 4) {
            data[i]     ^= key;  // R
            data[i + 1] ^= key;  // G
            data[i + 2] ^= key;  // B
            // data[i + 3] — alpha preserved
        }
    }
    return data;
}
```

The function is its own inverse: `applyXOR(applyXOR(data, keys), keys)` returns the original data.

### Pixel Scrambling

```js
function scramblePixels(imageData, permutation) {
    const scrambled = new Uint8ClampedArray(data.length);
    for (let i = 0; i < totalPixels; i++) {
        const srcIdx = i * 4;
        const dstIdx = permutation[i] * 4;
        scrambled[dstIdx..dstIdx+3] = data[srcIdx..srcIdx+3];
    }
    return scrambled;
}
```

Unscrambling applies the inverse mapping: `unscrambled[i] = scrambled[permutation[i]]`.

### Seeded RNG

The permutation is generated using a linear congruential generator seeded with the quantum seed value:

```js
function seededRandom(seed) {
    let state = seed;
    return function() {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}
```

The constants `1664525` and `1013904223` are the multiplier and increment from Knuth's LCG, commonly used for its speed and reasonable distribution properties.

### Key File Schema

```ts
{
  xorKeys:      number[];   // Array of exactly 5 integers, each 0–255
  scrambleSeed: number | null;  // 32-bit unsigned integer, or null if XOR-only
  isScrambled:  boolean;    // true if pixel scrambling was applied
  timestamp:    string;     // ISO 8601 datetime of encryption
}
```

---

## Security Considerations

PIXCRYPT is an educational and experimental tool. It is not intended as a production-grade security solution. Some important limitations to be aware of:

**XOR is not semantically secure.** With a known plaintext (the original image) and ciphertext (the encrypted image), the keys can be trivially recovered. PIXCRYPT's multi-round XOR does not address this.

**The scramble seed range in manual mode is small.** The slider is bounded to 2048–4096 (a range of 2049 values), which is trivially brute-forceable. Quantum-generated seeds span 32 bits (~4.3 billion values) and are far more appropriate for any real use.

**Key file security is your responsibility.** The `encryption_keys.json` file contains everything needed to decrypt the image. If that file is compromised, the encrypted image is not protected.

**All processing is in-memory in the browser.** Canvas data is accessible to any JavaScript running on the page. Do not use PIXCRYPT in environments where the page itself is untrusted.

---

## Browser Compatibility

PIXCRYPT uses standard browser APIs with broad support:

| Feature | Required API |
|---|---|
| Image rendering | `HTMLCanvasElement`, `CanvasRenderingContext2D` |
| Secure fallback RNG | `crypto.getRandomValues` |
| File I/O | `FileReader`, `Blob`, `URL.createObjectURL` |
| Quantum API | `fetch` (with CORS support from ANU) |

Tested and working in Chrome 120+, Firefox 121+, Safari 17+, and Edge 120+.

---

## License

MIT License — see `LICENSE` for details.
