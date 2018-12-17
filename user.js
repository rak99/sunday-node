/* eslint-disable import/prefer-default-export */
import { Router } from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import moment from 'moment';
import log from '../../log';
import User from '../models/user';
import config from '../../config.json';


export default ({ config, db }) => {
  const userRouter = Router();
  userRouter.use(bodyParser.json());

  userRouter.route('/')
  .get((req, res, next) => {
    User.find({})
    .then((users) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.json(users);
    }, err => next(err))
    .catch(err => next(err));
  })
  .post((req, res, next) => {
    if ((req.body.firstName.length > 0) &&
      (req.body.lastName.length > 0) &&
      (req.body.email.length > 0)) {
      req.body.timeCreated = moment().format();
      User.create(req.body)
        .then((story) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.json(story);
        }, err => next(err))
        .catch(err => next(err));
    } else {
      const err = new Error('Please fill in the necesarry form fields');
      err.statusCode = 400;
      return next(err);
    }
  })
  .put((req, res, next) => {
    res.statusCode = 403;
    res.end('PUT operation not supported on /users');
  })
  .delete((req, res, next) => {
    User.remove()
    .then((resp) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.json(resp);
    }, err => next(err))
    .catch(err => next(err));
  });

  // -----userId-----
  // WriterIds auto made.

  userRouter.route('/:userId')
  .get((req, res, next) => {
    User.findById(req.params.userId)
    .then((user) => {
      if (user != null) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json(user);
      } else {
        const err = new Error(`Dish ${req.params.dishId} not found`);
        err.status = 404;
        return next(err);
      }
    }, err => next(err))
    .catch(err => next(err));
  })
  .post((req, res, next) => {
    res.statusCode = 403;
    res.end(`Post operation not supported on /users/${req.params.userId}`);
  })
  .put((req, res, next) => {
    User.findByIdAndUpdate(req.params.userId, {
      $set: req.body,
    }, { new: true })
    .then((user) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.json(user);
    }, err => next(err))
    .catch(err => next(err));
  })
  .delete((req, res, next) => {
    User.findByIdAndRemove(req.params.userId)
    .then((resp) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.json({});
    }, err => next(err))
    .catch(err => next(err));
  });

  // -----userid/writeIds-----

  userRouter.route('/:userId/writerIds')
  .get((req, res, next) => {
    User.findById(req.params.userId)
    .then((user) => {
      if (user != null) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json(user.writerIds);
      } else {
        const err = new Error(`User + ${req.params.userId} + ' not found`);
        err.statusCode = 404;
        return next(err);
      }
    }, err => next(err))
    .catch(err => next(err));
  })

  // Leave for later, maybe push logged in user's id into the writerIds array
  /* .post((req, res, next) => {
    User.findById(req.params.userId)
    .then((user) => {

    });
  });
  */
  .put((req, res, next) => {
    res.statusCode = 403;
    res.end(`PUT operation not supported on /users/${req.params.userId}/writerIds`);
  });
  // Possible delete, awaiting query.

  return userRouter;
};

export const deleteAllUsers = () => {
  if (config.dev) {
    User.remove({}, (err) => {
      if (err) {
        return log.info(err);
      }
      // removed!
    });
  } else {
    log.info('Cannot delete all users unless in dev mode');
  }
};

/* eslint-enable import/prefer-default-export */
