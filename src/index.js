import http from 'http';
import nodemailer from 'nodemailer';
import express from 'express';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import cors from 'cors';
import createError from 'http-errors';
import session from 'express-session';
import mongoose from 'mongoose';


// import Promise from 'bluebird';
import initializeDb, { db } from './db';
import log from './log';
import middleware from './middleware';
import api from './api/index';
import config from './config.json';
import mail from './mail';
import facets from './api/facets';
import storyRouter from './db/actions/story';
import userRouter from './db/actions/user';
import authRouter from './auth/auth';
import token from './middleware/token-create';
import { authenticated, checkSession } from './auth/authenticate';

const jwt = require('express-jwt');
const MongoStore = require('connect-mongo')(session);

const app = express();

app.use(session({
  store: new MongoStore({ mongooseConnection: db }),
  cookie: {
    secure: false,
    signed: false,
    maxAge: 7200 * 1000,
    httpOnly: false,
    sameSite: false,
    path: '/',
    // domain: 'localhost',
  },
  secret: config.sessionSecret,
  saveUninitialized: false,
  resave: false,
}));

app.use((req, res, next) => {
  next();
});


app.server = http.createServer(app);

// app.use(bodyParser.json());

// app.use(bodyParser.urlencoded({ extended: false }));

app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

app.use(require('./auth/authenticate').authenticated);

/* app.post('/users/login');
app.get('/users/me'); */

mail.start();

// // logger

app.use(morgan('dev'));

/* app.use(
  cors({
    exposedHeaders: config.corsHeaders,
  }),
); */

app.use((req, res, next) => {
  res.header('Access-Control-Expose-Headers', 'Cache-Control', 'Content-Language', 'Content-Type', 'Expires', 'Last-Modified', 'Pragma');
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Methods', 'POST,GET,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, X-Requested-With, X-HTTP-Method-Override, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  return next();
});

// // 3rd party middleware

// connect to dbs
initializeDb((db) => {
  // internal middleware

  // mongoose.model()
  console.log('CHECK_SESSION', checkSession);
  app.use(middleware({ config, db }));
  app.use('/users', checkSession, userRouter({ config, db }));
  app.use('/stories', checkSession, storyRouter({ config, db }));
  app.use('/auth', authRouter({ config, db }));
  app.use('/facets', api({ config, db }));
  // api router

  app.use('/api', facets({ config, db }));

  // catch 404 and forward to error handler
  app.use((req, res, next) => {
    next(createError(404));
  });

  // error handler
  app.use((err, req, res, next) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.json({
      message: err.message,
      error: err,
    });
  });

  // const port = process.env.PORT || 4000;
  const port = 4000;

  app.server.listen(port, () => {
    log.info(`Started on port ${app.server.address().port}`);
  });
});

export default app;
