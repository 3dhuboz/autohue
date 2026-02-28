const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');
const archiver = require('archiver');
const crypto = require('crypto');
const unzipper = require('unzipper');
const { createExtractorFromFile } = require('node-unrar-js');
const ort = require('onnxruntime-node');

const app = express();
const PORT = process.env.PORT || process.env.WORKER_PORT || 3001;

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');
const THUMB_DIR = path.join(__dirname, 'public', 'thumbs');

[UPLOAD_DIR, OUTPUT_DIR, THUMB_DIR].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

const sessions = {};

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════
// CAR COLOR DETECTION ENGINE v6
// SSD-MobileNet (fast car detection) + Nyckel cloud color classification
// Pipeline: detect car → crop body panels → send crop to Nyckel API
// Falls back to local LAB matching if Nyckel is unavailable
// ═══════════════════════════════════════════════════════════════════════════

// ─── Nyckel API configuration ───
const NYCKEL_CLIENT_ID = '7mwftjb0rytkq1z1e3ltdx9bb4juh1sm';
const NYCKEL_CLIENT_SECRET = 'xolvgwxwx90pmimmo3n8iak9cl3pzhip67m2f4kh5pw4xkpthw5eek3n3bivt7wf';
const NYCKEL_FUNCTION_ID = 'colors-identifier';
let nyckelToken = null;
let nyckelTokenExpiry = 0;

async function getNyckelToken() {
    // Return cached token if still valid (with 5 min buffer)
    if (nyckelToken && Date.now() < nyckelTokenExpiry - 300000) {
        return nyckelToken;
    }
    try {
        const res = await fetch('https://www.nyckel.com/connect/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=client_credentials&client_id=${NYCKEL_CLIENT_ID}&client_secret=${NYCKEL_CLIENT_SECRET}`
        });
        const data = await res.json();
        if (data.access_token) {
            nyckelToken = data.access_token;
            nyckelTokenExpiry = Date.now() + (data.expires_in * 1000);
            return nyckelToken;
        }
        console.error('Nyckel token error:', data);
        return null;
    } catch (err) {
        console.error('Nyckel token fetch failed:', err.message);
        return null;
    }
}

// Map Nyckel color labels to our folder categories
const NYCKEL_LABEL_MAP = {
    'red': 'red', 'Red': 'red',
    'blue': 'blue', 'Blue': 'blue',
    'green': 'green', 'Green': 'green',
    'yellow': 'yellow', 'Yellow': 'yellow',
    'orange': 'orange', 'Orange': 'orange',
    'purple': 'purple', 'Purple': 'purple',
    'pink': 'pink', 'Pink': 'pink',
    'brown': 'brown', 'Brown': 'brown',
    'black': 'black', 'Black': 'black',
    'white': 'white', 'White': 'white',
    'grey': 'silver-grey', 'Grey': 'silver-grey',
    'gray': 'silver-grey', 'Gray': 'silver-grey',
    'silver': 'silver-grey', 'Silver': 'silver-grey',
    'beige': 'brown', 'Beige': 'brown',
    'gold': 'yellow', 'Gold': 'yellow',
    'maroon': 'red', 'Maroon': 'red',
    'navy': 'blue', 'Navy': 'blue',
    'teal': 'blue', 'Teal': 'blue',
    'cyan': 'blue', 'Cyan': 'blue',
    'magenta': 'pink', 'Magenta': 'pink',
    'olive': 'green', 'Olive': 'green',
    'tan': 'brown', 'Tan': 'brown',
    'cream': 'white', 'Cream': 'white',
    'ivory': 'white', 'Ivory': 'white',
    'burgundy': 'red', 'Burgundy': 'red',
};

async function classifyWithNyckel(imageBuffer) {
    const token = await getNyckelToken();
    if (!token) return null;

    try {
        const b64 = 'data:image/jpeg;base64,' + imageBuffer.toString('base64');
        const res = await fetch(`https://www.nyckel.com/v1/functions/${NYCKEL_FUNCTION_ID}/invoke`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: b64 })
        });
        const data = await res.json();
        if (data.labelName) {
            const mapped = NYCKEL_LABEL_MAP[data.labelName] || NYCKEL_LABEL_MAP[data.labelName.toLowerCase()] || data.labelName.toLowerCase();
            return {
                category: mapped,
                nyckelLabel: data.labelName,
                confidence: data.confidence,
                labelId: data.labelId
            };
        }
        return null;
    } catch (err) {
        console.error('Nyckel invoke failed:', err.message);
        return null;
    }
}

// ─── ONNX Model: load once at startup ───
const MODEL_PATH = path.join(__dirname, 'models', 'ssd_mobilenet_v1_12.onnx');
let onnxSession = null;

// COCO class IDs for vehicles
const VEHICLE_CLASSES = [3, 4, 6, 8]; // car, motorcycle, bus, truck

async function loadModel() {
    try {
        onnxSession = await ort.InferenceSession.create(MODEL_PATH, {
            executionProviders: ['cpu'],
        });
        console.log('ONNX SSD-MobileNet loaded successfully');
    } catch (err) {
        console.error('Failed to load ONNX model:', err.message);
        console.error('Falling back to center-crop color detection');
    }
}

// ─── Run SSD-MobileNet to detect car bounding boxes ───
async function detectCars(image) {
    if (!onnxSession) return null;

    // Prepare input tensor: [1, 300, 300, 3] as uint8
    const resized = image.clone().resize(300, 300);
    const inputData = new Uint8Array(1 * 300 * 300 * 3);
    let i = 0;
    resized.scan(0, 0, 300, 300, function(x, y, idx) {
        inputData[i++] = this.bitmap.data[idx];     // R
        inputData[i++] = this.bitmap.data[idx + 1]; // G
        inputData[i++] = this.bitmap.data[idx + 2]; // B
    });

    const inputTensor = new ort.Tensor('uint8', inputData, [1, 300, 300, 3]);

    try {
        const results = await onnxSession.run({ images: inputTensor });

        const numDetections = results['num_detections'].data[0];
        const boxes = results['detection_boxes'].data;     // [N, 4]: top, left, bottom, right (0-1)
        const scores = results['detection_scores'].data;
        const classes = results['detection_classes'].data;

        // Find the best vehicle detection
        let bestBox = null, bestScore = 0;
        for (let d = 0; d < numDetections; d++) {
            const classId = Math.round(classes[d]);
            const score = scores[d];
            if (VEHICLE_CLASSES.includes(classId) && score > 0.3 && score > bestScore) {
                bestScore = score;
                bestBox = {
                    top: boxes[d * 4],
                    left: boxes[d * 4 + 1],
                    bottom: boxes[d * 4 + 2],
                    right: boxes[d * 4 + 3],
                    score, classId
                };
            }
        }

        return bestBox;
    } catch (err) {
        console.error('ONNX inference error:', err.message);
        return null;
    }
}

// ─── RGB → XYZ → LAB conversion (D65 illuminant) ───
function rgbToLab(r, g, b) {
    // sRGB to linear
    let rl = r / 255, gl = g / 255, bl = b / 255;
    rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
    gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
    bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

    // Linear RGB → XYZ (D65)
    let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
    let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.00000;
    let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

    const f = v => v > 0.008856 ? Math.pow(v, 1/3) : (7.787 * v) + 16/116;
    x = f(x); y = f(y); z = f(z);

    return {
        L: (116 * y) - 16,
        a: 500 * (x - y),
        b: 200 * (y - z)
    };
}

// ─── Delta-E 2000 (CIEDE2000) — perceptual color difference ───
function deltaE2000(lab1, lab2) {
    const { L: L1, a: a1, b: b1 } = lab1;
    const { L: L2, a: a2, b: b2 } = lab2;
    const rad = Math.PI / 180, deg = 180 / Math.PI;

    const C1 = Math.sqrt(a1*a1 + b1*b1);
    const C2 = Math.sqrt(a2*a2 + b2*b2);
    const mC = (C1 + C2) / 2;
    const mC7 = Math.pow(mC, 7);
    const G = 0.5 * (1 - Math.sqrt(mC7 / (mC7 + Math.pow(25, 7))));

    const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
    const C1p = Math.sqrt(a1p*a1p + b1*b1);
    const C2p = Math.sqrt(a2p*a2p + b2*b2);

    let h1p = Math.atan2(b1, a1p) * deg; if (h1p < 0) h1p += 360;
    let h2p = Math.atan2(b2, a2p) * deg; if (h2p < 0) h2p += 360;

    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp;
    if (C1p * C2p === 0) dhp = 0;
    else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
    else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
    else dhp = h2p - h1p + 360;

    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);

    const mLp = (L1 + L2) / 2;
    const mCp = (C1p + C2p) / 2;

    let mhp;
    if (C1p * C2p === 0) mhp = h1p + h2p;
    else if (Math.abs(h1p - h2p) <= 180) mhp = (h1p + h2p) / 2;
    else if (h1p + h2p < 360) mhp = (h1p + h2p + 360) / 2;
    else mhp = (h1p + h2p - 360) / 2;

    const T = 1
        - 0.17 * Math.cos((mhp - 30) * rad)
        + 0.24 * Math.cos(2 * mhp * rad)
        + 0.32 * Math.cos((3 * mhp + 6) * rad)
        - 0.20 * Math.cos((4 * mhp - 63) * rad);

    const SL = 1 + 0.015 * Math.pow(mLp - 50, 2) / Math.sqrt(20 + Math.pow(mLp - 50, 2));
    const SC = 1 + 0.045 * mCp;
    const SH = 1 + 0.015 * mCp * T;

    const mCp7 = Math.pow(mCp, 7);
    const RT = -2 * Math.sqrt(mCp7 / (mCp7 + Math.pow(25, 7)))
        * Math.sin(60 * rad * Math.exp(-Math.pow((mhp - 275) / 25, 2)));

    return Math.sqrt(
        Math.pow(dLp / SL, 2) +
        Math.pow(dCp / SC, 2) +
        Math.pow(dHp / SH, 2) +
        RT * (dCp / SC) * (dHp / SH)
    );
}

// ─── Reference car color palette (RGB + pre-computed LAB) ───
// ONLY visible, clearly-identifiable colors. NO dark/shadow variants.
// Dark pixels are handled by the chroma gate below, not by palette matching.
const CAR_COLORS_RGB = {
    'red': [
        [255,0,0],[220,30,30],[200,20,20],[240,40,40],[210,35,35],
        [180,20,20],[190,40,40],[170,25,25],[200,50,50],[185,30,30],
        [150,10,10],[140,20,15],[160,30,25],[145,15,12],[135,25,20],
        [130,0,0],[120,15,10],[110,10,5],[170,40,35],[155,25,20],
    ],
    'blue': [
        [0,0,180],[30,60,200],[0,100,255],[50,80,180],[0,50,150],
        [20,40,120],[0,70,200],[70,100,210],[25,55,170],[10,30,100],
        [0,0,120],[0,60,180],[40,70,160],[0,80,190],[60,90,200],
        // Teal / cyan (bright)
        [0,160,180],[0,180,200],[0,140,160],[20,170,190],[0,150,170],
        [0,200,220],[30,190,210],[0,130,150],[10,175,195],[0,120,140],
        // Dark teal / dark cyan (smoky/shadowed drift cars)
        [0,80,90],[0,100,110],[20,90,100],[0,70,80],[10,85,95],
        [0,60,70],[15,75,85],[0,110,125],[5,95,105],[0,65,75],
        // Turquoise / mint (like teal S14, HSV)
        [100,200,200],[80,180,185],[120,210,210],[90,190,195],[110,205,205],
        [70,170,175],[60,160,165],[130,215,215],[85,185,190],[75,175,180],
    ],
    'green': [
        [0,130,0],[30,150,50],[0,180,80],[50,160,50],[0,100,0],
        [20,120,40],[0,160,60],[40,140,30],[80,170,80],[10,90,10],
        [0,180,160],[0,160,140],[20,170,150],[0,150,130],[30,190,170],
        // Lime / yellow-greens
        [140,200,0],[120,180,0],[160,220,30],[100,170,0],[150,210,20],
        // Olive / khaki / army green (muted yellow-greens)
        [140,145,80],[130,135,70],[150,155,90],[120,125,60],[160,160,100],
        [145,150,85],[135,140,75],[125,130,65],[155,155,95],[115,120,55],
        // Dark olive / military green (shadowed conditions)
        [90,95,45],[80,85,35],[100,105,55],[85,90,40],[95,100,50],
        [75,80,30],[105,110,60],[110,115,65],[70,75,25],[88,92,42],
    ],
    'yellow': [
        [255,220,0],[230,200,0],[255,200,50],[200,180,0],[240,210,30],
        [220,190,10],[250,230,50],[210,185,20],[180,160,0],[255,240,80],
        // Warm yellows / gold
        [200,170,30],[190,160,20],[210,180,40],[180,150,10],[220,195,50],
    ],
    'orange': [
        [255,140,0],[240,120,20],[255,165,0],[220,100,10],[200,90,0],
        [230,110,15],[245,130,30],[210,95,5],[255,150,40],[190,80,0],
    ],
    'purple': [
        [100,0,150],[130,20,180],[80,0,120],[150,50,200],[60,0,100],
        [110,30,160],[90,10,140],[140,40,190],[70,0,110],[120,20,170],
        // Blue-purples / violet
        [90,30,190],[100,40,200],[80,25,170],[110,50,210],[85,20,160],
        [120,60,200],[130,70,210],[95,35,180],[105,45,195],[115,55,205],
        // Deep/vivid purple (like the purple Chevelle/ute)
        [100,20,160],[90,15,150],[80,10,140],[110,25,170],[120,30,180],
        [85,0,135],[75,0,125],[105,15,155],[95,10,145],[115,20,165],
        [70,20,130],[80,30,150],[90,35,160],[75,15,120],[65,10,110],
        // DARK purple (smoky conditions, shadows, rear views)
        [50,0,80],[45,5,75],[55,10,85],[40,0,65],[60,15,90],
        [35,0,55],[48,8,72],[52,12,82],[42,3,68],[58,10,88],
        [55,20,90],[50,15,80],[45,10,70],[60,25,95],[40,5,60],
        [65,15,100],[70,10,105],[55,5,85],[50,10,75],[45,0,65],
    ],
    'pink': [
        [255,105,180],[255,130,170],[240,100,150],[220,80,130],[255,150,200],
        [230,120,160],[250,90,140],[210,70,120],[255,170,210],[240,110,165],
    ],
    'brown': [
        [120,70,30],[100,55,20],[140,80,40],[85,45,15],[110,65,25],
        [130,75,35],[95,50,18],[150,90,50],[80,40,10],[115,60,28],
    ],
    'black': [
        [5,5,5],[10,10,10],[15,15,15],[20,20,20],[25,25,25],
        [30,30,30],[35,35,35],[28,28,30],[22,22,24],[18,18,20],
        // Dark with very slight tint (still black cars)
        [30,28,28],[28,30,30],[30,30,32],[25,25,28],[32,30,30],
        [35,33,33],[33,35,35],[35,35,38],[40,40,40],[38,38,40],
    ],
    'white': [
        [255,255,255],[250,250,250],[248,248,248],[245,245,245],[252,252,252],
        [240,238,235],[242,240,238],[238,236,232],[245,243,240],[235,233,230],
        [225,225,225],[220,220,220],[215,215,218],[210,210,212],[218,218,220],
        [205,205,208],[212,212,215],[222,222,225],[208,208,210],[215,214,216],
        [230,232,238],[228,230,235],[232,234,240],[226,228,232],[235,237,242],
    ],
    'silver-grey': [
        [150,150,155],[160,160,165],[170,170,172],[140,140,145],[155,155,158],
        [165,165,168],[175,175,178],[145,145,148],[180,180,182],[135,135,138],
        [100,100,105],[110,110,115],[120,120,125],[105,105,110],[115,115,118],
        [170,172,178],[165,168,175],[175,178,182],[160,163,170],[180,182,188],
        [190,190,192],[195,195,198],[185,185,188],[192,192,195],[188,188,190],
    ],
};

// Pre-compute LAB values for the reference palette
const CAR_COLORS_LAB = {};
for (const [category, rgbSamples] of Object.entries(CAR_COLORS_RGB)) {
    CAR_COLORS_LAB[category] = rgbSamples.map(([r, g, b]) => rgbToLab(r, g, b));
}

// ─── Classify an RGB color with chroma gate ───
// KEY INSIGHT: Dark, desaturated pixels are shadows/undercarriage, NOT car paint.
// They must be classified by lightness (black/grey), not by faint hue tint.
function classifyColorLab(r, g, b) {
    const lab = rgbToLab(r, g, b);
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);

    // CHROMA GATE: Only force achromatic match for truly grey/desaturated pixels.
    // Relaxed thresholds: dark purple (L~25,C~15) and dark teal must NOT be gated.
    const isLikelyShadow = (lab.L < 25 && chroma < 10) || (lab.L < 15 && chroma < 15);

    let bestCategory = 'unknown';
    let bestDist = Infinity;

    for (const [category, labSamples] of Object.entries(CAR_COLORS_LAB)) {
        // If this is a shadow pixel, only match against achromatic palettes
        if (isLikelyShadow && category !== 'black' && category !== 'silver-grey' && category !== 'white') {
            continue;
        }
        for (const ref of labSamples) {
            const d = deltaE2000(lab, ref);
            if (d < bestDist) {
                bestDist = d;
                bestCategory = category;
            }
        }
    }

    return { category: bestCategory, distance: bestDist };
}

// ─── Median-cut color quantization (faster + more accurate than k-means) ───
function medianCut(pixels, maxColors) {
    if (pixels.length === 0) return [];

    function getRange(bucket) {
        let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
        for (const [r, g, b] of bucket) {
            if (r < minR) minR = r; if (r > maxR) maxR = r;
            if (g < minG) minG = g; if (g > maxG) maxG = g;
            if (b < minB) minB = b; if (b > maxB) maxB = b;
        }
        return { rRange: maxR - minR, gRange: maxG - minG, bRange: maxB - minB };
    }

    function average(bucket) {
        let sr = 0, sg = 0, sb = 0;
        for (const [r, g, b] of bucket) { sr += r; sg += g; sb += b; }
        const n = bucket.length;
        return [Math.round(sr/n), Math.round(sg/n), Math.round(sb/n)];
    }

    let buckets = [pixels.slice()];

    while (buckets.length < maxColors) {
        // Find bucket with largest color range
        let maxRange = -1, splitIdx = 0;
        for (let i = 0; i < buckets.length; i++) {
            if (buckets[i].length < 2) continue;
            const { rRange, gRange, bRange } = getRange(buckets[i]);
            const range = Math.max(rRange, gRange, bRange);
            if (range > maxRange) { maxRange = range; splitIdx = i; }
        }
        if (maxRange <= 0) break;

        const bucket = buckets[splitIdx];
        const { rRange, gRange, bRange } = getRange(bucket);

        // Sort by the channel with the widest range
        let channel;
        if (rRange >= gRange && rRange >= bRange) channel = 0;
        else if (gRange >= rRange && gRange >= bRange) channel = 1;
        else channel = 2;

        bucket.sort((a, b) => a[channel] - b[channel]);
        const mid = Math.floor(bucket.length / 2);

        buckets.splice(splitIdx, 1, bucket.slice(0, mid), bucket.slice(mid));
    }

    return buckets
        .filter(b => b.length > 0)
        .map(b => ({ rgb: average(b), count: b.length, pct: b.length / pixels.length }))
        .sort((a, b) => b.count - a.count);
}

// ─── Get LAB chroma (colorfulness) of an RGB value ───
function getChroma(r, g, b) {
    const lab = rgbToLab(r, g, b);
    return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
}

// ─── Analyze the hero car color in an image ───
// Pipeline: SSD-MobileNet detects car → crop body panels → Nyckel classifies color
// Falls back to local LAB matching if Nyckel API is unavailable
async function analyzeImageColor(imagePath) {
    try {
        const image = await Jimp.read(imagePath);
        const w = image.getWidth(), h = image.getHeight();

        // ── Step 1: Detect car using SSD-MobileNet (fast: ~1s) ──
        const carBox = await detectCars(image);
        const aiDetected = carBox && carBox.score > 0.3;

        // ── Step 2: Crop to car body panels ──
        let cropped;
        if (aiDetected) {
            const boxH = carBox.bottom - carBox.top;
            const boxW = carBox.right - carBox.left;

            // Take upper 70% of box (skip bottom 30% = wheels/road)
            // Shrink sides 10% to cut background edges
            const cropTop = carBox.top + boxH * 0.03;
            const cropBottom = carBox.top + boxH * 0.70;
            const cropLeft = carBox.left + boxW * 0.10;
            const cropRight = carBox.right - boxW * 0.10;

            const cx = Math.max(0, Math.round(cropLeft * w));
            const cy = Math.max(0, Math.round(cropTop * h));
            const cw = Math.max(10, Math.min(Math.round((cropRight - cropLeft) * w), w - cx));
            const ch = Math.max(10, Math.min(Math.round((cropBottom - cropTop) * h), h - cy));

            cropped = image.clone().crop(cx, cy, cw, ch);
        } else {
            // Fallback: center crop
            const cx = Math.round(w * 0.15), cy = Math.round(h * 0.25);
            const cw = Math.round(w * 0.70), ch = Math.round(h * 0.55);
            cropped = image.clone().crop(cx, cy, Math.min(cw, w - cx), Math.min(ch, h - cy));
        }

        // Resize crop for sending to Nyckel (smaller = faster upload)
        cropped.resize(300, Jimp.AUTO).quality(80);
        const cropBuffer = await cropped.getBufferAsync(Jimp.MIME_JPEG);

        // ── Step 3: Run BOTH Nyckel cloud + local LAB in parallel ──
        const nyckelPromise = classifyWithNyckel(cropBuffer);

        // Local LAB classification (always run — needed for cross-check)
        const localCrop = cropped.clone().resize(120, Jimp.AUTO);
        const lcw = localCrop.getWidth(), lch = localCrop.getHeight();
        const pixels = [];
        localCrop.scan(0, 0, lcw, lch, function(x, y, idx) {
            const r = this.bitmap.data[idx], g = this.bitmap.data[idx+1], b = this.bitmap.data[idx+2];
            const brightness = (r + g + b) / 3;
            if (brightness > 253 || brightness < 2) return;
            pixels.push([r, g, b]);
        });

        let labResult = null;
        let allClusters = [];
        if (pixels.length >= 50) {
            const clusters = medianCut(pixels, 10);
            allClusters = clusters.map(c => {
                const { category, distance } = classifyColorLab(c.rgb[0], c.rgb[1], c.rgb[2]);
                const chroma = getChroma(c.rgb[0], c.rgb[1], c.rgb[2]);
                return { ...c, category, distance, chroma };
            });

            const scored = allClusters.map(c => {
                let score = c.pct * 100;
                if (c.pct > 0.10) score *= 1.5;
                if (c.pct > 0.20) score *= 1.5;
                if (c.pct > 0.35) score *= 1.5;
                if (c.distance < 10) score *= 2.5;
                else if (c.distance < 18) score *= 2.0;
                else if (c.distance < 28) score *= 1.3;
                else score *= 0.4;
                if (c.chroma > 25) score *= 1.15;
                return { ...c, score };
            }).sort((a, b) => b.score - a.score);

            const winner = scored[0];
            const top5 = scored.slice(0, Math.min(5, scored.length));
            const agreeing = top5.filter(c => c.category === winner.category).length;
            const hex = `#${winner.rgb.map(c => Math.max(0,Math.min(255,c)).toString(16).padStart(2,'0')).join('')}`;

            labResult = {
                rgb: winner.rgb, category: winner.category, hex, distance: winner.distance,
                chroma: winner.chroma, pct: winner.pct, agreeing, top5Count: top5.length,
                allScored: scored
            };
        }

        const nyckelResult = await nyckelPromise;

        // ── Step 4: Smart merge — Nyckel + LAB cross-check ──
        const ACHROMATIC = new Set(['black', 'white', 'silver-grey']);
        const CHROMATIC = new Set(['red','blue','green','yellow','orange','purple','pink','brown']);

        if (nyckelResult && nyckelResult.confidence > 0.3) {
            const nyckelCategory = nyckelResult.category;

            // If Nyckel says a CHROMATIC color → trust it
            if (CHROMATIC.has(nyckelCategory)) {
                return {
                    rgb: labResult ? labResult.rgb : [0,0,0],
                    category: nyckelCategory,
                    hex: labResult ? labResult.hex : '#000000',
                    confidence: nyckelResult.confidence > 0.7 ? 'high' : nyckelResult.confidence > 0.4 ? 'medium' : 'low',
                    nyckelLabel: nyckelResult.nyckelLabel,
                    nyckelConfidence: Math.round(nyckelResult.confidence * 100),
                    aiDetected, method: 'nyckel'
                };
            }

            // If Nyckel says ACHROMATIC → deep cross-check with ALL LAB clusters
            // Problem: dark purple, olive green, dark teal get called "black/grey" by Nyckel
            // Solution: search ALL clusters for any chromatic signal, not just the winner
            if (ACHROMATIC.has(nyckelCategory) && labResult && labResult.allScored) {
                // Find the BEST chromatic cluster (might not be the overall winner)
                const chromaticClusters = labResult.allScored.filter(c =>
                    CHROMATIC.has(c.category) && c.chroma > 8 && c.distance < 35 && c.pct > 0.03
                );

                if (chromaticClusters.length > 0) {
                    // Score chromatic clusters: weight chroma + size + palette match
                    const bestChromatic = chromaticClusters.sort((a, b) => {
                        const scoreA = a.chroma * 2 + a.pct * 100 + (35 - a.distance);
                        const scoreB = b.chroma * 2 + b.pct * 100 + (35 - b.distance);
                        return scoreB - scoreA;
                    })[0];

                    // Calculate total chromatic pixel coverage
                    const chromaticPct = chromaticClusters
                        .filter(c => c.category === bestChromatic.category)
                        .reduce((sum, c) => sum + c.pct, 0);

                    // Override if: meaningful chromatic presence (>5% of pixels)
                    // OR strong chroma signal (even small cluster of vivid color = car paint)
                    if (chromaticPct > 0.05 || bestChromatic.chroma > 20) {
                        const hex = `#${bestChromatic.rgb.map(c => Math.max(0,Math.min(255,c)).toString(16).padStart(2,'0')).join('')}`;
                        return {
                            rgb: bestChromatic.rgb,
                            category: bestChromatic.category,
                            hex,
                            confidence: bestChromatic.distance < 20 ? 'high' : 'medium',
                            deltaE: Math.round(bestChromatic.distance * 10) / 10,
                            nyckelLabel: nyckelResult.nyckelLabel,
                            nyckelOverridden: true,
                            chromaticPct: Math.round(chromaticPct * 100),
                            aiDetected, method: 'lab-override'
                        };
                    }
                }

                // No meaningful chromatic signal — both agree it's achromatic
                return {
                    rgb: labResult.rgb,
                    category: nyckelCategory,
                    hex: labResult.hex,
                    confidence: nyckelResult.confidence > 0.7 ? 'high' : 'medium',
                    nyckelLabel: nyckelResult.nyckelLabel,
                    nyckelConfidence: Math.round(nyckelResult.confidence * 100),
                    aiDetected, method: 'nyckel'
                };
            }
        }

        // ── Step 5: Nyckel failed — use local LAB only ──
        if (!labResult) {
            return { rgb: [128,128,128], category: 'unknown', hex: '#808080', confidence: 'none', method: 'none' };
        }

        let confidence = 'medium';
        if (labResult.distance < 18 && (labResult.agreeing >= 2 || labResult.pct > 0.12)) confidence = 'high';
        if (aiDetected && labResult.distance < 22) confidence = 'high';
        if (labResult.distance > 35 && labResult.agreeing < 2) confidence = 'low';

        return {
            rgb: labResult.rgb,
            category: labResult.category,
            hex: labResult.hex,
            confidence,
            regionsAgreeing: labResult.agreeing,
            totalRegions: labResult.top5Count,
            deltaE: Math.round(labResult.distance * 10) / 10,
            aiDetected, method: 'local-lab'
        };

    } catch (err) {
        console.error(`Error analyzing ${imagePath}:`, err.message, err.stack);
        return { rgb: [0,0,0], category: 'unknown', hex: '#000000', confidence: 'none' };
    }
}

// ─── Generate a small thumbnail for live preview ───
async function generateThumb(imagePath, sessionId, filename) {
    try {
        const thumbDir = path.join(THUMB_DIR, sessionId);
        fs.mkdirSync(thumbDir, { recursive: true });
        const thumbPath = path.join(thumbDir, filename.replace(/\.[^.]+$/, '.jpg'));
        const image = await Jimp.read(imagePath);
        await image.resize(120, Jimp.AUTO).quality(70).writeAsync(thumbPath);
        return `/thumbs/${sessionId}/${path.basename(thumbPath)}`;
    } catch {
        return null;
    }
}

// ─── Extract images from ZIP archive ───
async function extractZip(archivePath, destDir, session) {
    let count = 0;
    await new Promise((resolve, reject) => {
        fs.createReadStream(archivePath)
            .pipe(unzipper.Parse())
            .on('entry', (entry) => {
                const fileName = path.basename(entry.path);
                if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName) && !fileName.startsWith('.') && !fileName.startsWith('__')) {
                    count++;
                    session.currentFile = `Extracting: ${fileName} (${count} found)`;
                    // Handle duplicate names
                    let destName = fileName;
                    let c = 1;
                    while (fs.existsSync(path.join(destDir, destName))) {
                        const ext = path.extname(fileName);
                        destName = `${path.basename(fileName, ext)}_${c}${ext}`;
                        c++;
                    }
                    entry.pipe(fs.createWriteStream(path.join(destDir, destName)));
                } else {
                    entry.autodrain();
                }
            })
            .on('close', resolve)
            .on('error', reject);
    });
    return count;
}

// ─── Extract images from RAR archive ───
async function extractRar(archivePath, destDir, session) {
    let count = 0;
    try {
        const extractor = await createExtractorFromFile({ filepath: archivePath });
        const list = extractor.extract();
        const files = [...list.files];
        for (const file of files) {
            if (file.fileHeader.flags.directory) continue;
            const fileName = path.basename(file.fileHeader.name);
            if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName) && !fileName.startsWith('.')) {
                if (file.extraction) {
                    count++;
                    session.currentFile = `Extracting: ${fileName} (${count} found)`;
                    let destName = fileName;
                    let c = 1;
                    while (fs.existsSync(path.join(destDir, destName))) {
                        const ext = path.extname(fileName);
                        destName = `${path.basename(fileName, ext)}_${c}${ext}`;
                        c++;
                    }
                    fs.writeFileSync(path.join(destDir, destName), Buffer.from(file.extraction));
                }
            }
        }
    } catch (err) {
        console.error('RAR extraction error:', err.message);
    }
    return count;
}

// ─── Collect image files from a directory ───
function collectImageFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => !f.startsWith('.') && !f.startsWith('__') && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f))
        .map(f => path.join(dir, f));
}

// ─── Process all images in a session ───
async function processSession(sessionId) {
    const session = sessions[sessionId];
    if (!session) return;

    const uploadDir = path.join(UPLOAD_DIR, sessionId);
    const extractDir = path.join(uploadDir, '_extracted');
    const outputDir = path.join(OUTPUT_DIR, sessionId);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(extractDir, { recursive: true });

    // Phase 1: Extract archives
    const archiveFiles = fs.readdirSync(uploadDir).filter(f => /\.(zip|rar)$/i.test(f));
    if (archiveFiles.length > 0) {
        session.status = 'extracting';
        session.currentFile = 'Starting extraction...';
        console.log(`[${sessionId}] Extracting ${archiveFiles.length} archive(s)...`);
        for (const archive of archiveFiles) {
            const archivePath = path.join(uploadDir, archive);
            try {
                if (/\.zip$/i.test(archive)) {
                    await extractZip(archivePath, extractDir, session);
                } else if (/\.rar$/i.test(archive)) {
                    await extractRar(archivePath, extractDir, session);
                }
                console.log(`[${sessionId}] Extracted: ${archive}`);
            } catch (err) {
                console.error(`[${sessionId}] Failed to extract ${archive}:`, err.message);
            }
        }
    }

    // Phase 2: Collect all image files
    const files = [
        ...collectImageFiles(uploadDir),
        ...collectImageFiles(extractDir)
    ];

    console.log(`[${sessionId}] Found ${files.length} images to process`);

    if (files.length === 0) {
        session.status = 'completed';
        session.total = 0;
        session.processed = 0;
        session.currentFile = '';
        session.results = [];
        return;
    }

    session.total = files.length;
    session.status = 'processing';
    session.results = [];
    session.colorCounts = {};

    // Phase 3: Process each image
    for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const file = path.basename(filePath);
        session.currentFile = file;
        session.processed = i;

        const colorInfo = await analyzeImageColor(filePath);

        // Generate thumbnail for live preview
        const thumbUrl = await generateThumb(filePath, sessionId, `${i}_${file}`);

        // Only send to review if truly unknown (not just low confidence)
        const needsReview = colorInfo.category === 'unknown' || colorInfo.confidence === 'none';
        const folderName = needsReview ? 'please-double-check' : colorInfo.category;

        // Copy to color folder
        const colorFolder = path.join(outputDir, folderName);
        fs.mkdirSync(colorFolder, { recursive: true });
        let destName = file;
        let counter = 1;
        while (fs.existsSync(path.join(colorFolder, destName))) {
            const ext = path.extname(file);
            destName = `${path.basename(file, ext)}_${counter}${ext}`;
            counter++;
        }
        fs.copyFileSync(filePath, path.join(colorFolder, destName));

        // Track color counts live
        session.colorCounts[folderName] = (session.colorCounts[folderName] || 0) + 1;

        session.results.push({
            filename: file,
            color: folderName,
            hex: colorInfo.hex,
            rgb: colorInfo.rgb,
            thumb: thumbUrl,
            confidence: colorInfo.confidence || 'unknown',
            regions: colorInfo.regionsAgreeing ? `${colorInfo.regionsAgreeing}/${colorInfo.totalRegions}` : null,
            needsReview,
            originalColor: needsReview ? colorInfo.category : null,
            status: needsReview ? 'Needs Review' : 'Success'
        });

        if (needsReview) {
            console.log(`[${sessionId}] Review needed: ${file} → ${colorInfo.category} (confidence: ${colorInfo.confidence})`);
        }

        // Update processed count immediately after each image
        session.processed = i + 1;

        if ((i + 1) % 10 === 0) {
            console.log(`[${sessionId}] Processed ${i + 1}/${files.length}`);
        }
    }

    session.status = 'completed';
    session.currentFile = '';
    console.log(`[${sessionId}] Complete! ${files.length} images sorted.`);
}

// ─── Upload endpoint ───
app.post('/upload', (req, res) => {
    const sessionId = crypto.randomUUID().slice(0, 8);

    const sessionStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(UPLOAD_DIR, sessionId);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    });

    const sessionUpload = multer({
        storage: sessionStorage,
        limits: { fileSize: 2 * 1024 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const allowed = /jpeg|jpg|png|gif|bmp|webp|zip|rar/;
            cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
        }
    }).array('files', 7000);

    sessionUpload(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err.message);
            return res.status(400).json({ error: err.message });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No valid image or archive files uploaded' });
        }

        console.log(`[${sessionId}] Upload received: ${req.files.length} file(s)`);
        req.files.forEach(f => console.log(`  - ${f.originalname} (${(f.size / 1024).toFixed(0)} KB)`));

        sessions[sessionId] = {
            status: 'queued',
            total: 0,
            processed: 0,
            currentFile: 'Starting...',
            results: [],
            colorCounts: {}
        };

        // Start processing (non-blocking)
        processSession(sessionId).catch(err => {
            console.error(`[${sessionId}] Processing error:`, err);
            sessions[sessionId].status = 'error';
            sessions[sessionId].error = err.message;
        });

        res.json({
            session_id: sessionId,
            message: 'Processing started',
            total_images: req.files.length
        });
    });
});

// ─── Status endpoint (returns live progress + recent results) ───
app.get('/status/:sessionId', (req, res) => {
    const session = sessions[req.params.sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Send last N results for live feed (only new ones the client hasn't seen)
    const since = parseInt(req.query.since) || 0;
    const newResults = session.results.slice(since);

    res.json({
        status: session.status,
        processed: session.processed,
        total: session.total,
        current_file: session.currentFile,
        color_counts: session.colorCounts || {},
        new_results: newResults,
        results_offset: since,
        error: session.error || null
    });
});

// ─── Download endpoint ───
app.get('/download/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const session = sessions[sessionId];

    // Allow download if session completed OR output dir exists on disk (survives redeployment)
    const outputDir = path.join(OUTPUT_DIR, sessionId);
    if (!fs.existsSync(outputDir)) {
        return res.status(400).json({ error: 'Session output not found' });
    }
    if (session && session.status !== 'completed') {
        return res.status(400).json({ error: 'Session still processing' });
    }

    const zipFilename = `car_photos_${sessionId}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${zipFilename}`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);
    archive.directory(outputDir, false);
    archive.finalize();
});

// ─── Browse a color folder's images ───
app.get('/browse/:sessionId/:folder', (req, res) => {
    const sessionId = req.params.sessionId;
    const folder = req.params.folder;
    const session = sessions[sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const folderPath = path.join(OUTPUT_DIR, sessionId, folder);
    if (!fs.existsSync(folderPath)) {
        return res.json({ files: [], folder });
    }

    const files = fs.readdirSync(folderPath)
        .filter(f => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f))
        .map(f => ({
            name: f,
            url: `/output/${sessionId}/${folder}/${encodeURIComponent(f)}`,
            size: fs.statSync(path.join(folderPath, f)).size
        }));

    res.json({ files, folder, count: files.length });
});

// ─── List all color folders for a session ───
app.get('/folders/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const session = sessions[sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const outputDir = path.join(OUTPUT_DIR, sessionId);
    if (!fs.existsSync(outputDir)) return res.json({ folders: [] });

    const folders = fs.readdirSync(outputDir)
        .filter(f => fs.statSync(path.join(outputDir, f)).isDirectory())
        .map(f => {
            const files = fs.readdirSync(path.join(outputDir, f))
                .filter(fi => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fi));
            return { name: f, count: files.length };
        })
        .filter(f => f.count > 0)
        .sort((a, b) => b.count - a.count);

    res.json({ folders });
});

// ─── Move a file from one color folder to another ───
app.post('/reassign', (req, res) => {
    const { sessionId, filename, fromFolder, toFolder } = req.body;
    if (!sessionId || !filename || !fromFolder || !toFolder) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const session = sessions[sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const srcPath = path.join(OUTPUT_DIR, sessionId, fromFolder, filename);
    if (!fs.existsSync(srcPath)) {
        return res.status(404).json({ error: 'Source file not found' });
    }

    const destDir = path.join(OUTPUT_DIR, sessionId, toFolder);
    fs.mkdirSync(destDir, { recursive: true });

    // Handle duplicate names in destination
    let destName = filename;
    let counter = 1;
    while (fs.existsSync(path.join(destDir, destName))) {
        const ext = path.extname(filename);
        destName = `${path.basename(filename, ext)}_${counter}${ext}`;
        counter++;
    }

    fs.renameSync(srcPath, path.join(destDir, destName));

    // Update session color counts
    if (session.colorCounts[fromFolder]) {
        session.colorCounts[fromFolder]--;
        if (session.colorCounts[fromFolder] <= 0) delete session.colorCounts[fromFolder];
    }
    session.colorCounts[toFolder] = (session.colorCounts[toFolder] || 0) + 1;

    // Clean up empty source folder
    const srcDir = path.join(OUTPUT_DIR, sessionId, fromFolder);
    const remaining = fs.readdirSync(srcDir).filter(f => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f));
    if (remaining.length === 0) {
        fs.rmSync(srcDir, { recursive: true, force: true });
    }

    console.log(`[${sessionId}] Reassigned: ${filename} from ${fromFolder}/ → ${toFolder}/`);

    res.json({ success: true, filename: destName, from: fromFolder, to: toFolder });
});

// ─── Health check ───
app.get('/health', (req, res) => {
    res.json({ status: 'ok', model: onnxSession ? 'loaded' : 'fallback' });
});

// ─── Serve output images for browsing ───
app.use('/output', express.static(OUTPUT_DIR));

// ─── Start server immediately, load AI model in background ───
app.listen(PORT, () => {
    console.log(`Car Photo Color Sorter running at http://localhost:${PORT}`);
    loadModel().then(() => {
        console.log(`ONNX model: ${onnxSession ? 'loaded' : 'NOT loaded (fallback mode)'}`);
    });
});
