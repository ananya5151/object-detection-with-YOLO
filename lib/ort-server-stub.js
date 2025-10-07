// Minimal server stub for onnxruntime-web to prevent SSR bundling the node variant
// Ensures any accidental server import doesn't crash builds.
module.exports = {
    env: { wasm: {} },
    InferenceSession: {
        async create() {
            throw new Error('onnxruntime-web is not available on the server runtime');
        },
    },
};
