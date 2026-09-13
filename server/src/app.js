const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const corsOptions = require('./config/cors');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

// Builds and configures the Express app without binding a port, so it can
// be started by src/server.js or imported directly (no network side
// effects) by the test suite via supertest.
module.exports = app;
