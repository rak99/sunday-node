/* eslint-disable import/prefer-default-export */

import log from '../../log';
import Story from '../models/story';
import config from '../../config.json';

export const deleteAllStories = () => {
  if (config.dev) {
    Story.remove({}, (err) => {
      if (err) {
        return log.info(err);
      }
      // removed!
    });
  } else {
    log.info('Cannot delete all stories unless in dev mode');
  }
};

export const deleteStory = (id) => {
  Story.remove({ _id: id }, (err) => {
    if (err) {
      return log.info(err);
    }
    // removed!
  });
};

/* eslint-enable import/prefer-default-export */
