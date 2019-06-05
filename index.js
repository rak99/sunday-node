import http from 'http';
import express from 'express';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import cors from 'cors';
import createError from 'http-errors';
import passport from 'passport';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import path from 'path';
import cookieParser from 'cookie-parser';
// import logger from 'morgan';
import session from 'express-session';
import FileStore from 'session-file-store';
import authenticate from '../sunday-node/src/authenticate';
import initializeDb from './src/db';
import log from './src/log';
import middleware from './src/middleware';
import api from './src/api/index';
import config from './src/config.json';
import mail from './src/mail';
import facets from './src/api/facets';
import storyRouter from './src/db/actions/story';
import userRouter from './src/db/actions/user';
import User from './src/db/models/user';

const app = express();
app.server = http.createServer(app);

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: false }));

mail.start();

// // logger

app.use(morgan('dev'));

// // 3rd party middleware

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allowed-Methods', 'POST,GET,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, X-Requested-With, X-HTTP-Method-Override, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  return next();
});

// connect to db
initializeDb((db) => {
  
  // internal middleware

  app.use(middleware({ config, db }));
  app.use('/users', userRouter({ config, db }));
  app.use('/stories', storyRouter({ config, db }));
  app.use('/facets', api({ config, db }));
  // api router

  app.use('/api', facets({ config, db }));

  // catch 404 and forward to error handler
  app.use((req, res, next) => {
    next(createError(404));
  });

  // error handlera
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

  const port = process.env.PORT || 3000;

  app.server.listen(port, () => {
    log.info(`Started on port ${app.server.address().port}`);
  });
});

export default app;
