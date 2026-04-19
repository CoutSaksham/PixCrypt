// PixCrypt - Image Encryption/Decryption Application
// Uses XOR encryption with 5 keys and pixel scrambling with quantum-generated values

let originalImageData = null;
let encryptedImageData = null;
let encryptionKeys = [];
let scrambleSeed = null;
let isScrambled = false;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const xorBtn = document.getElementById('xorBtn');
const scrambleBtn = document.getElementById('scrambleBtn');
const decryptBtn = document.getElementById('decryptBtn');
const originalCanvas = document.getElementById('originalCanvas');
const encryptedCanvas = document.getElementById('encryptedCanvas');
const decryptedCanvas = document.getElementById('decryptedCanvas');

const originalCtx = originalCanvas.getContext('2d');
const encryptedCtx = encryptedCanvas.getContext('2d');
const decryptedCtx = decryptedCanvas.getContext('2d');

// Event Listeners
fileInput.addEventListener('change', handleFileUpload);
xorBtn.addEventListener('click', handleXorEncryption);
scrambleBtn.addEventListener('click', handleScrambleEncryption);
decryptBtn.addEventListener('click', handleDecryption);

/**
 * Handle image file upload
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please upload a valid image file');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Set canvas dimensions
            originalCanvas.width = img.width;
            originalCanvas.height = img.height;
            encryptedCanvas.width = img.width;
            encryptedCanvas.height = img.height;
            decryptedCanvas.width = img.width;
            decryptedCanvas.height = img.height;

            // Draw original image
            originalCtx.drawImage(img, 0, 0);
            originalImageData = originalCtx.getImageData(0, 0, img.width, img.height);

            // Clear encrypted and decrypted canvases
            encryptedCtx.clearRect(0, 0, encryptedCanvas.width, encryptedCanvas.height);
            decryptedCtx.clearRect(0, 0, decryptedCanvas.width, decryptedCanvas.height);

            console.log('Image loaded successfully:', img.width, 'x', img.height);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Fetch quantum random numbers from ANU QRNG API
 */
async function getQuantumRandomNumbers(count) {
    try {
        const response = await fetch(`https://qrng.anu.edu.au/API/jsonI.php?length=${count}&type=uint8`);
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        } else {
            throw new Error('Quantum API failed');
        }
    } catch (error) {
        console.error('Quantum API error, using fallback:', error);
        // Fallback to crypto.getRandomValues
        const array = new Uint8Array(count);
        crypto.getRandomValues(array);
        return Array.from(array);
    }
}

/**
 * Generate quantum random seed (32-bit integer from 4 quantum bytes)
 */
async function getQuantumSeed() {
    const randomBytes = await getQuantumRandomNumbers(4);
    // Combine 4 bytes into a 32-bit integer
    const seed = (randomBytes[0] << 24) | (randomBytes[1] << 16) | 
                 (randomBytes[2] << 8) | randomBytes[3];
    return seed >>> 0; // Convert to unsigned 32-bit
}

/**
 * Seeded random number generator (for reproducible scrambling)
 */
function seededRandom(seed) {
    let state = seed;
    return function() {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

/**
 * Generate permutation array for pixel scrambling
 */
function generatePermutation(length, seed) {
    const rng = seededRandom(seed);
    const permutation = Array.from({ length }, (_, i) => i);
    
    // Fisher-Yates shuffle with seeded random
    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    
    return permutation;
}

/**
 * Apply XOR encryption with 5 keys
 */
function applyXOR(imageData, keys) {
    const data = new Uint8ClampedArray(imageData.data);
    
    // Apply XOR 5 times with different keys
    for (let round = 0; round < 5; round++) {
        const key = keys[round];
        for (let i = 0; i < data.length; i += 4) {
            // XOR RGB channels (skip alpha)
            data[i] ^= key;     // R
            data[i + 1] ^= key; // G
            data[i + 2] ^= key; // B
            // data[i + 3] is alpha, keep unchanged
        }
    }
    
    return data;
}

/**
 * Scramble pixels using permutation
 */
function scramblePixels(imageData, permutation) {
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);
    const scrambled = new Uint8ClampedArray(data.length);
    
    const totalPixels = width * height;
    
    for (let i = 0; i < totalPixels; i++) {
        const srcIdx = i * 4;
        const dstIdx = permutation[i] * 4;
        
        // Copy RGBA values
        scrambled[dstIdx] = data[srcIdx];
        scrambled[dstIdx + 1] = data[srcIdx + 1];
        scrambled[dstIdx + 2] = data[srcIdx + 2];
        scrambled[dstIdx + 3] = data[srcIdx + 3];
    }
    
    return scrambled;
}

/**
 * Unscramble pixels (inverse permutation)
 */
function unscramblePixels(imageData, permutation) {
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);
    const unscrambled = new Uint8ClampedArray(data.length);
    
    const totalPixels = width * height;
    
    for (let i = 0; i < totalPixels; i++) {
        const srcIdx = permutation[i] * 4;
        const dstIdx = i * 4;
        
        // Copy RGBA values
        unscrambled[dstIdx] = data[srcIdx];
        unscrambled[dstIdx + 1] = data[srcIdx + 1];
        unscrambled[dstIdx + 2] = data[srcIdx + 2];
        unscrambled[dstIdx + 3] = data[srcIdx + 3];
    }
    
    return unscrambled;
}

/**
 * Save encryption keys to file
 */
function saveKeysToFile(keys, seed, scrambled) {
    const keyData = {
        xorKeys: keys,
        scrambleSeed: seed,
        isScrambled: scrambled,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'encryption_keys.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Keys saved:', keyData);
}

/**
 * Load encryption keys from file
 */
function loadKeysFromFile() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) {
                reject(new Error('No file selected'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const keyData = JSON.parse(event.target.result);
                    resolve(keyData);
                } catch (error) {
                    reject(new Error('Invalid key file'));
                }
            };
            reader.onerror = () => reject(new Error('File read error'));
            reader.readAsText(file);
        };
        
        input.click();
    });
}

/**
 * Handle XOR-only encryption
 */
async function handleXorEncryption() {
    if (!originalImageData) {
        alert('Please upload an image first');
        return;
    }

    try {
        xorBtn.disabled = true;
        xorBtn.textContent = 'Generating quantum keys...';

        // Generate 5 quantum random keys
        encryptionKeys = await getQuantumRandomNumbers(5);
        scrambleSeed = null;
        isScrambled = false;

        console.log('XOR Keys:', encryptionKeys);

        // Apply XOR encryption
        const encryptedData = applyXOR(originalImageData, encryptionKeys);

        // Create encrypted image data
        encryptedImageData = new ImageData(
            encryptedData,
            originalImageData.width,
            originalImageData.height
        );

        // Display encrypted image
        encryptedCtx.putImageData(encryptedImageData, 0, 0);

        // Save keys to file
        saveKeysToFile(encryptionKeys, null, false);

        alert('Image encrypted with XOR only! Keys saved to file.');
    } catch (error) {
        console.error('Encryption error:', error);
        alert('Encryption failed: ' + error.message);
    } finally {
        xorBtn.disabled = false;
        xorBtn.textContent = 'Encrypt using XOR';
    }
}

/**
 * Handle XOR + Scramble encryption
 */
async function handleScrambleEncryption() {
    if (!originalImageData) {
        alert('Please upload an image first');
        return;
    }

    try {
        scrambleBtn.disabled = true;
        scrambleBtn.textContent = 'Generating quantum keys...';

        // Generate 5 quantum random XOR keys
        encryptionKeys = await getQuantumRandomNumbers(5);
        
        scrambleBtn.textContent = 'Generating quantum seed...';
        
        // Generate quantum random seed for scrambling
        scrambleSeed = await getQuantumSeed();
        isScrambled = true;

        console.log('XOR Keys:', encryptionKeys);
        console.log('Scramble Seed:', scrambleSeed);

        // Step 1: Apply XOR encryption
        const xoredData = applyXOR(originalImageData, encryptionKeys);
        
        const xoredImageData = new ImageData(
            xoredData,
            originalImageData.width,
            originalImageData.height
        );

        // Step 2: Scramble pixels
        scrambleBtn.textContent = 'Scrambling pixels...';
        
        const totalPixels = originalImageData.width * originalImageData.height;
        const permutation = generatePermutation(totalPixels, scrambleSeed);
        const scrambledData = scramblePixels(xoredImageData, permutation);

        // Create encrypted image data
        encryptedImageData = new ImageData(
            scrambledData,
            originalImageData.width,
            originalImageData.height
        );

        // Display encrypted image
        encryptedCtx.putImageData(encryptedImageData, 0, 0);

        // Save keys to file
        saveKeysToFile(encryptionKeys, scrambleSeed, true);

        alert('Image encrypted with XOR + Scrambling! Keys saved to file.');
    } catch (error) {
        console.error('Encryption error:', error);
        alert('Encryption failed: ' + error.message);
    } finally {
        scrambleBtn.disabled = false;
        scrambleBtn.textContent = 'Encrypt using Scrambling';
    }
}

/**
 * Handle decryption
 */
async function handleDecryption() {
    if (!encryptedImageData) {
        alert('Please encrypt an image first, or no encrypted image available');
        return;
    }

    try {
        decryptBtn.disabled = true;
        decryptBtn.textContent = 'Loading keys...';

        // Load keys from file
        const keyData = await loadKeysFromFile();
        
        console.log('Loaded keys:', keyData);

        decryptBtn.textContent = 'Decrypting...';

        let decryptedData = new Uint8ClampedArray(encryptedImageData.data);

        // Step 1: Unscramble if needed
        if (keyData.isScrambled && keyData.scrambleSeed !== null) {
            const totalPixels = encryptedImageData.width * encryptedImageData.height;
            const permutation = generatePermutation(totalPixels, keyData.scrambleSeed);
            
            const tempImageData = new ImageData(
                decryptedData,
                encryptedImageData.width,
                encryptedImageData.height
            );
            
            decryptedData = unscramblePixels(tempImageData, permutation);
        }

        // Step 2: Apply XOR decryption (XOR is reversible)
        const tempImageData = new ImageData(
            decryptedData,
            encryptedImageData.width,
            encryptedImageData.height
        );
        
        decryptedData = applyXOR(tempImageData, keyData.xorKeys);

        // Create decrypted image data
        const decryptedImageData = new ImageData(
            decryptedData,
            encryptedImageData.width,
            encryptedImageData.height
        );

        // Display decrypted image
        decryptedCtx.putImageData(decryptedImageData, 0, 0);

        alert('Image decrypted successfully!');
    } catch (error) {
        console.error('Decryption error:', error);
        alert('Decryption failed: ' + error.message);
    } finally {
        decryptBtn.disabled = false;
        decryptBtn.textContent = 'Decrypt';
    }
}

// Initialize
console.log('PIXCRYPT initialized');
console.log('Upload an image to begin encryption/decryption');