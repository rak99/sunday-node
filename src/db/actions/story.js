/* eslint-disable import/prefer-default-export */

import Story from '../models/story';
import config from '../../config.json';

export const deleteAllStories = () => {
  if (config.dev) {
    Story.remove({}, (err) => {
      if (err) {
        return console.log(err);
      }
      // removed!
    });
  } else {
    console.log('Cannot delete all stories unless in dev mode');
  }
};

export const deleteStory = (id) => {
  Story.remove({ _id: id }, (err) => {
    if (err) {
      return console.log(err);
    }
    // removed!
  });
};

/* eslint-enable import/prefer-default-export */
