import MailListener from 'mail-listener4';
import _ from 'lodash';
import fs from 'fs';
import parseReply from 'parse-reply';
import moment from 'moment';
import sizeOf from 'image-size';
import sharp from 'sharp';
import talon from 'talon';
import crypto from 'crypto';
import Humanize from 'humanize-plus';
import User from '../db/models/user';
import Story from '../db/models/story';
import { cmd } from '../mail/commands';
import { createStory } from '../db/actions/story';
import { deleteUserData } from '../db/actions/user';
import { deleteStoryData } from '../db/actions/story';
import {
  searchName,
  searchEmails,
  firstNameVariants,
  lastNameVariants,
  prettifyStory,
  searchAddAndRemove,
} from '../mail/utils';
import uploadAttachment from '../mail/attachments';
import { sendMail } from '../mail/send';

const parseWithTalon = talon.signature.bruteforce.extractSignature;

// sendMail('mars', 'louis.barclay@gmail.com', locals, inReplyTo, optionalSubject);

const sundayRecipient = 'louis.barclay@gmail.com';
const sundayNames = 'Julie, Tim and Banjo';
const story1 = [
  'Julie Simpson',
  '6pm, Tuesday',
  'This is a beautiful Mongolian landscape',
  'http://www.toursmongolia.com/uploads/Mongolia_landscape_Photography_by_Bayar.jpg',
];
const story2 = [
  'Matthew Gleab',
  '1pm, Saturday',
  'This is another story',
  'http://www.toursmongolia.com/uploads/Mongolia_landscape_Photography_by_Bayar.jpg',
];
// sendMail('on_sunday', sundayRecipient, { names: sundayNames, stories: [story1, story2] });

const tests = fs.readdirSync('./emails/tests/');

const deleteData = false;
const chooseTests = ['6'];
const testDelay = 10000;
// const chooseTests = false;
runTests();

function runTests() {
  if (deleteData) {
    // TODO: Make sure this setting is correct
    deleteUserData();
    deleteStoryData();
  }
  // Empty array to store tests starting with number
  const testsStartingWithNumber = [];
  // Grab tests starting with number and store
  tests.forEach((test) => {
    if (!isNaN(test[0])) {
      if (chooseTests) {
        if (chooseTests.indexOf(test[0]) > -1) {
          testsStartingWithNumber.push(test);
        }
      } else {
        testsStartingWithNumber.push(test);
      }
    }
  });
  // Sort by number
  testsStartingWithNumber.sort();
  // Function to deploy a test
  function deployTest(testFileName) {
    const testObject = JSON.parse(fs.readFileSync(`./emails/tests/${testFileName}`, 'utf8'));
    console.log(`Running test '${testFileName}'`);
    processMail(testObject);
  }
  // Timeout
  function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  // Function to run all tests with specified delay
  async function runWithDelay(array) {
    for (const item of array) {
      await timeout(testDelay); // Change delay here
      deployTest(item);
    }
  }
  runWithDelay(testsStartingWithNumber);
}

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

const imgMsgs = {
  noImg:
    "We didn't find any attached image large enough to include in your story. If you want to include an image, reply to this email including the original story, and with an image attached which is at least 660 pixels wide.",
  oneImg:
    'We found an image with your story and have included it below. If this is the wrong image, reply to this email with your original story in the reply and the new image attached. If you decide you no longer want an image, simply reply to this email with your original story only, and no image.',
};

async function processMail(mail) {
  try {
    const email = mail.from[0].address;

    // Look up user record from email
    const findUser = await User.findOne(
      { email },
      'email firstName _id writerIds currentStoryId referredBy',
    );
    if (!findUser) {
      // If user doesn't exist
      console.log(`${email} not found so will create, and send on_signup`);

      // Create user
      const newUser = new User({
        email,
        timeCreated: moment().format(),
        referredBy: 'direct',
        currentStoryId: false,
      });
      const createNewUser = await newUser.save();
      console.log(`${createNewUser.email} saved as new user`);

      // Send on_signup email asking them for further details
      sendMail('on_signup', email, {}, mail.messageId, mail.subject);
    } else {
      // If user does exist

      // Define the user ID
      const id = findUser._id;

      // Parse the reply
      const reply = parseReply(mail.text);
      const text = parseWithTalon(reply).text; // Should use talon instead

      // Print the email text
      console.log(`Email from ${email}: \n${text.substring(0, 100)}`);

      // TODO: fix referredBy property
      // If there is no firstName and user is not a referred user, ask for more info
      if (_.isUndefined(findUser.firstName)) {
        // Check if friend request got rejected
        if (text.includes(cmd.rejectFriendRequest)) {
          // Assuming there is a referral email (always should be, send 'on_rejectinvite')
          if (findUser.referredBy !== 'direct') {
            console.log(`${email} referred by: ${findUser.referredBy}`);
            sendMail('on_rejectinvite', findUser.referredBy, {});
          }
          User.remove({ email }, (err) => {
            if (err) {
              return console.log(err);
            }
          });
          sendMail('on_deleteaccount', email, {}, mail.messageId, mail.subject);
          // Maybe just delete their account entirely?
          // Tell their referral email person that they are not interested
          // Reply confirming
          // Tell their referrer
          return;
        }

        // Check email for firstName, lastName, and emails
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
          console.log(`${email} given name (${update.nModified} update)`);
          // Check if users exist
          await Promise.all(
            emails.map(async (referredEmail) => {
              if (referredEmail === email) {
                console.log('Picked up user email (maybe in signature) so ignored');
              } else {
                const findReferredUser = await User.findOne(
                  { email: referredEmail },
                  'email firstName writerIds',
                );
                if (findReferredUser) {
                  // FIXME: they have not given names so not properly registered.
                  console.log(
                    `${referredEmail} already exists - will send on_receivefriendrequest`,
                  );
                  // Add to writerIds
                  const writerIds = findReferredUser.writerIds;
                  writerIds.push(id.toString());
                  const updatewriterIds = await User.update(
                    { referredEmail },
                    { writerIds },
                    { multi: true },
                  );
                  console.log(updatewriterIds);
                  // Send email saying 'X has added you. If not cool, let us know'
                  sendMail('on_receivefriendrequest', referredEmail, {
                    firstName,
                    lastName,
                    email,
                    other: cmd.rejectFriendRequest,
                  });
                } else {
                  console.log(`${referredEmail} does not exist so will create and send on_invite`);
                  const newUser = new User({
                    email: referredEmail,
                    timeCreated: moment().format(),
                    referredBy: email,
                    writerIds: [id.toString()],
                    currentStoryId: false,
                  }); // Change to moment.js
                  const createNewUser = await newUser.save();
                  console.log(`${createNewUser.email} saved as new user`);
                  sendMail('on_invite', referredEmail, { firstName, lastName, email });
                }
              }
            }),
          );
        }
      } else {
        // Found findOne.firstName so user is properly registered
        console.log(`${email}, registered user, sent an email`);
        // Define first name
        const firstName = findUser.firstName;
        // Define last name
        const lastName = findUser.lastName;
        // Define current story id
        const currentStoryId = findUser.currentStoryId;

        // Check for commands

        // If a friend is being added or removed
        if (text.includes(cmd.deleteReader || cmd.addReader)) {
          const changes = searchAddAndRemove(text);
          console.log(changes);
          changes.addEmails.forEach((item) => {
            if (item === email) {
              console.log('Skip your own email if in there');
            } else {
              // Reply confirming
              // Send email to the recipient confirming
              // do stuff from above?!!!!!! FIXME:
            }
          });
          changes.removeEmails.forEach((item) => {
            if (item === email) {
              console.log('Skip your own email if in there');
            } else {
              // Reply confirming
              // Send email to the recipient confirming
            }
          });
          return;
        }

        // If help is needed
        if (text.includes(cmd.sundayHelp)) {
          // Forward it to my personal inbox
          // Reply saying help is on the way
          return;
        }

        // If cancelling story
        if (text.includes(cmd.cancelStory)) {
          // Find current story using currentStoryId
          // Find out if it's current
          // Delete it
          // Set currentStoryId to false
          // Send confirmation of cancellation
          return;
        }

        // If no command so assume it's a story

        // Extract story text
        const storyText = prettifyStory(text);
        console.log(`Story text: ${storyText.substring(0, 100)}`);
        let storyImgFileName = false;
        let confirmMsg = imgMsgs.noImg;

        // Check for attachments
        if (!_.isUndefined(mail.attachments)) {
          async function imgUpload(outputBuffer) {
            if (!storyImgFileName) {
              const cryptoImgId = crypto.randomBytes(10).toString('hex');
              storyImgFileName = `${id.toString().substring(0, 10)}${cryptoImgId}.png`;
              await uploadAttachment(outputBuffer, `${storyImgFileName}`);
              confirmMsg = imgMsgs.oneImg;
            } else {
              console.log('Already found a suitable image so will not do anything further');
            }
          }
          // Image upload function
          // Loop through images
          await Promise.all(
            mail.attachments.map(async (attachment) => {
              const attachmentType = attachment.contentType;
              // Check if attachment is an image
              if (attachmentType.includes('image')) {
                const imgBuffer = new Buffer.from(attachment.content);
                const fileName = attachment.fileName;
                // Find out size of image
                const dimensions = sizeOf(imgBuffer);
                console.log(`Image: ${fileName}, ${attachmentType}, ${dimensions.width}`);
                // Forget small images, and take first large image
                if (dimensions.width < 660) {
                  console.log('Found small image, will skip');
                } else if (dimensions.width > 1320) {
                  console.log('Found large image, will resize');
                  const processedImage = await sharp(imgBuffer)
                    .resize(1320)
                    .png()
                    .toBuffer();
                  await imgUpload(processedImage);
                } else {
                  const processedImage = await sharp(imgBuffer)
                    .png()
                    .toBuffer();
                  await imgUpload(processedImage);
                }
              }
            }),
          );
        }

        // If image exists, append URL
        if (storyImgFileName) {
          storyImgFileName = `https://s3-eu-west-1.amazonaws.com/sundaystories/${storyImgFileName}`;
        }

        // Check if we should create a new story or just update
        let noStoryYetThisWeek = true;
        console.log(currentStoryId);
        if (currentStoryId) {
          const currentStory = await Story.findOne(
            { _id: currentStoryId },
            'idOfCreator imageUrl _id weekCommencing',
          );
          if (currentStory) {
            // If there is any currentStory at all (might not be)
            console.log('DETAILS START');
            console.log(currentStory);
            console.log(currentStory.weekCommencing);
            console.log(
              moment()
                .startOf('week')
                .hour(12)
                .format(),
            );
            console.log('DETAILS END');
            // Check if it's from this week
            if (
              currentStory.weekCommencing ===
              moment()
                .startOf('week')
                .hour(12)
                .format()
            ) {
              console.log('REACH HERE');
              noStoryYetThisWeek = false;
            }
          }
        }

        if (noStoryYetThisWeek) {
          // Create new story
          const newStory = new Story({
            text: storyText,
            imageUrl: storyImgFileName,
            timeCreated: moment().format(),
            weekCommencing: moment()
              .startOf('week')
              .hour(12)
              .format(),
            idOfCreator: id,
          });
          const createNewStory = await newStory.save();
          console.log(`Created new ${email} story: ${createNewStory.text}`);
          // Set new currentStoryId
          const updateCurrentStoryId = await User.update(
            { email },
            { currentStoryId: createNewStory.id.toString() },
            { multi: false },
          );
          console.log(`${email} currentStoryId change (${updateCurrentStoryId.nModified} update)`);
        } else {
          // Update existing story
          const updateStory = await Story.update(
            { _id: currentStoryId },
            { text: storyText, imageUrl: storyImgFileName, timeCreated: moment().format() },
            { multi: true },
          );
          console.log(`${email} story update (${updateStory.nModified} update)`);
        }

        // Reply with story confirmation
        
        
        // Find readers for confirmation
        const findReaders = await User.find({ $text: { $search: id.toString() } });
        const readersArray = [];
        let readersHumanized = false;
        if (findReaders.length > 0) {
          findReaders.forEach((item) => {
            if (_.isUndefined(item.firstName)) {
              readersArray.push(item.email);
            } else {
              readersArray.push(`${item.firstName} ${item.lastName} (${item.email})`);
            }
          });
          readersHumanized = Humanize.oxford(readersArray);
        }
        console.log(readersHumanized);

        sendMail(
          'on_storyconfirm',
          email,
          {
            firstName,
            readersHumanized,
            confirmMsg,
            stories: [[`${firstName} ${lastName}`, 'Tuesday', storyText, storyImgFileName]],
          },
          mail.messageId,
          mail.subject,
        );
      }
    }
  } catch (e) {
    console.log(e);
  }
}

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
      fs.writeFile(`./emails/tests/${mail.subject}.json`, JSON.stringify(mail), 'binary', (err) => {
        if (err) console.log(err);
        else console.log('Email saved');
      });
    });

    mailListener.on('error', (err) => {
      console.log(err);
    });
  },
};

export default listener;
