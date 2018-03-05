import MailListener from 'mail-listener2';
import _ from 'lodash';
import fs from 'fs';
import parseReply from 'parse-reply';
import User from '../db/models/user';
import { deleteUserData } from '../db/actions/user';
import { searchName, searchEmails, firstNameVariants, lastNameVariants } from '../mail/utils';
import sizeOf from 'image-size';
import uploadAttachment from '../mail/attachments';

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
  fetchUnreadOnStart: true, // use it only if you want to get all unread email on lib start. Default is `false`,
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

// emailHasUser(test1, handleMail);
// setTimeout(() => {
//   emailHasUser(test2, handleMail);
// }, 3000);

async function processMail(mail) {
  try {
    const email = mail.from[0].address;
    // Look up user record from email
    const findUser = await User.findOne({ email }, 'email firstName receiveFromIds');
    // If user has email. if user has first name. if email has specific command.
    // if email has attachment. if there is a story already for that user this week
    //
    if (findUser) {
      const text = parseReply(mail.text); // Should use talon instead
      console.log(`Email text: \n${text}`);
      // If there is no firstName, ask for more info
      if (_.isUndefined(findUser.firstName)) {
        console.log('User has no first name');
        // Check the email to see if it's been provided
        const firstName = searchName(text, firstNameVariants);
        const lastName = searchName(text, lastNameVariants);
        const emails = searchEmails(text);
        console.log(firstName);
        console.log(lastName);
        console.log(emails);
        if (!firstName && !lastName && !emails) {
          // No info has been provided
          // Sorry, we need info to proceed
          console.log('No info has been provided');
        } else {
          console.log('User exists without first name etc.');
          // Update first name and last name
          const update = await User.update({ email }, { firstName, lastName }, { multi: true });
          console.log(update);
          // Check if users exist
          await Promise.all(
            emails.map(async referredEmail => {
              // Method from here https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
              const findReferredUser = await User.findOne(
                { email: referredEmail },
                'email firstName',
              );
              console.log(findReferredUser);
              if (findReferredUser) {
                console.log(`${referredEmail} already exists`);
                // Add to receiveFromIds
                // Send email saying 'X has added you. If not cool, let us know'
              } else {
                console.log(`${referredEmail} does not exist so will create`);
                const newUser = new User({
                  email: referredEmail,
                  timeCreated: _.now(),
                  referredBy: email,
                }); // Change to moment.js
                const saveConfirm = await newUser.save();
                console.log(saveConfirm);
                // Send them an email saying hey:
                // You will receive from X
                // If you don't want to, you can unsub from THEM
                // If you don't want Sunday EVER, you can delete yourself forever
                // If you want to send stories yourself, 
                // Give us emails (all of them - including of person who invited you)
                // 
              }
              // Check if users exist
              // Send an email to say 'hey, someone new wants to send you stories'?
              // Create referred user
              // Send each an email asking them if they want to sign up
            }),
          );
        }
      } else {
        // User is properly registered
        console.log(`${email}, registered user, sent an email`);
        // Check for a command
        if (text.includes('delete image')) {
          console.log('delete the image');
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
        // If there is a firstName,
        // Search text for commands
        // Or if no commands, log a story and reply saying story created
        // If that's not what you wanted, let us know
      }
    } else {
      console.log(`${email} not found so will create`);
      // Create user
      const newUser = new User({ email, timeCreated: _.now(), referredBy: 'direct' }); // Change to moment.js
      const saveConfirm = await newUser.save();
      console.log(saveConfirm);
    }
    // handlemail comes next
  } catch (e) {
    console.log(e);
  }
}

processMail(email1);
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
      fs.writeFile(`./src/mail/tests/${mail.subject}.json`, JSON.stringify(mail), 'binary', err => {
        if (err) console.log(err);
        else console.log('File saved');
      });
    });

    mailListener.on('attachment', attachment => {
      // uploadAttachment(attachment.stream);
    });

    mailListener.on('error', err => {
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
