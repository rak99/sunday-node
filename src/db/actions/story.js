/* eslint-disable no-underscore-dangle */
/* eslint-disable import/prefer-default-export */

import express from 'express';
import mongoose from 'mongoose';
import moment from 'moment';
import sizeOf from 'image-size';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import sharp from 'sharp';
// import cors from 'cors';
import bodyParser from 'body-parser';
import log from '../../log';
import Story from '../models/story';
import config from '../../config.json';
import MailService from '../../api/testMailService';
import User from '../models/user';
import { deleteFile, uploadAttachment } from '../../mail/attachments';
import attach from 'timber/dist/utils/attach';

const DOMParser = require('xmldom').DOMParser;

// main().catch(console.error);

export default ({ config, db }) => {
  const nextSunday = moment().endOf('week')
  .add(12, 'hours').add(1, 'milliseconds');
  // ploadAttachment()

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
    let image = [];
    let promises = [];
    let imagesResolved = [];
    (async function imgParser() {
      if (req.body.images.length > 0) {
        console.log('Func started');
        promises = req.body.images.map(async function(i) {
          const imageBody = i;
          const uri = i.split(';base64,').pop();
          // console.log('URI', uri);
          // eslint-disable-next-line new-cap
          const imgBuffer = new Buffer.from(uri, 'base64');
          // console.log('IMGBUFFER', imgBuffer);
          let storyImgFileName = 'none';
          async function imgUpload(outputBuffer) {
            try {
              // Check if storyImgFileName is still 'none'
              // If not, you already uploaded an image from that email, so skip
              const idOfUploader = await User.findOne({ email: req.body.email })
              .then((user) => {
                return user._id;
              });
              if (storyImgFileName === 'none') {
                // Create a crypto ID
                const cryptoImgId = crypto.randomBytes(10).toString('hex');
                // Set the storyImgFileName correctly
                storyImgFileName = `${cryptoImgId}${idOfUploader.toString()}.png`;
                // Upload the image
                console.log(storyImgFileName);
                // TODO: Look at this for guidance in uploading files through the existing AWS infrastructure.
                console.log('TEMP!', outputBuffer, `${storyImgFileName}`);
                await uploadAttachment(outputBuffer, `${storyImgFileName}`);
                console.log('imgUpload', storyImgFileName);
                Promise.resolve(storyImgFileName);
                return storyImgFileName;
              } else {
                log.info(`${req.body.email}: have image already so will not do anything else`);
              }
            } catch (err) {
              res.status(400).send('Something went wrong', err);
            }
            return storyImgFileName;
          }
          const processedImage = await sharp(imgBuffer)
          .resize(1320)
          .png()
          .toBuffer();
          //console.log('PROCESSSSSSSSSSSSSSED', processedImage);
          await Promise.resolve(image.push(imgUpload(processedImage)));
          console.log('IMAGE', image);
        });
      }
      console.log('PROMISESSSSSSSS', promises);
      await Promise.all(promises);
      console.log('PROMISESSSSSSSS', promises);
      req.body.timeCreated = moment().format();
      req.body.weekCommencing = moment(nextSunday).format();
      User.findOne({ email: req.body.email })
      .then(async (user) => {
        await Promise.all(image)
        .then((images) => {
          imagesResolved = images;
        });
        console.log(user);
        if (user !== null) {
          console.log(user);
          req.body.idOfCreator = user._id;
              // console.log(req.body.text);
          console.log('FINALLLLLLLLLLLLLLLLLLLLLL', image);
          Story.findOne({ idOfCreator: user._id })
          .then(async (storyExist) => {
            if (storyExist !== null) {
              res.status(400).send('User already has a pending story for this Sunday');
            } else {
              console.log('DOCUMENT');
              let doc = new DOMParser().parseFromString(req.body.text, 'text/html');
              console.log('DOCUMENT', doc);
              console.log('DOCCCCCCCCC OVER', doc.getElementsByTagName('img'));
              let k = 0;
              const promise = Object.keys(doc.getElementsByTagName('img')).map(async function (img) {
                Object.keys(doc.getElementsByTagName('img')).forEach((key) => {
                  if (isNaN(parseInt(key)) === true) {
                    console.log('well shit');
                  }
                  else {
                    if (doc.getElementsByTagName('img')[key].getAttribute('class').indexOf('imageClass') >= 0 && k < imagesResolved.length) {
                      // Make var that increments every loop, once for every image in imagesResolved, make var to see how many times it loops
                      console.log('IMAGES_RESOLVED', imagesResolved, imagesResolved[k], k);
                      doc.getElementsByTagName('img')[key].attributes['1'].nodeValue = `https://s3-eu-west-1.amazonaws.com/sundaystories/${imagesResolved[k]}`;
                      doc.getElementsByTagName('img')[key].attributes['1'].value = `https://s3-eu-west-1.amazonaws.com/sundaystories/${imagesResolved[k]}`;
                      console.log('DOCUMENT DOCUMENT', doc.getElementsByTagName('img')[key]);
                    }
                  }
                  k += 1;
                });
              });
              await Promise.all(promise);
              console.log(doc);
              req.body.text = doc;
              console.log('REQ_BODY_TEXT', req.body.text);
              Story.create(req.body)
              .then((story) => {
                console.log('STORYYY', story);
                // Create img parser where we loop through the html string, take apart everything before the image and everything after, then take image and change it's
                // src to the s3 server where image is hosted.
                // If there's more than 1 image it gets quite more complicated, so I'll make a function that parses the entire string, disassembles the
                // images from the rest of the string, changes the source of each image, and then reassembles the string, saving it to story text as a html string
                MailService.create({
                  from: '"Sunday" <write@sundaystori.es>', // sender address
                  to: req.body.email, // list of receivers
                  subject: 'A Sunday Story', // Subject line
                  html: `${story.text}`,
                  // text: `Magic link: ${config.host}/users/me?token=${encodeURIComponent(token)}`,
                });
                // req.body.idOfCreator = req.user._id;
                // console.log('Story Created: ', story);
                // shouldEmail = true;
                // main();
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.json(story);
                // return story;
              }, err => next(err))
              .catch(err => next(err));
            }
          });
        } else {
          console.log('emailaaaaaaa', req.body.email);
          res.status(400).send('User not found');
        }
      });
/*       await Promise.all(
        req.body.images.map(async (attachment) => {
          // eslint-disable-next-line new-cap
          console.log('Attachment', attachment);
          const imgBuffer = new Buffer.from(attachment);
          // const fileName = attachment.fileName;
          // Find out size of image
          const dimensions = sizeOf(imgBuffer);
          // Forget small images, and take first large image
          if (dimensions.width < 660) {
            log.info(
              `${req.body.email}: found small image, will skip (width: ${
                dimensions.width
              })`,
            );
          } else if (dimensions.width > 1320) {
            log.info(
              `${req.body.email}: found large image, will resize (width: ${
                dimensions.width
              })`,
            );
            const processedImage = await sharp(imgBuffer)
              .resize(1320)
              .png()
              .toBuffer();
            await imgUpload(processedImage);
          } else {
            log.info(
              `${req.body.email}: found OK image, will use (width: ${dimensions.width})`,
            );
            const processedImage = await sharp(imgBuffer)
              .png()
              .toBuffer();
            await imgUpload(processedImage)
            .then((img) => {
              console.log('IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE IMAGE ', img);
            });
          }
        }),
      ); */
    }());
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
      if (story !== null) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json(story);
      } else {
        res.status(400).send('Story not found');
      }
    }, err => next(err))
    .catch(err => next(err));
  })
  .put((req, res, next) => {
    Story.findByIdAndUpdate(req.params.storyId, {
      $set: req.body,
    }, { new: true })
    .then((story) => {
      if (story !== null) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json(story);
      } else {
        res.status(400).send('Story not found');
      }
    }, err => next(err))
    .catch(err => next(err));
  })
  .delete((req, res, next) => {
    Story.findByIdAndRemove(req.params.storyId)
    .then((resp) => {
      if (resp !== null) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json({});
      }
      else {
        res.status(400).send('Story not found');
      }
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

