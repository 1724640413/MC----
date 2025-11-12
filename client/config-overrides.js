const { override, addWebpackAlias } = require('customize-cra');
const webpack = require('webpack');

// Webpack (CRA) overrides
const webpackOverride = override(
  (config) => {
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "assert": require.resolve("assert"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "os": require.resolve("os-browserify"),
      "url": require.resolve("url")
    });
    config.resolve.fallback = fallback;
    
    config.plugins = (config.plugins || []).concat([
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer']
      })
    ]);
    
    return config;
  }
);

// devServer bridge to support webpack-dev-server v4 API (setupMiddlewares)
// Maps legacy onBeforeSetupMiddleware / onAfterSetupMiddleware to setupMiddlewares
function devServerBridge(devServerConfig) {
  return function(proxy, allowedHost) {
    const config = devServerConfig(proxy, allowedHost);

    const before = config.onBeforeSetupMiddleware;
    const after = config.onAfterSetupMiddleware;
    const prevSetup = config.setupMiddlewares;

    if (before || after) {
      // map legacy https option to new server option for webpack-dev-server v4
      if (config.https !== undefined) {
        const httpsVal = config.https;
        // if https is boolean or 'auto'
        if (typeof httpsVal === 'boolean' || httpsVal === 'auto') {
          config.server = config.server || {};
          if (httpsVal === true || httpsVal === 'auto') {
            config.server.type = 'https';
          } else {
            config.server.type = 'http';
          }
        } else if (typeof httpsVal === 'object') {
          // https can be an object with cert/key/pfx — move to server.options
          config.server = Object.assign({}, config.server || {}, { type: 'https', options: httpsVal });
        }
        delete config.https;
      }
      config.setupMiddlewares = (middlewares, devServer) => {
        // preserve existing setupMiddlewares behavior
        if (typeof prevSetup === 'function') {
          try {
            const result = prevSetup(middlewares, devServer);
            if (Array.isArray(result)) middlewares = result;
          } catch (e) {
            // ignore and continue
          }
        }

        // call legacy before hook if present
        if (typeof before === 'function' && devServer && devServer.app) {
          try { before(devServer.app, devServer); } catch (e) { /* ignore */ }
        }

        // call legacy after hook if present
        if (typeof after === 'function' && devServer && devServer.app) {
          try { after(devServer.app, devServer); } catch (e) { /* ignore */ }
        }

        return middlewares;
      };

      // remove legacy keys to avoid schema validation errors
      delete config.onBeforeSetupMiddleware;
      delete config.onAfterSetupMiddleware;
    }

    return config;
  };
}

module.exports = {
  webpack: webpackOverride,
  devServer: devServerBridge
};
