import nodemailer from 'nodemailer';
import Email from 'email-templates';
import log from '../log';
import { cmd } from '../mail/commands';
import { dummies, dummyname } from '../mail/dummies';
import { boundaries } from '../mail/boundaries';
import config from '../config.json';

const transporter = nodemailer.createTransport({
  service: 'postmark',
  auth: {
    user: config.postmark,
    pass: config.postmark,
  },
});

if (!config.dev) {
  config.preview = false;
}

const create = options =>
  transporter.sendMail(options);

module.exports = { create };
