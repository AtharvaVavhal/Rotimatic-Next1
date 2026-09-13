const app = require('./app');
const env = require('./config/env');
const { testConnection } = require('./db/pool');

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Rotimatic NEXT API listening on port ${env.PORT} (${env.NODE_ENV})`);
  testConnection();
});
