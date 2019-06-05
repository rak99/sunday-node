/* eslint-disable prefer-const */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/prefer-default-export */
import { Router } from 'express';
import querystring from 'querystring';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import moment from 'moment';
import User from '../db/models/user';
import Story from '../db/models/story';
import AuthService from '../middleware/token-create';
import MailService from '../api/testMailService';

const secretKey = require('../SECRET_KEY').jwt.secret;

mongoose.Promise = require('bluebird');

const schema = Joi.object().keys({
  email: Joi.string().email().lowercase().required(),
  firstName: Joi.string(),
  lastName: Joi.string(),
});

export default ({ config, db }) => {
  let isUserReg = false;
  let globalUser = {};
  const authRouter = Router();
  authRouter.use(bodyParser.json());
  authRouter.post('/login', (req, res, next) => {
    const body = schema.validate(req.body);
    if (body.error) return next(body.error);
    return User
    .find({ email: req.body.email })
    .then((list) => {
      console.log('LIST', list);
      if (list.length > 0) {
        console.log(list);
        isUserReg = true;
        globalUser = list[0];
      }
      // if (list.length) return list;
      const userInfo = new Promise((resolve, reject) => {
        resolve({ email: req.body.email, username: req.body.email, _id: mongoose.Types.ObjectId() });
        reject('failed');
        // Now do Create.user(resolve value, list below.)
      });
      // return User.create(req.body)
      return userInfo
      .then((list) => {
        const objArr = [];
        objArr.push(list);
        const secretToken = AuthService.generate(list);
        return secretToken;
      })
      .then((token) => {
        if (isUserReg === false || globalUser.length <= 0) {
          MailService.create({
            from: '"Sunday" <write@sundaystori.es>', // sender address
            to: req.body.email, // list of receivers
            subject: 'Sign up for Sunday Stories', // Subject line
            html: `
            <h1 style="font-size:45px;font-family: 'Times New Roman', Times, serif;padding:15px; text-align:center;">Sunday Stories</h1>
            <h2 style="color:#272728; text-align:center;font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;">Confirm your email and finish creating your account by clicking this link:</h2>
            <p style="margin-top:0;margin-bottom:20px;text-align:center; font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;">
            <a target="_blank" style="color:#ffffff;text-decoration:none;display:inline-block;height:38px;line-height:38px;padding-top:0;padding-right:24px;padding-bottom:0;padding-left:24px;border:0;outline:0;background-color:#272728;font-size:14px;font-style:normal;font-weight:400;text-align:center;white-space:nowrap;border-radius:4px;margin-top:35px;margin-bottom:35px" href="${config.host}/auth/me?token=${encodeURIComponent(token)}?firstName=${req.body.firstName}?lastName=${req.body.lastName}?email=${req.body.email}">Create Your Account</a></p>
            <div style="text-align: center; color:#272728;"><p style="color:#272728; text-align:center;font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;font-size: 15px;">If the above button isn't working, you can click or copy this url and paste it into your browser:<br><a style="text-decoration:none; color:#272728" href="${config.host}/auth/me?token=${encodeURIComponent(token)}?firstName=${req.body.firstName}?lastName=${req.body.lastName}?email=${req.body.email}">${config.host}/auth/me?token=${encodeURIComponent(token)}?firstName=${req.body.firstName}?lastName=${req.body.lastName}?email=${req.body.email}</a></p>
            <p style="font-size:0px;font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;">String.fromCharCode(Math.floor(Math.random()*100), Math.floor(Math.random()*100), Math.floor(Math.random()*100), Math.floor(Math.random()*100))</p><div>
            `,
            // text: `Magic link: ${config.host}/users/me?token=${encodeURIComponent(token)}`,
          });
          return token;
        } else if (globalUser.firstName === 'undefined') {
          MailService.create({
            from: '"Sunday" <write@sundaystori.es>', // sender address
            to: req.body.email, // list of receivers
            subject: 'Log back into Sunday', // Subject line
            html: `
            <h1 style="font-size:45px;font-family: 'Times New Roman', Times, serif;padding:15px; text-align:center;">Sunday Stories</h1>
            <h2 style="color:#272728; text-align:center;font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;">Hi ${globalUser.email}, to finish creating your Sunday story click the link below:</h2>
            <p style="margin-top:0;margin-bottom:20px;text-align:center; font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;">
            <a target="_blank" style="color:#ffffff;text-decoration:none;display:inline-block;height:38px;line-height:38px;padding-top:0;padding-right:24px;padding-bottom:0;padding-left:24px;border:0;outline:0;background-color:#272728;font-size:14px;font-style:normal;font-weight:400;text-align:center;white-space:nowrap;border-radius:4px;margin-top:35px;margin-bottom:35px" href="${config.host}/auth/me?token=${encodeURIComponent(token)}?firstName=${req.body.firstName}?lastName=${req.body.lastName}?email=${req.body.email}">Create Your Account</a></p>
            <div style="text-align: center; color:#272728;"><p style="color:#272728; text-align:center;font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;font-size: 15px;">If the above button isn't working, you can click or copy this url and paste it into your browser:<br><a style="text-decoration:none; color:#272728" href="${config.host}/auth/me?token=${encodeURIComponent(token)}?firstName=${req.body.firstName}?lastName=${req.body.lastName}?email=${req.body.email}">${config.host}/auth/me?token=${encodeURIComponent(token)}?firstName=${req.body.firstName}?lastName=${req.body.lastName}?email=${req.body.email}</a></p>
            <p style="font-size:0px;font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;">String.fromCharCode(Math.floor(Math.random()*100), Math.floor(Math.random()*100), Math.floor(Math.random()*100), Math.floor(Math.random()*100))</p><div>
            `,
            // text: `Magic link: ${config.host}/users/me?token=${encodeURIComponent(token)}`,
          });
          return token;
        } else {
          MailService.create({
            from: '"Sunday" <write@sundaystori.es>', // sender address
            to: req.body.email, // list of receivers
            subject: 'Log back into Sunday', // Subject line
            html: `
            <h1 style="font-size:45px;font-family: 'Times New Roman', Times, serif;padding:15px; text-align:center;">Sunday Stories</h1>
            <h2 style="color:#272728; text-align:center;font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;">Hi ${globalUser.firstName}, to log back into Sunday just click this link below:</h2>
            <p style="margin-top:0;margin-bottom:20px;text-align:center; font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;">
            <a target="_blank" style="color:#ffffff;text-decoration:none;display:inline-block;height:38px;line-height:38px;padding-top:0;padding-right:24px;padding-bottom:0;padding-left:24px;border:0;outline:0;background-color:#272728;font-size:14px;font-style:normal;font-weight:400;text-align:center;white-space:nowrap;border-radius:4px;margin-top:35px;margin-bottom:35px" href="${config.host}/auth/me?token=${encodeURIComponent(token)}?firstName=${req.body.firstName}?lastName=${req.body.lastName}?email=${req.body.email}">Log In</a></p>
            <div style="text-align: center; color:#272728;"><p style="color:#272728; text-align:center;font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;font-size: 15px;">If the above button isn't working, you can click or copy this url and paste it into your browser:<br><a style="text-decoration:none; color:#272728" href="${config.host}/auth/me?token=${encodeURIComponent(token)}?firstName=${req.body.firstName}?lastName=${req.body.lastName}?email=${req.body.email}">${config.host}/auth/me?token=${encodeURIComponent(token)}?firstName=${req.body.firstName}?lastName=${req.body.lastName}?email=${req.body.email}</a></p>
            <p style="font-size:0px;font-family:Roboto,RobotoDraft,Helvetica,Arial,sans-serif;">String.fromCharCode(Math.floor(Math.random()*100), Math.floor(Math.random()*100), Math.floor(Math.random()*100), Math.floor(Math.random()*100))</p><div>
            `,
            // text: `Magic link: ${config.host}/users/me?token=${encodeURIComponent(token)}`,
          });
          return token;
        }

      })
      .then((derp) => {
        res.statusCode = 200;
        // res.setHeader('Content-Type', 'application/json');
        res.json(req.body);
      })
      .catch(next);
    });
  });
  authRouter.get('/me', (req, res, next) => {
      //  ------ TODO ------
      // Split token in 2, send ~half to email, and full token to app - then compare fullToken to halftoken + secondHalfOfFullToken
      // if ===
      // authed
      console.log('not logged?????');
    if (req.user) {
      console.log('is logged?');
      jwt.verify(req.query.token, secretKey, (err, authorized) => {
        if (err) {
          res.status(403).send('Unauthorized access', err);
        } else {
          // res.status(200).send('Successful registration', authorized);
          // User.create()
          const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          // res.json(req.user)
          // Do this today
          const firstName = fullUrl.slice(fullUrl.indexOf('firstName=') + 10, fullUrl.indexOf('?lastName'));
          const lastName = fullUrl.slice(fullUrl.indexOf('lastName=') + 9, fullUrl.indexOf('?email'));
          const email = fullUrl.slice(fullUrl.indexOf('email') + 6, fullUrl.length);
          const token = req.query.token;
          const query = querystring.stringify({
            token,
            firstName,
            lastName,
            email,
          });
          User.findOne({ email })
          .then((user) => {
            console.log('BODYYYYYYYYYYYYYYYYYYYYYYYYYYYAAAAAAAA');
            if (user === null) {
              User.create({ _id: req.user.id, username: email, firstName, lastName, email, timeCreated: moment().format() })
              .then((user) => {
                req.session.userId = req.user.id;
                console.log('REQ_SESSION_AT_REDIR', req.session, 'REQ_SESSION_USER_ID', req.session.userId);
                // return res.redirect(`http://www.publicdomain.com:3000/story-review?${query}`);
                return res.redirect(`http://localhost:3000/home?${query}`);
              });
              // res.json(token);
              // req.session.userId =
            } else {
              console.log('WORKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKS');
              req.session.userId = req.user.id;
              console.log('REQ_SESSION_AT_REDIR', req.session, 'REQ_SESSION_USER_ID', req.session.userId);
              return res.redirect(`http://localhost:3000/home?${query}`);
            }
          })
          .catch((err_1) => {
            const error = new Error('Unhandled exception');
            return next(error);
          });
        }
      });
    } else {
      return res
    .status(401)
    .send({ message: 'not authenticated' });
    }
    // Handle retrieving user, I think this is login and post is sign up;
  });

  return authRouter;
};

/* eslint-enable import/prefer-default-export */
