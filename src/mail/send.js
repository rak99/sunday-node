import nodemailer from 'nodemailer';
import Email from 'email-templates';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // secure:true for port 465, secure:false for port 587
  auth: {
    user: 'louis@sundaystori.es',
    pass: 'sundaystories1989', // should not have this here
  },
});

export const sendMail = (template, to, locals, inReplyTo, subject) => {
  // Create reusable transporter object using the default SMTP transport
  const email = new Email({
    message: {
      from: '"Sunday Stories" <louis@sundaystori.es>',
    },
    send: true,
    transport: transporter,
    preview: false,
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
    .then(console.log)
    .catch(console.error);
};
