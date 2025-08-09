/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Fix for OpenAI agents library in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        process: false,
        buffer: false,
        util: false,
        events: false,
      };
    }

    // Handle .mjs files properly
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });

    return config;
  },
  experimental: {
    esmExternals: 'loose',
  },
  transpilePackages: [
    '@openai/agents',
    '@openai/agents-core',
    '@openai/agents-realtime',
  ],
};

module.exports = nextConfig;