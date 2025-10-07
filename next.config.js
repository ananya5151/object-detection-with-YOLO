/** @type {import('next').NextConfig} */
const nextConfig = {
  // For Docker deployment
  // output: 'standalone', // Not needed for Vercel
  images: { unoptimized: true }, // You may want to remove this if using Vercel Image Optimization
  // eslint: { ignoreDuringBuilds: true },
  // typescript: { ignoreBuildErrors: true },

  transpilePackages: ['onnxruntime-web'],

  experimental: {
    serverComponentsExternalPackages: ['socket.io'],
    caseSensitiveRoutes: false,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/onnx-wasm/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
      {
        source: '/:path*.wasm',
        headers: [{ key: 'Content-Type', value: 'application/wasm' }],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    config.experiments = {
      ...(config.experiments || {}),
      asyncWebAssembly: true,
      layers: true,
    };

    // Vercel auto-detects server/client, so no need for Docker/standalone aliases

    config.module = config.module || {};
    config.module.rules = config.module.rules || [];

    config.module.rules.push(
      {
        test: /\.wasm$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/wasm/[name].[hash][ext]',
        },
      },
      {
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto',
      }
    );

    return config;
  },
};

module.exports = nextConfig;