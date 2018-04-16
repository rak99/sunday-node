import Email from 'email-templates';
import { cmd } from '../mail/commands';
import nodemailer from 'nodemailer';
import config from '../config.json';

const transporter = nodemailer.createTransport({
  service: 'postmark',
  auth: {
    user: config.postmark,
    pass: config.postmark,
  },
});

export const sendMail = (template, to, locals, inReplyTo, subject) => {
  // Add commands for use
  locals.cmd = cmd;
  // Create reusable transporter object using the default SMTP transport
  const email = new Email({
    message: {
      from: '"Sunday" <write@sundaystori.es>',
    },
    send: true,
    transport: transporter,
    preview: false, // Toggle here to avoid annoying popup
  });

  email
    .send({
      template,
      message: {
        to,
        subject,
        inReplyTo,
        references: [inReplyTo],
      },
      locals,
    })
    .then(console.log(`${to}: sent ${template}`))
    .catch(console.error);
};
