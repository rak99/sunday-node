import MailListener from 'mail-listener2';
import _ from 'lodash';
import fs from 'fs';
import parseReply from 'parse-reply';
import moment from 'moment';
import sizeOf from 'image-size';

import User from '../db/models/user';
import { deleteUserData } from '../db/actions/user';
import { searchName, searchEmails, firstNameVariants, lastNameVariants } from '../mail/utils';
import uploadAttachment from '../mail/attachments';
import { sendMail } from '../mail/send';

// sendMail('mars', 'louis.barclay@gmail.com', locals, inReplyTo, optionalSubject);

sendMail('on_sunday', 'louis.barclay@gmail.com', { names: 'Julie, Tim and Banjo', stories: [['This is a beautiful Mongolian landscape', 'http://www.toursmongolia.com/uploads/Mongolia_landscape_Photography_by_Bayar.jpg'], ['Here is Japan', 'https://www.kanpai-japan.com/sites/default/files/uploads/2012/08/kurama-4.jpg']] });

// For testing
deleteUserData();

let email1 = fs.readFileSync('./src/mail/tests/email_with_names_and_emails.json', 'utf8');
email1 = JSON.parse(email1);

let email2 = fs.readFileSync('./src/mail/tests/email_to_create_story.json', 'utf8');
email2 = JSON.parse(email2);

const mailListener = new MailListener({
  username: 'louis@sundaystori.es',
  password: 'sundaystories1989',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  connTimeout: 10000, // Default by node-imap
  authTimeout: 5000, // Default by node-imap,
  debug: null, // Or your custom function with only one incoming argument. Default: null
  tlsOptions: { rejectUnauthorized: false },
  mailbox: 'INBOX', // mailbox to monitor
  searchFilter: ['UNSEEN'], // the search filter being used after an IDLE notification has been retrieved
  markSeen: true, // all fetched email willbe marked as seen and not fetched next time
  fetchUnreadOnStart: true, // use it only if you want to get all unread email on lib start
  mailParserOptions: { streamAttachments: false }, // options to be passed to mailParser lib.
  attachments: true, // download attachments as they are encountered to the project directory
  attachmentOptions: { directory: 'attachments/' }, // specify a download directory for attachments
});

// URL format is here:
// https://s3-eu-west-1.amazonaws.com/sundaystories/ladbrokesq.PNG
// https://s3-eu-west-1.amazonaws.com/sundaystories/lenblavatnik+school+of+govt.PNG
// https://s3-eu-west-1.amazonaws.com/sundaystories/testfile
// how does email work. if you don't attach - just link - will that image disappear after?
// how does mailSender work. can you attach? how does that all go down?

async function processMail(mail) {
  try {
    const email = mail.from[0].address;
    console.log(email);
    // Look up user record from email
    const findUser = await User.findOne({ email }, 'email firstName receiveFromIds');
    // If user has email. if user has first name. if email has specific command.
    // if email has attachment. if there is a story already for that user this week
    //
    console.log(findUser);
    if (findUser) {
      const text = parseReply(mail.text); // Should use talon instead
      console.log(`Email text: \n${text}`);
      // If there is no firstName and user is not a referred user, ask for more info
      // TODO: fix referredBy property
      if (_.isUndefined(findUser.firstName)) {
        // See if it's a user wanting to be taken out from another's distribution
        if (text.includes('TAKEMEOUT')) {
          // Reply confirming
          // TODO: this
          // Send email to their referrer saying no thank you
          return;
        }

        // Check the email to see if it's been provided
        const firstName = searchName(text, firstNameVariants);
        const lastName = searchName(text, lastNameVariants);
        const emails = searchEmails(text);

        if (!firstName && !lastName && !emails) {
          // Sorry, we need info to proceed
          sendMail('on_noinfo', email, {}, mail.messageId, mail.subject);
          console.log('No info has been provided');
        } else {
          // We got the info, so we update it
          const update = await User.update({ email }, { firstName, lastName }, { multi: true });
          console.log(update);
          // Check if users exist
          await Promise.all(
            emails.map(async (referredEmail) => {
              // Method from here https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
              const findReferredUser = await User.findOne(
                { email: referredEmail },
                'email firstName',
              );
              if (findReferredUser) {
                console.log(`${referredEmail} already exists - will send on_receivefriendrequest`);
                // Add to receiveFromIds
                // Send email saying 'X has added you. If not cool, let us know'
                sendMail('on_receivefriendrequest', referredEmail, { firstName, lastName, email });
              } else {
                console.log(`${referredEmail} does not exist so will create and send on_invite`);
                const newUser = new User({
                  email: referredEmail,
                  timeCreated: moment().toString(),
                  referredBy: email,
                }); // Change to moment.js
                const saveConfirm = await newUser.save();
                console.log(saveConfirm);
                sendMail('on_invite', referredEmail, { firstName, lastName, email });
              }
            }),
          );
        }
      } else {
        // User is properly registered
        console.log(`${email}, registered user, sent an email`);
        // Check for a command
        if (text.includes('DELETE')) {
          // Reply confirming
          // Send email to the recipient confirming
          return;
        }
        if (text.includes('REMOVEIMAGE')) {
          // Reply confirming
          return;
        }
        if (text.includes('QUESTION')) {
          // Forward it to my personal inbox
          return;
        }

        // No command so assume it's a story
        // If there are attachments
        if (!_.isUndefined(mail.attachments)) {
          for (let i = 0; i < mail.attachments.length; i++) {
            const attachment = mail.attachments[i];
            const attachmentType = attachment.contentType;
            if (attachmentType.includes('image')) {
              const buffer = new Buffer.from(attachment.content);
              const fileName = attachment.fileName;
              console.log(`Image: ${fileName}, ${attachmentType}`);
              const dimensions = sizeOf(buffer);
              console.log(dimensions);
              // Is it an image?
              // If it's really small, ignore it - below certain dimensions especially width
              // If it's really big, compress it - to what dimensions?
              // What is the max width when put into the story going to be?
              // uploadAttachment(buffer, 'turkeypic.jpg');
            }
          }
        }
        if (text.includes('STOP')) {
          // Forward it to my personal inbox
          return;
        }

        // Or if no commands, log a story and reply saying story created
        // If that's not what you wanted, let us know
      }
    } else {
      console.log(`${email} not found so will create, and send on_signup`);
      // Create user
      const newUser = new User({ email, timeCreated: moment().toString(), referredBy: email }); // Change to moment.js
      const saveConfirm = await newUser.save();
      // Send an invite email
      sendMail('on_signup', email, {}, mail.messageId, mail.subject);
      console.log(saveConfirm);
      // Send email asking to sign up
    }
  } catch (e) {
    console.log(e);
  }
}

// processMail(email1);
// processMail(email2);

const listener = {
  start: () => {
    mailListener.start();

    mailListener.on('server:connected', () => {
      console.log('imapConnected');
    });

    mailListener.on('server:disconnected', () => {
      console.log('imapDisconnected');
    });

    mailListener.on('mail', (mail, seqno, attributes) => {
      processMail(mail);
      // fs.writeFile(`./src/mail/tests/${mail.subject}.json`, JSON.stringify(mail), 'binary', err => {
      //   if (err) console.log(err);
      //   else console.log('File saved');
      // });
    });

    mailListener.on('attachment', (attachment) => {
      // uploadAttachment(attachment.stream);
    });

    mailListener.on('error', (err) => {
      console.log(err);
    });
  },
};

// if sunday
// for every user
// examine receiveFromIds
// look up each receiveFrom user
// do they have a story for this week?
// how many have a story for this week
// if yes, take story and add into email

export default listener;
