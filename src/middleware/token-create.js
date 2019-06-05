import jwt from 'jsonwebtoken';

const secretKey = require('../SECRET_KEY').jwt.secret;

const generate = (account) => {
  return Promise.resolve(jwt.sign({ id: account._id }, secretKey, { expiresIn: '30m' }));
};

module.exports = { generate };
