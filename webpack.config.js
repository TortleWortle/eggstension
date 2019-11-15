const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');


module.exports = {
  entry: {
    background: './src/background.js',
    popup: './src/popup.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: 'static', to: path.resolve(__dirname, 'dist') }
    ]),
  ]
};
