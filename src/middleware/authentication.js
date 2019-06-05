import jwt from 'express-jwt';
import secretKey from '../SECRET_KEY';

const authenticated = jwt({
  secret: secretKey.jwt.secret,
  credentialsRequired: false,
  getToken: (req) => {
    if (req.query) return req.query.token;
    return null;
  },
});

module.exports = { authenticated };

