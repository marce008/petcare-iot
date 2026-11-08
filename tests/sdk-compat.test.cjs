const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const expoModules = require(path.join(
  projectRoot,
  'node_modules',
  'expo',
  'bundledNativeModules.json',
));
const reactNative = require(path.join(
  projectRoot,
  'node_modules',
  'react-native',
  'package.json',
));

test('installed React Native version matches the Expo SDK requirement', () => {
  assert.equal(reactNative.version, expoModules['react-native']);
});
