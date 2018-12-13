/* eslint-disable import/prefer-default-export */

import express from 'express';
import mongoose from 'mongoose';
import moment from 'moment';
// import cors from 'cors';
import bodyParser from 'body-parser';
import log from '../../log';
import Story from '../models/story';
import config from '../../config.json';

export default ({ config, db }) => {
  const nextSunday = moment().endOf('week')
  .add(12, 'hours').add(1, 'milliseconds');

  const storyRouter = express.Router();
  storyRouter.use(bodyParser.json());

  // Add authentication, maybe Cors.

  // /stories

  storyRouter.route('/')
  // .options(cors.corsWithOptions, (req, res) => { res.sendStatus(200); })
  .get((req, res, next) => {
    Story.find({})
    .then((stories) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.json(stories);
    }, err => next(err))
    .catch(err => next(err));
  })

  // Some fields are not required which
  // may seem like they should be

  // Configure timeCreated and WeekCommencing keys.

  .post((req, res, next) => {
    req.body.timeCreated = moment().format();
    req.body.weekCommencing = moment(nextSunday).format();
    console.log(req.body.text);
    Story.create(req.body)
    .then((story) => {
      console.log('Story Created: ', story);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.json(story);
      // return story;
    }, err => next(err))
    .catch(err => next(err));
  })

  .delete((req, res, next) => {
    Story.remove({})
    .then((resp) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.json(resp);
    }, err => next(err))
    .catch(err => next(err));
  });

  // ------storyId------

  storyRouter.route('/:storyId')

  .get((req, res, next) => {
    Story.findById(req.params.storyId)
    .then((story) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.json(story);
    }, err => next(err))
    .catch(err => next(err));
  });

  return storyRouter;
};

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

