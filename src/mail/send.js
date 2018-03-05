import nodemailer from 'nodemailer';

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // secure:true for port 465, secure:false for port 587
  auth: {
    user: 'louis@sundaystori.es',
    pass: 'sundaystories1989', // should not have this here
  },
});

function mailSend(email, subject, text, html) {
  const mailOptions = {
    from: '"Sunday Stories" <louis@sundaystori.es>', // sender address
    to: email,
    subject,
    text,
    html,
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log('Message %s sent: %s', info.messageId, info.response);
  });
}
