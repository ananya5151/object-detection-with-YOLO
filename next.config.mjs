/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'standalone',

  async headers() {
    return [
      {
        source: '/onnx-wasm/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      {
        source: '/:path*.wasm',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
        ],
      },
      {
        source: '/models/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ]
  },

  experimental: {
    serverComponentsExternalPackages: ['socket.io'],
  },

  webpack: (config, { dev, isServer }) => {
    // Handle WASM files properly
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    // ONNX Runtime specific configuration
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        'onnxruntime-node': 'onnxruntime-node',
      });
    }

    // Ignore server-only modules in client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        'onnxruntime-node': false,
      };
    }

    // Handle ONNX files
    config.module.rules.push({
      test: /\.onnx$/,
      type: 'asset/resource',
    });

    return config;
  },
}

export default nextConfig