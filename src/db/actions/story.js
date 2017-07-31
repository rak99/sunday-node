/* eslint-disable import/prefer-default-export */

import Story from '../models/story';

export const createStory = (text) => {
  const story = new Story({ text });
  story.save((err) => {
    if (err) console.log(err);
  });
};

/* eslint-enable import/prefer-default-export */
