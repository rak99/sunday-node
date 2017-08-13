import MailListener from "mail-listener2";
import { simpleParser } from "mailparser";
import _ from "lodash";
import nodemailer from "nodemailer";
import { createStory } from "../db/actions/story";

// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // secure:true for port 465, secure:false for port 587
  auth: {
    user: "louis@sundaystori.es",
    pass: "sundaystories1989"
  }
});

function mailReply(mailObject) {
  const mailOptions = {
    from: '"Louis Barclay" <louis@sundaystori.es>', // sender address
    to: mailObject.from.address, // list of receivers
    subject: mailObject.subject, // Subject line
    text:
      "I really appreciate your fantastic input, thank you so much for emailing me", // plain text body
    html:
      "<b><i>I really appreciate your fantastic input, thank you so much for emailing me</i></b>" // html body
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log("Message %s sent: %s", info.messageId, info.response);
  });
}

const mailListener = new MailListener({
  username: "louis@sundaystori.es",
  password: "sundaystories1989",
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  connTimeout: 10000, // Default by node-imap
  authTimeout: 5000, // Default by node-imap,
  debug: null, // Or your custom function with only one incoming argument. Default: null
  tlsOptions: { rejectUnauthorized: false },
  mailbox: "INBOX", // mailbox to monitor
  searchFilter: ["UNSEEN"], // the search filter being used after an IDLE notification has been retrieved
  markSeen: true, // all fetched email willbe marked as seen and not fetched next time
  fetchUnreadOnStart: true, // use it only if you want to get all unread email on lib start. Default is `false`,
  mailParserOptions: { streamAttachments: false }, // options to be passed to mailParser lib.
  attachments: true, // download attachments as they are encountered to the project directory
  attachmentOptions: { directory: "attachments/" } // specify a download directory for attachments
});

const listener = {
  start: () => {
    mailListener.start();

    mailListener.on("server:connected", () => {
      console.log("imapConnected");
    });

    mailListener.on("server:disconnected", () => {
      console.log("imapDisconnected");
    });

    mailListener.on("mail", (mail, seqno, attributes) => {
      console.log(Object.keys(mail));
      const mailObject = _.pick(mail, ["text", "subject", "from"]);
      const html = mail.html;
      const attachments = mail.attachments;
      // console.log(attachments);
      console.log(html);
      console.log(attachments);
      mailObject.from = mailObject.from[0];
      createStory(mailObject.text);
    });

    mailListener.on("attachment", function(attachment) {
      console.log(attachment.path);
      console.log(attachment);
    });

    mailListener.on("error", err => {
      console.log(err);
    });
  }
};

export default listener;
