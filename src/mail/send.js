import Email from 'email-templates';
import { cmd } from '../mail/commands';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'postmark',
  auth: {
    user: '2d4cecb2-6b78-4d38-9a07-5f0878b3f557',
    pass: '2d4cecb2-6b78-4d38-9a07-5f0878b3f557', // should not have this here
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
