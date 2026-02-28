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

// Use STORAGE_ROOT env var for persistent volume (Railway), falls back to project dir
const STORAGE_ROOT = process.env.STORAGE_ROOT || __dirname;
const UPLOAD_DIR = path.join(STORAGE_ROOT, 'uploads');
const OUTPUT_DIR = path.join(STORAGE_ROOT, 'output');
const THUMB_DIR = path.join(STORAGE_ROOT, 'thumbs');

[UPLOAD_DIR, OUTPUT_DIR, THUMB_DIR].forEach(dir => fs.mkdirSync(dir, { recursive: true }));
console.log(`[storage] Root: ${STORAGE_ROOT} (${process.env.STORAGE_ROOT ? 'persistent volume' : 'local filesystem'})`);

const sessions = {};

app.use(express.static(path.join(__dirname, 'public')));
app.use('/thumbs', express.static(THUMB_DIR));
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════
// CAR COLOR DETECTION ENGINE v8
// Two-stage vehicle isolation: SSD-MobileNet (bbox) + SegFormer (pixel mask)
// Pipeline: detect car → segment vehicle pixels → extract ONLY car paint →
//           Nyckel on masked image + LAB on pure pixels → smart merge
// Fallback: multi-region sampling + HSV env filtering if SegFormer unavailable
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

// ─── ONNX Models: load once at startup ───
const SSD_MODEL_PATH = path.join(__dirname, 'models', 'ssd_mobilenet_v1_12.onnx');
const SEGFORMER_MODEL_PATH = path.join(__dirname, 'models', 'transformers-cache', 'Xenova',
    'segformer-b0-finetuned-cityscapes-768-768', 'onnx', 'model_quantized.onnx');
let onnxSession = null;      // SSD-MobileNet for bounding box detection
let segformerSession = null;  // SegFormer for pixel-level vehicle segmentation

// COCO class IDs for vehicles (SSD-MobileNet)
const VEHICLE_CLASSES = [3, 4, 6, 8]; // car, motorcycle, bus, truck
// Cityscapes class IDs for vehicles (SegFormer)
const SEGFORMER_VEHICLE_CLASSES = new Set([13, 14, 15, 17]); // car, truck, bus, motorcycle

// SegFormer preprocessing constants (ImageNet normalization)
const SEG_MEAN = [0.485, 0.456, 0.406];
const SEG_STD = [0.229, 0.224, 0.225];
const SEG_SIZE = 512;

async function loadModel() {
    // Load SSD-MobileNet (bounding box detection)
    try {
        onnxSession = await ort.InferenceSession.create(SSD_MODEL_PATH, {
            executionProviders: ['cpu'],
        });
        console.log('ONNX SSD-MobileNet loaded successfully');
    } catch (err) {
        console.error('Failed to load SSD-MobileNet:', err.message);
    }

    // Load SegFormer (pixel-level vehicle segmentation)
    try {
        if (fs.existsSync(SEGFORMER_MODEL_PATH)) {
            segformerSession = await ort.InferenceSession.create(SEGFORMER_MODEL_PATH, {
                executionProviders: ['cpu'],
            });
            console.log('SegFormer segmentation model loaded successfully');
        } else {
            console.warn('SegFormer model not found at:', SEGFORMER_MODEL_PATH);
        }
    } catch (err) {
        console.error('Failed to load SegFormer:', err.message);
        console.error('Falling back to bounding-box + environment filtering');
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

// ─── Run SegFormer to get pixel-level vehicle mask ───
// Input: a cropped image (Jimp) containing the car region
// Output: { mask: boolean[], width, height, vehiclePixelCount, totalPixels }
// mask[y * width + x] === true means that pixel belongs to a vehicle
async function segmentVehicle(croppedImage) {
    if (!segformerSession) return null;

    try {
        const resized = croppedImage.clone().resize(SEG_SIZE, SEG_SIZE);

        // Prepare NCHW float32 tensor with ImageNet normalization
        const inputData = new Float32Array(1 * 3 * SEG_SIZE * SEG_SIZE);
        const channelSize = SEG_SIZE * SEG_SIZE;

        resized.scan(0, 0, SEG_SIZE, SEG_SIZE, function(x, y, idx) {
            const pixelIdx = y * SEG_SIZE + x;
            const r = this.bitmap.data[idx] / 255.0;
            const g = this.bitmap.data[idx + 1] / 255.0;
            const b = this.bitmap.data[idx + 2] / 255.0;
            // NCHW: channel 0 = R, channel 1 = G, channel 2 = B
            inputData[0 * channelSize + pixelIdx] = (r - SEG_MEAN[0]) / SEG_STD[0];
            inputData[1 * channelSize + pixelIdx] = (g - SEG_MEAN[1]) / SEG_STD[1];
            inputData[2 * channelSize + pixelIdx] = (b - SEG_MEAN[2]) / SEG_STD[2];
        });

        const inputTensor = new ort.Tensor('float32', inputData, [1, 3, SEG_SIZE, SEG_SIZE]);

        // Run inference — SegFormer outputs logits [1, 19, H, W]
        const feeds = {};
        const inputNames = segformerSession.inputNames;
        feeds[inputNames[0]] = inputTensor;
        const results = await segformerSession.run(feeds);

        // Get the output tensor (logits)
        const outputNames = segformerSession.outputNames;
        const logits = results[outputNames[0]];
        const logitsData = logits.data;
        const [, numClasses, outH, outW] = logits.dims;

        // Argmax across classes for each pixel to get class labels
        const mask = new Array(outH * outW);
        let vehiclePixelCount = 0;

        for (let y = 0; y < outH; y++) {
            for (let x = 0; x < outW; x++) {
                let maxVal = -Infinity, maxClass = 0;
                for (let c = 0; c < numClasses; c++) {
                    const val = logitsData[c * outH * outW + y * outW + x];
                    if (val > maxVal) { maxVal = val; maxClass = c; }
                }
                const isVehicle = SEGFORMER_VEHICLE_CLASSES.has(maxClass);
                mask[y * outW + x] = isVehicle;
                if (isVehicle) vehiclePixelCount++;
            }
        }

        return { mask, width: outW, height: outH, vehiclePixelCount, totalPixels: outH * outW };
    } catch (err) {
        console.error('SegFormer inference error:', err.message);
        return null;
    }
}

// ─── Extract vehicle-only pixels using segmentation mask ───
// Maps the segmentation mask back to the original crop and extracts only vehicle pixels
function extractVehiclePixels(croppedImage, segResult) {
    const cw = croppedImage.getWidth(), ch = croppedImage.getHeight();
    const vehiclePixels = [];
    const bgPixels = [];

    // Scale factors from seg mask to crop image
    const scaleX = segResult.width / cw;
    const scaleY = segResult.height / ch;

    croppedImage.scan(0, 0, cw, ch, function(x, y, idx) {
        const r = this.bitmap.data[idx], g = this.bitmap.data[idx + 1], b = this.bitmap.data[idx + 2];
        const brightness = (r + g + b) / 3;
        if (brightness > 252 || brightness < 3) return; // skip blown out / dead pixels

        // Map this pixel to the segmentation mask
        const maskX = Math.min(Math.floor(x * scaleX), segResult.width - 1);
        const maskY = Math.min(Math.floor(y * scaleY), segResult.height - 1);
        const isVehicle = segResult.mask[maskY * segResult.width + maskX];

        if (isVehicle) {
            vehiclePixels.push([r, g, b]);
        } else {
            bgPixels.push([r, g, b]);
        }
    });

    return { vehiclePixels, bgPixels };
}

// ─── Create a masked image for Nyckel (non-vehicle pixels → neutral gray) ───
async function createMaskedCropForNyckel(croppedImage, segResult) {
    const cw = croppedImage.getWidth(), ch = croppedImage.getHeight();
    const masked = croppedImage.clone();
    const scaleX = segResult.width / cw;
    const scaleY = segResult.height / ch;

    masked.scan(0, 0, cw, ch, function(x, y, idx) {
        const maskX = Math.min(Math.floor(x * scaleX), segResult.width - 1);
        const maskY = Math.min(Math.floor(y * scaleY), segResult.height - 1);
        const isVehicle = segResult.mask[maskY * segResult.width + maskX];

        if (!isVehicle) {
            // Set background to neutral gray so Nyckel ignores it
            this.bitmap.data[idx] = 128;
            this.bitmap.data[idx + 1] = 128;
            this.bitmap.data[idx + 2] = 128;
        }
    });

    masked.resize(300, Jimp.AUTO).quality(80);
    return await masked.getBufferAsync(Jimp.MIME_JPEG);
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

// ─── RGB → HSV conversion ───
function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
}

// ─── Environment pixel detector ───
// Identifies pixels that are likely background (grass, sky, road, dirt) rather than car paint.
// Returns a tag string if the pixel is environment, or null if it could be car paint.
function detectEnvironmentPixel(r, g, b) {
    const hsv = rgbToHsv(r, g, b);
    const lab = rgbToLab(r, g, b);
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);

    // Green grass/foliage: hue 60-170, moderate-high saturation, moderate value
    // BUT exclude vivid greens that could be car paint (high saturation + high value)
    if (hsv.h >= 60 && hsv.h <= 170 && hsv.s > 20 && hsv.v > 15 && hsv.v < 85) {
        // Natural green (grass/trees) tends to have moderate saturation + muted appearance
        // Car green paint tends to be more vivid (higher S or higher V)
        if (hsv.s < 70 && hsv.v < 70) return 'grass';
        // Also catch bright grass in sunlight
        if (hsv.s > 25 && hsv.s < 55 && hsv.v > 40 && hsv.v < 80) return 'grass';
    }

    // Blue sky: hue 190-240, low-medium saturation, high value
    if (hsv.h >= 190 && hsv.h <= 250 && hsv.s > 10 && hsv.s < 55 && hsv.v > 55) {
        return 'sky';
    }

    // Grey asphalt/road: very low chroma, medium lightness
    if (chroma < 6 && lab.L > 20 && lab.L < 55) {
        return 'road';
    }

    // Brown dirt/track surface: hue 15-45, low-medium saturation, low-medium value
    if (hsv.h >= 15 && hsv.h <= 50 && hsv.s > 15 && hsv.s < 55 && hsv.v > 15 && hsv.v < 55) {
        return 'dirt';
    }

    return null;
}

// ─── Extract pixels from a crop region, with environment filtering ───
function extractFilteredPixels(image, cx, cy, cw, ch, filterEnvironment) {
    const crop = image.clone().crop(
        Math.max(0, cx), Math.max(0, cy),
        Math.min(cw, image.getWidth() - Math.max(0, cx)),
        Math.min(ch, image.getHeight() - Math.max(0, cy))
    );
    const resized = crop.resize(Math.min(150, crop.getWidth()), Jimp.AUTO);
    const rw = resized.getWidth(), rh = resized.getHeight();

    const carPixels = [];
    const envPixels = [];
    let envCounts = { grass: 0, sky: 0, road: 0, dirt: 0 };

    resized.scan(0, 0, rw, rh, function(x, y, idx) {
        const r = this.bitmap.data[idx], g = this.bitmap.data[idx+1], b = this.bitmap.data[idx+2];
        const brightness = (r + g + b) / 3;
        // Skip pure black/white (overexposed/underexposed)
        if (brightness > 252 || brightness < 3) return;

        if (filterEnvironment) {
            const envType = detectEnvironmentPixel(r, g, b);
            if (envType) {
                envPixels.push([r, g, b]);
                envCounts[envType] = (envCounts[envType] || 0) + 1;
                return;
            }
        }
        carPixels.push([r, g, b]);
    });

    return { carPixels, envPixels, envCounts };
}

// ─── Run LAB color classification on a set of pixels ───
// Shared logic used by both segmented and fallback paths
function classifyPixelsLAB(pixels) {
    if (pixels.length < 30) return null;

    const clusters = medianCut(pixels, 12);
    const allClusters = clusters.map(c => {
        const { category, distance } = classifyColorLab(c.rgb[0], c.rgb[1], c.rgb[2]);
        const chroma = getChroma(c.rgb[0], c.rgb[1], c.rgb[2]);
        const envTag = detectEnvironmentPixel(c.rgb[0], c.rgb[1], c.rgb[2]);
        return { ...c, category, distance, chroma, isEnvRemnant: !!envTag };
    });

    const scored = allClusters.map(c => {
        let score = c.pct * 100;
        if (c.pct > 0.08) score *= 1.3;
        if (c.pct > 0.18) score *= 1.4;
        if (c.pct > 0.30) score *= 1.5;
        if (c.distance < 8) score *= 3.0;
        else if (c.distance < 15) score *= 2.5;
        else if (c.distance < 22) score *= 1.8;
        else if (c.distance < 30) score *= 1.0;
        else score *= 0.3;
        if (c.chroma > 35) score *= 1.3;
        else if (c.chroma > 20) score *= 1.1;
        if (c.isEnvRemnant) score *= 0.15;
        if (c.distance < 12 && c.pct > 0.06) score *= 1.5;
        return { ...c, score };
    }).sort((a, b) => b.score - a.score);

    const winner = scored[0];
    const top5 = scored.slice(0, Math.min(5, scored.length));
    const agreeing = top5.filter(c => c.category === winner.category).length;
    const hex = `#${winner.rgb.map(c => Math.max(0,Math.min(255,c)).toString(16).padStart(2,'0')).join('')}`;
    const winnerCategoryPct = scored.filter(c => c.category === winner.category).reduce((sum, c) => sum + c.pct, 0);

    return {
        rgb: winner.rgb, category: winner.category, hex, distance: winner.distance,
        chroma: winner.chroma, pct: winner.pct, agreeing, top5Count: top5.length,
        winnerCategoryPct, allScored: scored
    };
}

// ─── Analyze the hero car color in an image ───
// Pipeline v8: Two-stage vehicle isolation
//   Stage 1: SSD-MobileNet → bounding box detection
//   Stage 2: SegFormer → pixel-level vehicle segmentation (which pixels ARE the car)
//   Stage 3: Extract ONLY vehicle pixels → zero background contamination
//   Stage 4: Nyckel on masked crop + LAB on pure vehicle pixels → smart merge
async function analyzeImageColor(imagePath) {
    try {
        const image = await Jimp.read(imagePath);
        const w = image.getWidth(), h = image.getHeight();

        // ── Stage 1: Detect car bounding box with SSD-MobileNet ──
        const carBox = await detectCars(image);
        const aiDetected = carBox && carBox.score > 0.3;

        // ── Stage 2: Crop bounding box region ──
        let carCrop;
        if (aiDetected) {
            const cx = Math.max(0, Math.round(carBox.left * w));
            const cy = Math.max(0, Math.round(carBox.top * h));
            const cw = Math.max(10, Math.min(Math.round((carBox.right - carBox.left) * w), w - cx));
            const ch = Math.max(10, Math.min(Math.round((carBox.bottom - carBox.top) * h), h - cy));
            carCrop = image.clone().crop(cx, cy, cw, ch);
            console.log(`  [stage1] SSD-MobileNet detected vehicle (score=${carBox.score.toFixed(2)}) → ${cw}x${ch} crop`);
        } else {
            // No detection → center crop (loose, segmentation will tighten it)
            const cx = Math.round(w * 0.10), cy = Math.round(h * 0.10);
            const cw = Math.round(w * 0.80), ch = Math.round(h * 0.80);
            carCrop = image.clone().crop(cx, cy, Math.min(cw, w - cx), Math.min(ch, h - cy));
            console.log(`  [stage1] No detection → center 80% crop`);
        }

        // ── Stage 3: SegFormer pixel-level vehicle segmentation ──
        const segResult = await segmentVehicle(carCrop);
        let vehiclePixels = [];
        let segmentationUsed = false;
        let nyckelCropBuffer;

        if (segResult && segResult.vehiclePixelCount > 0) {
            const vehiclePct = Math.round(segResult.vehiclePixelCount / segResult.totalPixels * 100);
            console.log(`  [stage2] SegFormer: ${vehiclePct}% of crop is vehicle (${segResult.vehiclePixelCount}/${segResult.totalPixels} pixels)`);

            // Only use segmentation if it found a meaningful vehicle region (>5% of crop)
            if (vehiclePct > 5) {
                segmentationUsed = true;

                // Extract only vehicle-classified pixels
                const { vehiclePixels: vp } = extractVehiclePixels(
                    carCrop.clone().resize(Math.min(250, carCrop.getWidth()), Jimp.AUTO),
                    segResult
                );
                vehiclePixels = vp;

                // Create a masked crop for Nyckel (background → neutral gray)
                nyckelCropBuffer = await createMaskedCropForNyckel(carCrop, segResult);

                console.log(`  [stage2] Extracted ${vehiclePixels.length} pure vehicle pixels (zero background)`);
            } else {
                console.log(`  [stage2] SegFormer found too little vehicle area (${vehiclePct}%), falling back`);
            }
        } else {
            console.log(`  [stage2] SegFormer unavailable or found no vehicles, falling back`);
        }

        // ── Fallback: multi-region sampling + env filtering (if segmentation failed) ──
        if (!segmentationUsed) {
            if (aiDetected) {
                const boxH = carBox.bottom - carBox.top;
                const boxW = carBox.right - carBox.left;
                const regions = [
                    { top: carBox.top + boxH * 0.10, bottom: carBox.top + boxH * 0.30,
                      left: carBox.left + boxW * 0.20, right: carBox.right - boxW * 0.20, weight: 1.0 },
                    { top: carBox.top + boxH * 0.25, bottom: carBox.top + boxH * 0.55,
                      left: carBox.left + boxW * 0.15, right: carBox.right - boxW * 0.15, weight: 2.0 },
                    { top: carBox.top + boxH * 0.50, bottom: carBox.top + boxH * 0.65,
                      left: carBox.left + boxW * 0.20, right: carBox.right - boxW * 0.20, weight: 0.8 }
                ];
                for (const region of regions) {
                    const cx = Math.max(0, Math.round(region.left * w));
                    const cy = Math.max(0, Math.round(region.top * h));
                    const cw = Math.max(10, Math.round((region.right - region.left) * w));
                    const ch = Math.max(10, Math.round((region.bottom - region.top) * h));
                    const { carPixels } = extractFilteredPixels(image, cx, cy, cw, ch, true);
                    const dupeCount = Math.round(region.weight);
                    for (let d = 0; d < dupeCount; d++) vehiclePixels.push(...carPixels);
                }
            } else {
                const cx = Math.round(w * 0.22), cy = Math.round(h * 0.30);
                const cw = Math.round(w * 0.56), ch = Math.round(h * 0.40);
                const { carPixels } = extractFilteredPixels(image, cx, cy, cw, ch, true);
                vehiclePixels = carPixels;
            }
            // Standard crop for Nyckel
            const nCrop = carCrop.clone().resize(300, Jimp.AUTO).quality(80);
            nyckelCropBuffer = await nCrop.getBufferAsync(Jimp.MIME_JPEG);
            console.log(`  [fallback] Env-filtered ${vehiclePixels.length} pixels`);
        }

        // ── Stage 4: Classify — Nyckel (cloud) + LAB (local) in parallel ──
        const nyckelPromise = classifyWithNyckel(nyckelCropBuffer);
        const labResult = classifyPixelsLAB(vehiclePixels);

        if (labResult) {
            console.log(`  [lab] Winner: ${labResult.category} (deltaE=${labResult.distance.toFixed(1)}, ${Math.round(labResult.winnerCategoryPct*100)}% coverage, ${labResult.agreeing}/${labResult.top5Count} agree, chroma=${labResult.chroma.toFixed(0)})${segmentationUsed ? ' [segmented]' : ''}`);
        }

        const nyckelResult = await nyckelPromise;

        // ── Stage 5: Smart merge — Nyckel + LAB cross-validation ──
        const ACHROMATIC = new Set(['black', 'white', 'silver-grey']);
        const CHROMATIC = new Set(['red','blue','green','yellow','orange','purple','pink','brown']);
        const ENV_COLORS = new Set(['green', 'blue', 'brown']);

        if (nyckelResult && nyckelResult.confidence > 0.3) {
            const nyckelCategory = nyckelResult.category;
            const nyckelConf = nyckelResult.confidence;

            if (labResult && labResult.allScored) {
                const labWinner = labResult.category;
                const achromaticPct = labResult.allScored.filter(c => ACHROMATIC.has(c.category)).reduce((sum, c) => sum + c.pct, 0);
                const nyckelColorPct = labResult.allScored.filter(c => c.category === nyckelCategory).reduce((sum, c) => sum + c.pct, 0);
                const labWinnerPct = labResult.winnerCategoryPct;

                console.log(`  [merge] Nyckel=${nyckelCategory}(${Math.round(nyckelConf*100)}%) LAB=${labWinner}(${Math.round(labWinnerPct*100)}%) achro=${Math.round(achromaticPct*100)}% nyckelColor=${Math.round(nyckelColorPct*100)}%${segmentationUsed ? ' [SEG]' : ''}`);

                // CASE A: Both agree → highest confidence
                if (nyckelCategory === labWinner) {
                    console.log(`  [merge] AGREE: both say ${nyckelCategory}`);
                    return {
                        rgb: labResult.rgb, category: nyckelCategory, hex: labResult.hex,
                        confidence: 'high', nyckelLabel: nyckelResult.nyckelLabel,
                        nyckelConfidence: Math.round(nyckelConf * 100),
                        aiDetected, segmented: segmentationUsed, method: 'consensus'
                    };
                }

                // If segmentation was used, LAB data is PURE vehicle pixels — trust it more
                const labTrustBoost = segmentationUsed ? 0.15 : 0;

                // CASE B: Nyckel=CHROMATIC, LAB=ACHROMATIC
                if (CHROMATIC.has(nyckelCategory) && ACHROMATIC.has(labWinner)) {
                    if (achromaticPct > (0.45 - labTrustBoost) && nyckelColorPct < (0.25 + labTrustBoost)) {
                        console.log(`  [merge] OVERRIDE→LAB: ${labWinner} (${Math.round(achromaticPct*100)}% achromatic)`);
                        return {
                            rgb: labResult.rgb, category: labWinner, hex: labResult.hex,
                            confidence: labResult.distance < 18 ? 'high' : 'medium',
                            nyckelLabel: nyckelResult.nyckelLabel, nyckelOverridden: true,
                            deltaE: Math.round(labResult.distance * 10) / 10,
                            aiDetected, segmented: segmentationUsed, method: 'lab-override'
                        };
                    }
                    if (labResult.agreeing >= 3 && labResult.distance < 18) {
                        console.log(`  [merge] OVERRIDE→LAB (strong): ${labResult.agreeing} agree on ${labWinner}`);
                        return {
                            rgb: labResult.rgb, category: labWinner, hex: labResult.hex,
                            confidence: 'high', nyckelLabel: nyckelResult.nyckelLabel, nyckelOverridden: true,
                            deltaE: Math.round(labResult.distance * 10) / 10,
                            aiDetected, segmented: segmentationUsed, method: 'lab-override'
                        };
                    }
                }

                // CASE C: Nyckel says environment color but LAB disagrees
                if (ENV_COLORS.has(nyckelCategory) && nyckelCategory !== labWinner) {
                    const threshold = segmentationUsed ? 0.40 : 0.30;
                    if (nyckelColorPct < threshold && labWinnerPct > nyckelColorPct) {
                        console.log(`  [merge] ENV_SKEPTIC: Nyckel=${nyckelCategory}(${Math.round(nyckelColorPct*100)}%) → LAB=${labWinner}(${Math.round(labWinnerPct*100)}%)`);
                        return {
                            rgb: labResult.rgb, category: labWinner, hex: labResult.hex,
                            confidence: labResult.distance < 20 ? 'high' : 'medium',
                            nyckelLabel: nyckelResult.nyckelLabel, nyckelOverridden: true,
                            deltaE: Math.round(labResult.distance * 10) / 10,
                            aiDetected, segmented: segmentationUsed, method: 'lab-env-override'
                        };
                    }
                }

                // CASE D: Nyckel=ACHROMATIC, LAB=CHROMATIC
                if (ACHROMATIC.has(nyckelCategory) && CHROMATIC.has(labWinner)) {
                    const chromaticClusters = labResult.allScored.filter(c =>
                        CHROMATIC.has(c.category) && c.chroma > 8 && c.distance < 35 && c.pct > 0.03
                    );
                    if (chromaticClusters.length > 0) {
                        const bestChromatic = chromaticClusters.sort((a, b) => {
                            const sA = a.chroma * 2 + a.pct * 100 + (35 - a.distance);
                            const sB = b.chroma * 2 + b.pct * 100 + (35 - b.distance);
                            return sB - sA;
                        })[0];
                        const chromaticPct = chromaticClusters.filter(c => c.category === bestChromatic.category).reduce((sum, c) => sum + c.pct, 0);
                        if (chromaticPct > 0.05 || bestChromatic.chroma > 20) {
                            const hex = `#${bestChromatic.rgb.map(c => Math.max(0,Math.min(255,c)).toString(16).padStart(2,'0')).join('')}`;
                            console.log(`  [merge] OVERRIDE→CHROMATIC: ${bestChromatic.category} (${Math.round(chromaticPct*100)}%)`);
                            return {
                                rgb: bestChromatic.rgb, category: bestChromatic.category, hex,
                                confidence: bestChromatic.distance < 20 ? 'high' : 'medium',
                                deltaE: Math.round(bestChromatic.distance * 10) / 10,
                                nyckelLabel: nyckelResult.nyckelLabel, nyckelOverridden: true,
                                chromaticPct: Math.round(chromaticPct * 100),
                                aiDetected, segmented: segmentationUsed, method: 'lab-chromatic-override'
                            };
                        }
                    }
                    console.log(`  [merge] ACHROMATIC confirmed → ${nyckelCategory}`);
                    return {
                        rgb: labResult.rgb, category: nyckelCategory, hex: labResult.hex,
                        confidence: nyckelConf > 0.7 ? 'high' : 'medium',
                        nyckelLabel: nyckelResult.nyckelLabel, nyckelConfidence: Math.round(nyckelConf * 100),
                        aiDetected, segmented: segmentationUsed, method: 'nyckel'
                    };
                }

                // CASE E: Both chromatic but disagree
                if (CHROMATIC.has(nyckelCategory) && CHROMATIC.has(labWinner) && nyckelCategory !== labWinner) {
                    // With segmentation, LAB is more trustworthy
                    if (segmentationUsed && labWinnerPct > 0.30 && labResult.distance < 22) {
                        console.log(`  [merge] LAB_WINS (segmented): ${labWinner}(${Math.round(labWinnerPct*100)}%)`);
                        return {
                            rgb: labResult.rgb, category: labWinner, hex: labResult.hex,
                            confidence: 'high', nyckelLabel: nyckelResult.nyckelLabel, nyckelOverridden: true,
                            deltaE: Math.round(labResult.distance * 10) / 10,
                            aiDetected, segmented: segmentationUsed, method: 'lab-seg-override'
                        };
                    }
                    if (nyckelConf > 0.65 && nyckelColorPct > 0.10) {
                        console.log(`  [merge] NYCKEL_WINS: ${nyckelCategory}(${Math.round(nyckelConf*100)}%)`);
                        return {
                            rgb: labResult.rgb, category: nyckelCategory, hex: labResult.hex,
                            confidence: 'high', nyckelLabel: nyckelResult.nyckelLabel,
                            nyckelConfidence: Math.round(nyckelConf * 100),
                            aiDetected, segmented: segmentationUsed, method: 'nyckel'
                        };
                    }
                    if (labWinnerPct > 0.40 && labResult.distance < 20) {
                        console.log(`  [merge] LAB_WINS: ${labWinner}(${Math.round(labWinnerPct*100)}%)`);
                        return {
                            rgb: labResult.rgb, category: labWinner, hex: labResult.hex,
                            confidence: 'high', nyckelLabel: nyckelResult.nyckelLabel, nyckelOverridden: true,
                            deltaE: Math.round(labResult.distance * 10) / 10,
                            aiDetected, segmented: segmentationUsed, method: 'lab-override'
                        };
                    }
                    if (nyckelConf > 0.45) {
                        console.log(`  [merge] TIEBREAK→NYCKEL: ${nyckelCategory}(${Math.round(nyckelConf*100)}%)`);
                        return {
                            rgb: labResult.rgb, category: nyckelCategory, hex: labResult.hex,
                            confidence: 'medium', nyckelLabel: nyckelResult.nyckelLabel,
                            nyckelConfidence: Math.round(nyckelConf * 100),
                            aiDetected, segmented: segmentationUsed, method: 'nyckel-tiebreak'
                        };
                    }
                }
            }

            // Nyckel available but no LAB → trust Nyckel
            if (!labResult) {
                return {
                    rgb: [0,0,0], category: nyckelCategory, hex: '#000000',
                    confidence: nyckelConf > 0.7 ? 'high' : nyckelConf > 0.4 ? 'medium' : 'low',
                    nyckelLabel: nyckelResult.nyckelLabel, nyckelConfidence: Math.round(nyckelConf * 100),
                    aiDetected, segmented: segmentationUsed, method: 'nyckel-only'
                };
            }
        }

        // ── Stage 6: Nyckel failed — LAB only ──
        if (!labResult) {
            return { rgb: [128,128,128], category: 'unknown', hex: '#808080', confidence: 'none', method: 'none' };
        }

        let confidence = 'medium';
        if (labResult.distance < 15 && (labResult.agreeing >= 2 || labResult.pct > 0.12)) confidence = 'high';
        if (segmentationUsed && labResult.distance < 22) confidence = 'high';
        if (aiDetected && labResult.distance < 20) confidence = 'high';
        if (labResult.distance > 30 && labResult.agreeing < 2) confidence = 'low';

        return {
            rgb: labResult.rgb, category: labResult.category, hex: labResult.hex,
            confidence, regionsAgreeing: labResult.agreeing, totalRegions: labResult.top5Count,
            deltaE: Math.round(labResult.distance * 10) / 10,
            aiDetected, segmented: segmentationUsed, method: 'local-lab'
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

    // Update in-memory session color counts if available
    const session = sessions[sessionId];
    if (session) {
        if (session.colorCounts[fromFolder]) {
            session.colorCounts[fromFolder]--;
            if (session.colorCounts[fromFolder] <= 0) delete session.colorCounts[fromFolder];
        }
        session.colorCounts[toFolder] = (session.colorCounts[toFolder] || 0) + 1;
    }

    // Clean up empty source folder
    const srcDir = path.join(OUTPUT_DIR, sessionId, fromFolder);
    const remaining = fs.readdirSync(srcDir).filter(f => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f));
    if (remaining.length === 0) {
        fs.rmSync(srcDir, { recursive: true, force: true });
    }

    console.log(`[${sessionId}] Reassigned: ${filename} from ${fromFolder}/ → ${toFolder}/`);

    res.json({ success: true, filename: destName, from: fromFolder, to: toFolder });
});

// ─── Cleanup endpoint (delete session files) ───
app.delete('/cleanup/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const uploadDir = path.join(UPLOAD_DIR, sessionId);
    const outputDir = path.join(OUTPUT_DIR, sessionId);
    const thumbDir = path.join(THUMB_DIR, sessionId);

    let cleaned = 0;
    [uploadDir, outputDir, thumbDir].forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
            cleaned++;
        }
    });

    // Remove from in-memory sessions
    delete sessions[sessionId];

    console.log(`[${sessionId}] Cleanup: removed ${cleaned} directories`);
    res.json({ success: true, cleaned });
});

// ─── Health / diagnostics endpoint ───
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        engine: 'v8',
        ssdMobilenet: onnxSession ? 'loaded' : 'NOT loaded',
        segformer: segformerSession ? 'loaded' : 'NOT loaded (fallback to env filtering)',
        ssdModelPath: SSD_MODEL_PATH,
        ssdModelExists: fs.existsSync(SSD_MODEL_PATH),
        segModelPath: SEGFORMER_MODEL_PATH,
        segModelExists: fs.existsSync(SEGFORMER_MODEL_PATH),
        pipeline: segformerSession
            ? 'SSD bbox → SegFormer pixel mask → pure vehicle pixels → Nyckel+LAB → merge'
            : 'SSD bbox → multi-region crop → env filter → Nyckel+LAB → merge',
        storageRoot: STORAGE_ROOT,
        storagePersistent: !!process.env.STORAGE_ROOT,
        uptime: Math.round(process.uptime()) + 's',
        nyckelConfigured: !!(NYCKEL_CLIENT_ID && NYCKEL_CLIENT_SECRET),
    });
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
