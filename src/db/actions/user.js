/* eslint-disable import/prefer-default-export */

import log from '../../log';
import User from '../models/user';
import config from '../../config.json';

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
