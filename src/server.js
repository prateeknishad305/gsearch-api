'use strict';

const app = require('./app');

const PORT = Number(process.env.PORT || 3000);

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`gsearch-api listening on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
