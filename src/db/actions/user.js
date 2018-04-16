/* eslint-disable import/prefer-default-export */

import User from '../models/user';
import config from '../../config.json';

export const deleteAllUsers = () => {
  if (config.dev) {
    User.remove({}, (err) => {
      if (err) {
        return console.log(err);
      }
      // removed!
    });
  } else {
    console.log('Cannot delete all users unless in dev mode');
  }
};

/* eslint-enable import/prefer-default-export */
