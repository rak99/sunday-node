/* eslint-disable prefer-const */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/prefer-default-export */
import { Router } from 'express';
import querystring from 'querystring';
import session from 'express-session';
import Joi from 'joi';
import moment from 'moment';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import User from '../models/user';
import log from '../../log';
import Story from '../models/story';
import AuthService from '../../middleware/token-create';
import MailService from '../../api/testMailService';

mongoose.Promise = require('bluebird');

const schema = Joi.object().keys({
  email: Joi.string().email().lowercase().required(),
});

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
    // Still configure lastSentSunday and referredBy, unless handled by already made app. Probably not referred by.
    let userId = '';
    User.findOne({ email: req.body.email })
    .then(async (user) => {
      try {
        if (user === null) {
          const jobQueries = [];
          req.body.timeCreated = moment().format();
          req.body.writerIds = [];
          try {
            // const listOfJobs = await Promise.all(jobQueries);
            jobQueries.push(
              User.create(req.body)
              .then((user2) => {
                console.log('not again');
                console.log(user2);
                userId = user2._id;
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.json(user2);
              }, err => next(err)),
            );
          } catch (error) {
            res.status(500).send('one of the queries failed', error);
          }
          // So if a user has a writerIds field, it's an array with the Object ID of a user they are receiving stories from, not sending stories to
          // Reconfigure API to account for this.
          // Gonna have to create user 1st I believe, or do a promise create.
          await Promise.all(jobQueries);
          req.body.recipients.forEach((i) => {
            console.log(i);
            User.findOne({ email: i })
            .then((user1) => {
              if (user1 !== null) {
                console.log(`User with email ${i} already in database or 'registered'`);
                console.log(`User with email ${i} already in database or 'registered'`);
                console.log(`User with email ${i} already in database or 'registered'`);
                console.log(`User with email ${i} already in database or 'registered'`);
                console.log(`User with email ${i} already in database or 'registered'`);
                console.log(`User with email ${i} already in database or 'registered'`);
                console.log(`User with email ${i} already in database or 'registered'`);
                console.log(`User with email ${i} already in database or 'registered'`);
                console.log(`User with email ${i} already in database or 'registered'`);
                console.log(user1);
                // Make it so only one email per person though, so not duplicate emails,
                // else this might be bypassable below
                // User.findOne({ email: req.body.recipients[0] });
                req.body.writerIds.push(userId);
              } else if (user1 === null) {
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                console.log('User not found within database, so register user with email in recipients');
                User.create({ email: i, writerIds: [userId], timeCreated: moment().format() })
                .then((recipUser) => {
                  console.log(`user: ${recipUser} created`);
                  req.body.writerIds.push(userId);
                });
              } else {
                console.log('unhandled exception');
              }
            });
          });
        } else {
          console.log('user exists');
          res.status(400).send('User already registered, can\'t send 2 stories');
        }
      } catch (error) {
        res.status(500).send('something failed', error);
      }
    });
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
      if (user !== null) {
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
    let userId = '';
    let usersRecipients = [];
    User.findByIdAndUpdate(req.params.userId, {
      $set: req.body,
    }, { new: true })
    .then((user) => {
      if (user !== null) {
        usersRecipients = req.body.recipients;
        console.log('USERRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', user, user._id);
        userId = user._id;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json(user);
      } else {
        res.status(400).send('User not found');
      }
    }, err => next(err))
    .then(() => {
      usersRecipients.forEach((item) => {
        User.findOne({ email: item })
        .then((user) => {
          if (user !== null) {
            user.writerIds.push(userId);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.json(user);
          } else {
            User.create({ email: item, writerIds: userId })
            .then((user2) => {
              console.log(user2);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.json(user);
            })
            .catch(err => next(err));
          }
        });
      });
    })
    .catch(err => next(err));
  })
  .delete((req, res, next) => {
    User.findByIdAndRemove(req.params.userId)
    .then((resp) => {
      if (resp !== null) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json({});
      } else {
        res.status(400).send('User not found');
      }
    }, err => next(err))
    .catch(err => next(err));
  });

  // -----userid/writeIds-----

  userRouter.route('/:userId/writerIds')
  .get((req, res, next) => {
    User.findById(req.params.userId)
    .then((user) => {
      if (user !== null) {
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
  .patch((req, res, next) => {
    User.findById(req.params.userId)
    .then((user) => {
      if (user !== null) {
        req.body.writerIds = [];
        req.body.recipients.map((recip) => {
          User.find({ email: recip }, '_id')
          .then((recipUser) => {
            console.log(recipUser.length);
            if (recipUser !== null && recipUser.length > 0) {
              // console.log(recipUser[0]._id);
              // If user is found, push their id into writerIds
              // req.body = {};
              console.log(recipUser[0]._id);
              req.body.writerIds.push(recipUser[0]._id);
              console.log(req.body);
              // Push user to writerId
            } else {
              // If user is not found - create user and then push to writerId
              User.create({ email: recip, timeCreated: moment().format() })
              .then((newRecipUser) => {
                // console.log(newRecipUser);
                // console.log(newRecipUser._id);
                // req.body = {};
                console.log(newRecipUser._id);
                req.body.writerIds.push(newRecipUser._id);
                console.log(req.body);
              });
            }
          }).catch((err) => {
            res.status(400).send('one of the queries failed', err);
            return next(err);
          });
        });
        setTimeout(() => {
          User.findByIdAndUpdate(req.params.userId, {
            $set: req.body,
          }, { new: true })
          .then(() => {
            if (user !== null) {
              console.log('recip length', req.body.recipients.length);
              // console.log('derp', derp);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.json(user.writerIds);
            } else {
              res.status(400).send('User not found');
            }
          });
        }, req.body.recipients.length * 600);
      } else {
        const err = new Error(`User + ${req.params.userId} + ' not found`);
        err.statusCode = 404;
        return next(err);
      }
    }, err => next(err))
    .catch(err => next(err));
  })
  //  *** --- DO PUT HERE --- ***
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
  userRouter.route('/:userId/writerIds/:writerId')
  .get((req, res, next) => {
    User.findById(req.params.userId)
    .then((user) => {
      if (user !== null && User.findById(req.params.writerId) !== null) {
        console.log(user);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json(req.params.writerId);
        // res.json(user.writerIds.id(req.params.writerId));
      } else {
        const err = new Error(`User + ${req.params.userId} + ' not found`);
        err.statusCode = 404;
        return next(err);
      }
    }, err => next(err))
    .catch(err => next(err));
  });

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
