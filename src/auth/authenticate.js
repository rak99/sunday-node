/* eslint-disable max-len */
/* eslint-disable no-else-return */
import jwt from 'express-jwt';
import { Router } from 'express';

const secretKey = require('../SECRET_KEY').jwt.secret;

const authenticated = jwt({
  secret: secretKey,
  credentialsRequired: false,
  getToken: (req) => {
    if (Object.keys(req.query)[0] === null || Object.keys(req.query)[0] === undefined || Object.keys(req.query)[0].length < 1) return req.query.token;
    else if (Object.keys(req.query)[0] !== null || Object.keys(req.query)[0] !== undefined || Object.keys(req.query)[0].length > 0) {
      const stringifiedQuery = JSON.stringify(req.query);
      const firstName = stringifiedQuery.slice(stringifiedQuery.indexOf('firstName=') + 10, stringifiedQuery.indexOf('?lastName'));
      const lastName = stringifiedQuery.slice(stringifiedQuery.indexOf('lastName=') + 9, stringifiedQuery.indexOf('?email'));
      const email = stringifiedQuery.slice(stringifiedQuery.indexOf('email') + 6, stringifiedQuery.length - 2);
      const tokenObj = stringifiedQuery.slice(0, stringifiedQuery.indexOf('?'));
      // Reformat token obj so it includes fName, lName and email (+ token)
      const wholeObjAsString = `${tokenObj}","firstName":"${firstName}","lastName":"${lastName}","email":"${email}"}`;
      const wholeObj = JSON.parse(wholeObjAsString);
      req.query.token = wholeObj.token;
      return req.query.token;
    }
    return null;
  },
});

const checkSession = (req, res, next) => {
  console.log('REQ_SESSION_AT_AUTHHHHHHHHHHHHHHHHHHHHHHHHHHHHH', req.session);
  console.log('REQ_SESSION_USERIDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', req.session.userId, req.sessionID);
  if (req.session && req.session.userId) {
    return next();
  } else {
    const err = new Error('Auth failed');
    res.status(403).send('Unauthorized');
    return next(err);
  }
};

module.exports = { authenticated, checkSession };

