const path = require('path');
// const MiniCssExtractPlugin = require('mini-css-extract-plugin');
// const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = function (_, { mode = 'development' }) {
  return {
    mode,
    context: __dirname,
    entry: {
      'xin-router': './index.js',
    },
    output: {
      path: path.join(__dirname, 'dist'),
      filename: `[name]${mode === 'production' ? '.min' : ''}.js`,
      library: ['xin', 'router'],
      libraryTarget: 'umd',
    },
    externals: {
      '@xinix/xin': {
        commonjs: '@xinix/xin',
        commonjs2: '@xinix/xin',
        amd: '@xinix/xin',
        root: 'xin',
      },
    },
    // devtool: 'cheap-source-map',
    // module: {
    //   rules: [
    //     {
    //       test: /\.s?css$/,
    //       use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
    //     },
    //   ],
    // },
    // plugins: [
    //   new MiniCssExtractPlugin({
    //     filename: `[name]${mode === 'production' ? '.min' : ''}.css`,
    //   }),
    // ],
    optimization: {
      minimizer: [
        new TerserPlugin(),
        // new OptimizeCSSAssetsPlugin({}),
      ],
    },
  };
};
