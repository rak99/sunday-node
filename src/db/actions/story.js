/* eslint-disable import/prefer-default-export */

import moment from 'moment';
import Story from '../models/story';

export const createStory = (text, imageUrl) => {
  const story = new Story({ text, imageUrl, timeCreated: moment().format() });
  story.save((err) => {
    if (err) console.log(err);
  });
};

export const deleteStoryData = () => {
  Story.remove({}, (err) => {
    if (err) {
      return console.log(err);
    }
    // removed!
  });
};

/* eslint-enable import/prefer-default-export */
