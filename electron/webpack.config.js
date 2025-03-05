const path = require('path');

module.exports = {
  mode: 'development',
  entry: './electron/main.ts',
  target: 'electron-main',
  module: {
    rules: [{
      test: /\.ts$/,
      include: /electron/,
      use: [{ loader: 'ts-loader' }]
    }]
  },
  output: {
    path: path.resolve(__dirname, '../app/electron'),
    filename: 'main.js'
  },
  node: {
    __dirname: false,
    __filename: false
  }
}; 