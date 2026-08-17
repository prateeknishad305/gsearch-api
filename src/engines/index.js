'use strict';

const google = require('./google');
const duckduckgo = require('./duckduckgo');
const bing = require('./bing');
const brave = require('./brave');
const mojeek = require('./mojeek');
const startpage = require('./startpage');
const yahoo = require('./yahoo');
const qwant = require('./qwant');

const engines = {
  google,
  duckduckgo,
  bing,
  brave,
  mojeek,
  startpage,
  yahoo,
  qwant,
};

function names() {
  return Object.keys(engines);
}

function get(name) {
  return engines[name] || null;
}

module.exports = { engines, names, get };
