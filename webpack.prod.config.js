const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const baseManifest = require('./src/manifest-extension.json');
const WebpackExtensionManifestPlugin = require('webpack-extension-manifest-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const paths = require('./config/path.js');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const WebpackObfuscator = require('webpack-obfuscator');
const DotenvPlugin = require('dotenv-webpack');

const dotenvFiles = {
  dev: '.env.dev',
  staging: '.env.staging',
  cert: '.env.cert',
  prod: '.env.prod',
  qa: '.env.qa'
};

const config = {
  mode: 'production',
  devtool: 'source-map',
  stats: {
    colors: true,
    hash: true,
    version: true,
    timings: true,
    chunks: true,
    chunkModules: true,
    cached: true,
    cachedAssets: true,
    logging: 'verbose'
  },
  entry: {
    main: paths.appIndexJs,
    background: './src/background.js',
    content: './src/content.js' 
  },
  output: {
    publicPath: paths.publicUrlOrPath,
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].js'
  },
  resolve: {
    extensions: ['.*', '.js'],
    alias: {
      'webpack/lib/DeprecatedMainTemplatePlugin': 'webpack/lib/JavascriptModulesPlugin'
    }
  },
  plugins: [
    new CopyPlugin({ 
      patterns: [
        {
          from: path.resolve(__dirname, 'src/icon.png'),
          to: path.resolve(__dirname, 'dist/icon.png')
        },
        {
          from: path.resolve(__dirname, 'src/assets/images'),
          to: path.resolve(__dirname, 'dist/media')
        },
        {
          from: path.resolve(__dirname, 'src/rules.json'),
          to: path.resolve(__dirname, 'dist/rules.json')
        }
      ],
    }),
    new HtmlWebpackPlugin({
      title: 'Insiteflow',
      meta: {
        charset: 'utf-8',
        viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no',
        'theme-color': '#000000'
      },
      manifest: 'manifest-extension.json',
      filename: 'index.html',
      template: './src/index.html',
      hash: true
    }),
    new WebpackExtensionManifestPlugin({
      config: {
        base: baseManifest
      }
    }),
    new MiniCssExtractPlugin({
      filename: 'css/[name].css',
      chunkFilename: 'css/[name].chunk.css',
    }),
    new WebpackObfuscator ({
      rotateStringArray: true
    }, []),
    new NodePolyfillPlugin(),
    new DotenvPlugin({
      path: dotenvFiles[process.env.REACT_APP_ENV]
    })
  ],
  performance: {
    hints: false
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      // Use multi-process parallel running to improve the build speed
      // Default number of concurrent runs: os.cpus().length - 1
      parallel: true,
      terserOptions: {
        sourceMap: true
      }
    })],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ['babel-loader']
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'media/[name].[ext]',
            }
          }
        ]
      }
    ]
  }
};
module.exports = config;
