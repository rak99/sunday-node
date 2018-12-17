import http from 'http';
import express from 'express';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import cors from 'cors';
import createError from 'http-errors';
import initializeDb from './db';


import log from './log';
import middleware from './middleware';
import api from './api/index';
import config from './config.json';
import mail from './mail';
import facets from './api/facets';
import storyRouter from './db/actions/story';
import userRouter from './db/actions/user';

const app = express();
app.server = http.createServer(app);

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: false }));

mail.start();

// // logger

app.use(morgan('dev'));

// // 3rd party middleware
app.use(
  cors({
    exposedHeaders: config.corsHeaders,
  }),
);

// app.use(
//   bodyParser.json({
//     limit: config.bodyLimit,
//   }),
// );

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

  const port = process.env.PORT || 3000;

  app.server.listen(port, () => {
    log.info(`Started on port ${app.server.address().port}`);
  });
});

export default app;
