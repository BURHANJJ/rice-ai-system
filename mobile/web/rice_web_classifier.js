// Rice AI Web Classifier for Flutter Web (Chrome preview on PC)
// Uses ONNX Runtime Web to run rice-v3.onnx directly in the browser.

(function () {
  let sessionPromise = null;
  const SIZE = 224;
  const LABELS = ['BLAST', 'BLB', 'TUNGRO', 'HEALTHY', 'OTHER'];

  async function getSession() {
    if (!sessionPromise) {
      sessionPromise = (async () => {
        if (typeof ort === 'undefined') {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
        ort.env.wasm.numThreads = 1;

        // Try local paths
        const paths = ['models/rice-v3.onnx', '/models/rice-v3.onnx', 'assets/model/rice_disease_model.tflite'];
        let session = null;
        for (const p of paths) {
          try {
            session = await ort.InferenceSession.create(p, {
              executionProviders: ['wasm'],
              graphOptimizationLevel: 'all'
            });
            break;
          } catch (e) {
            console.warn('Attempted to load model from ' + p + ':', e);
          }
        }
        if (!session) {
          throw new Error('Could not load ONNX model from any path');
        }
        return session;
      })().catch(e => {
        sessionPromise = null;
        throw e;
      });
    }
    return sessionPromise;
  }

  // Global function called from Flutter Dart via dart:js_interop
  window.riceAiWebClassify = async function (base64Image) {
    try {
      const session = await getSession();

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image in browser'));
        img.src = 'data:image/jpeg;base64,' + base64Image;
      });

      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const imgData = ctx.getImageData(0, 0, SIZE, SIZE).data;

      // Input tensor: 1 x 224 x 224 x 3 (RGB raw floats 0-255)
      const input = new Float32Array(SIZE * SIZE * 3);
      let k = 0;
      for (let i = 0; i < imgData.length; i += 4) {
        input[k++] = imgData[i];
        input[k++] = imgData[i + 1];
        input[k++] = imgData[i + 2];
      }

      const tensor = new ort.Tensor('float32', input, [1, SIZE, SIZE, 3]);
      const feeds = {};
      feeds[session.inputNames[0]] = tensor;

      const out = await session.run(feeds);
      const probs = Array.from(out[session.outputNames[0]].data);

      let best = 0;
      for (let i = 1; i < probs.length; i++) {
        if (probs[i] > probs[best]) best = i;
      }
      const confidence = Math.round(probs[best] * 1000) / 10;
      const code = LABELS[best];

      return JSON.stringify({
        success: true,
        code: code,
        confidence: confidence,
        probs: probs
      });
    } catch (err) {
      console.error('Rice AI Web Inference Error:', err);
      return JSON.stringify({
        success: false,
        error: String(err)
      });
    }
  };
})();

