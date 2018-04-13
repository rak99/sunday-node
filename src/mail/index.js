import crypto from 'crypto';
import fs from 'fs';
import htmlToText from 'html-to-text';
import Humanize from 'humanize-plus';
import sizeOf from 'image-size';
import _ from 'lodash';
import MailListener from 'mail-listener4';
import moment from 'moment';
import replyParser from 'node-email-reply-parser';
import parseReply from 'parse-reply';
import sharp from 'sharp';
import talon from 'talon';
import { deleteAllStories, deleteStory } from '../db/actions/story';
import { deleteAllUsers } from '../db/actions/user';
import Story from '../db/models/story';
import User from '../db/models/user';
import { deleteFile, uploadAttachment } from '../mail/attachments';
import { cmd } from '../mail/commands';
import { sendMail } from '../mail/send';
import {
  firstNameVariants,
  imgMsgs,
  lastNameVariants,
  searchAddAndRemove,
  searchEmails,
  searchName,
  trimAndFindStoryEnd,
  unwrapPlainText,
} from '../mail/utils';

const parseWithTalon = talon.signature.bruteforce.extractSignature;
const amazonUrl = 'https://s3-eu-west-1.amazonaws.com/sundaystories/';

// Testing utils
const tests = fs.readdirSync('./emails/tests/');
const deleteData = true;
// const chooseTests = ['07'];
const chooseTests = false;
const testDelay = 10000;
runTests();

function runTests() {
  if (deleteData) {
    // TODO: Make sure this setting is correct
    deleteAllUsers(); // FIXME: these are DANGEROUS once Sunday is up and running
    deleteAllStories();
  }
  // Empty array to store tests starting with number
  const testsStartingWithNumber = [];
  // Grab tests starting with number and store
  tests.forEach((test) => {
    if (!isNaN(test[0])) {
      if (chooseTests) {
        if (chooseTests.indexOf(test.substring(0, 2)) > -1) {
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
    console.log(`******** Running test '${testFileName}' ********`);
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

async function processMail(mail) {
  try {
    const email = mail.from[0].address;
    console.log(`${email}: emailed`);

    // Look up user record from email
    const findUser = await User.findOne(
      { email },
      'email firstName lastName _id writerIds currentStoryId referredBy',
    );
    if (!findUser) {
      // If user doesn't exist
      console.log(`${email}: user not found - creating`);

      // Create user
      const newUser = new User({
        email,
        timeCreated: moment().format(),
        referredBy: 'direct',
      });
      const createNewUser = await newUser.save();
      console.log(`${createNewUser.email}: saved as new user`);

      // Send on_signup email asking them for further details
      sendMail('on_signup', email, {}, mail.messageId, mail.subject);
    } else {
      // If user does exist

      // Define the user ID
      const idOfEmailer = findUser._id;

      // Parse the reply
      const reply = parseReply(mail.text);
      const text = parseWithTalon(reply).text; // Should use talon instead

      // Print the email text
      // console.log(`Email from ${email}: \n${text.substring(0, 100)}`);

      // Define first and last names false initially
      let firstName = false;
      let lastName = false;

      // Find out if first name exists
      if (_.isUndefined(findUser.firstName)) {
        console.log(`${email}: is not fully registered (did not find first name)`);
      } else {
        console.log(`${email}: is fully registered (found first name)`);
        firstName = findUser.firstName;
        lastName = findUser.lastName;
      }

      // If there is no firstName, ask for more info
      if (!firstName) {
        // If help is needed
        if (text.includes(cmd.sundayHelp)) {
          // Forward it to my personal inbox
          sendMail('on_help', 'louis.barclay@gmail.com', {
            firstName: 'Unknown',
            lastName: 'Unknown',
            email,
            text,
          });
          // Reply saying help is on the way
          sendMail('on_helpconfirm', email, {}, mail.messageId, mail.subject);
          return;
        }

        // Search for a writer remove request before asking for more info
        if (text.includes(cmd.removeWriter)) {
          console.log(`${email}: found removeWriter command`);
          const changes = searchAddAndRemove(text);
          // If no other changes, process now, else process later all in one batch
          // Only do operation if there are emails to remove
          if (changes.removeWriterEmails.length > 0) {
            const removeWritersSuccess = await removeWriters(
              changes.removeWriterEmails,
              firstName,
              lastName,
              email,
              findUser.writerIds,
              idOfEmailer,
            );
            // If there were writers to remove
            if (removeWritersSuccess.length > 0) {
              // Send confirmation
              const removeWritersHumanized = Humanize.oxford(removeWritersSuccess);
              sendMail(
                'on_removewriter',
                email,
                { firstName, lastName, removeWritersHumanized },
                mail.messageId,
                mail.subject,
              );
              console.log(`${email}: removeWriter - done for ${removeWritersHumanized}`);
            } else {
              // Should be optimised - duplicate with below
              console.log(`${email}: removeWriter but no valid emails!`);
              sendMail('on_removewriterfail', email, {}, mail.messageId, mail.subject);
            }
          } else {
            console.log(`${email}: removeWriter but no emails!`);
            sendMail('on_removewriterfail', email, {}, mail.messageId, mail.subject);
          }
          return;
        }

        // Search for a rejected friend request before asking for more info
        if (text.includes(cmd.rejectInvite)) {
          // Assuming there is a referral email (always should be, send 'on_rejectinvite')
          if (findUser.referredBy !== 'direct') {
            console.log(
              `${email}: rejecting invite and deleting account (referred by ${
                findUser.referredBy
              })`,
            );
            sendMail('on_rejectinvite', findUser.referredBy, { email });
          }
          User.remove({ email }, (err) => {
            if (err) {
              return console.log(err);
            }
          });
          sendMail('on_deleteaccount', email, {}, mail.messageId, mail.subject);
          return;
        }

        // Check email for firstName, lastName, and emails before asking for more info
        firstName = searchName(text, firstNameVariants);
        lastName = searchName(text, lastNameVariants);
        const addReaderEmailsFromSignUp = searchEmails(text);

        // Ask for more info
        if (!firstName || !lastName || !addReaderEmailsFromSignUp) {
          // Sorry, we need info to proceed
          sendMail('on_noinfo', email, {}, mail.messageId, mail.subject);

          // We got the info, so update it and send confirmation
        } else {
          // We got the info, so we update it
          const updateNames = await User.update(
            { email },
            { firstName, lastName },
            { multi: true },
          );
          console.log(
            `${email}: name is ${firstName} ${lastName}, update account (${
              updateNames.nModified
            } update)`,
          );

          // Add readers
          const addReaderEmailsSuccess = await addReaders(
            addReaderEmailsFromSignUp,
            email,
            firstName,
            lastName,
            idOfEmailer,
          );

          // Get success array back and use for confirmation
          const addReaderEmailsHumanized = Humanize.oxford(addReaderEmailsSuccess);
          sendMail(
            'on_confirmsignup',
            email,
            {
              firstName,
              addReaderEmailsHumanized,
              email,
            },
            mail.messageId,
            mail.subject,
          );
        }
      } else {
        // Found findOne.firstName so user is properly registered

        // Define current story id
        const currentStoryId = findUser.currentStoryId;

        // Check for commands

        // If help is needed
        if (text.includes(cmd.sundayHelp)) {
          // Forward it to my personal inbox
          sendMail('on_help', 'louis.barclay@gmail.com', { firstName, lastName, text });
          // Reply saying help is on the way
          sendMail('on_helpconfirm', email, {}, mail.messageId, mail.subject);
          return;
        }

        // If a friend is being added or removed
        if (
          text.includes(cmd.removeReader) ||
          text.includes(cmd.addReader) ||
          text.includes(cmd.removeWriter)
        ) {
          console.log(`${email}: found remove reader, add reader, or remove writer`);
          const changes = searchAddAndRemove(text);
          // Remove duplicates (user is trying to add and remove same email)
          const addAndRemove = (array1, array2) => array2.some(item => array1.indexOf(item) >= 0);
          const duplicates = addAndRemove(changes.addReaderEmails, changes.removeReaderEmails);
          if (duplicates) {
            duplicates.forEach((item) => {
              console.log(`${email}: found duplicate in add and remove - ${item}`);
              const removeDuplicates = (array) => {
                const index = array.indexOf(item);
                if (index > -1) {
                  array.splice(index, 1);
                }
              };
              removeDuplicates(changes.addReaderEmails);
              removeDuplicates(changes.removeReaderEmails);
            });
          }

          // Add readers
          const addReadersSuccess = await addReaders(
            changes.addReaderEmails,
            email,
            firstName,
            lastName,
            idOfEmailer,
          );

          // Remove readers
          const removeReadersSuccess = [];
          await Promise.all(
            changes.removeReaderEmails.map(async (removeReaderEmail) => {
              if (removeReaderEmail === email) {
                console.log(`${email}: removeReader - skip own email`);
              } else {
                const findRemoveReader = await User.findOne(
                  { email: removeReaderEmail },
                  'email firstName lastName writerIds',
                );
                if (findRemoveReader) {
                  // Remove from writerIds
                  const writerIds = findRemoveReader.writerIds;
                  const index = writerIds.indexOf(idOfEmailer.toString());
                  if (index > -1) {
                    writerIds.splice(index, 1);
                    if (_.isUndefined(findRemoveReader.firstName)) {
                      removeReadersSuccess.push(removeReaderEmail);
                    } else {
                      removeReadersSuccess.push(`${firstName} ${lastName} (${removeReaderEmail})`);
                    }
                  }
                  const updateWriterIds = await User.update(
                    { email: removeReaderEmail },
                    { writerIds },
                    { multi: true },
                  );
                  console.log(
                    `${email}: removeReader - done (${updateWriterIds.nModified} update)`,
                  );
                  // Send email saying 'X has added you. If not cool, let us know'
                  sendMail('on_removedasreader', removeReaderEmail, {
                    firstName,
                    lastName,
                    email,
                  });
                }
              }
            }),
          );

          // Remove writers
          const removeWritersSuccess = await removeWriters(
            changes.removeWriterEmails,
            firstName,
            lastName,
            email,
            findUser.writerIds,
            idOfEmailer,
          );

          // Confirm whatever you just did

          let removeWritersHumanized = false;
          let removeReadersHumanized = false;
          let addReadersHumanized = false;

          if (addReadersSuccess.length > 0) {
            addReadersHumanized = Humanize.oxford(addReadersSuccess);
          }
          if (removeReadersSuccess.length > 0) {
            removeReadersHumanized = Humanize.oxford(removeReadersSuccess);
          }
          if (removeWritersSuccess.length > 0) {
            removeWritersHumanized = Humanize.oxford(removeWritersSuccess);
          }

          // Send confirmation of changes, if there have been any changes
          if (removeWritersHumanized || removeReadersHumanized || removeWritersHumanized) {
            sendMail(
              'on_confirmaccountchanges',
              email,
              {
                firstName,
                addReadersHumanized,
                removeReadersHumanized,
                removeWritersHumanized,
              },
              mail.messageId,
              mail.subject,
            );
          }

          // Return, don't keep going
          return;
        }

        // If cancelling story
        if (text.includes(cmd.cancelStory)) {
          if (currentStoryId) {
            const currentStory = await Story.findOne({ _id: currentStoryId }, 'weekCommencing');
            if (currentStory) {
              // If there is any currentStory at all (might not be)
              // Check if it's from this week
              if (
                currentStory.weekCommencing ===
                moment()
                  .startOf('week')
                  .hour(12)
                  .format()
              ) {
                deleteStory(currentStoryId);
              }
            }
          }
          // Set currentStoryId to false
          const updateCurrentStoryId = await User.update(
            { email },
            { currentStoryId: '' },
            { multi: false },
          );
          console.log(`${email} currentStoryId remove (${updateCurrentStoryId.nModified} update)`);
          // Send confirmation of cancellation
          sendMail('on_cancelstory', email, {}, mail.messageId, mail.subject);
          return;
        }

        // If no command assume it's a story

        // Extract story text
        let storyText = '';
        // Original method
        if (_.isUndefined(mail.html)) {
          // Take only the reply from the email chain
          storyText = replyParser(mail.text, true);
          // Trim and find story end
          storyText = trimAndFindStoryEnd(storyText);
          // Unwrap
          storyText = unwrapPlainText(storyText);
        } else {
          // Take only the reply from the email chain
          storyText = replyParser(mail.html, true);
          // Convert HTML into text
          storyText = htmlToText.fromString(storyText, {
            wordwrap: false,
            preserveNewlines: true,
            ignoreImage: true,
          });
          // Trim and find story end
          storyText = trimAndFindStoryEnd(storyText);
        }

        // console.log(`Story text: ${storyText.substring(0, 100)}`);
        let storyImgFileName = false;
        let confirmMsg = imgMsgs.noImg;

        // Check for attachments
        if (!_.isUndefined(mail.attachments)) {
          async function imgUpload(outputBuffer) {
            if (!storyImgFileName) {
              const cryptoImgId = crypto.randomBytes(10).toString('hex');
              storyImgFileName = `${cryptoImgId}${idOfEmailer.toString()}.png`;
              await uploadAttachment(outputBuffer, `${storyImgFileName}`);
              confirmMsg = imgMsgs.oneImg;
            } else {
              console.log(`${email}: have image already so will not do anything else`);
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
                // Forget small images, and take first large image
                if (dimensions.width < 660) {
                  console.log(
                    `${email}: found small image ${fileName}, will skip (width: ${
                      dimensions.width
                    })`,
                  );
                } else if (dimensions.width > 1320) {
                  console.log(
                    `${email}: found large image ${fileName}, will resize (width: ${
                      dimensions.width
                    })`,
                  );
                  const processedImage = await sharp(imgBuffer)
                    .resize(1320)
                    .png()
                    .toBuffer();
                  await imgUpload(processedImage);
                } else {
                  console.log(
                    `${email}: found OK image ${fileName}, will use (width: ${dimensions.width})`,
                  );
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
          storyImgFileName = `${amazonUrl}${storyImgFileName}`;
        }

        // Check if we should create a new story or just update
        let noStoryYetThisWeek = true;
        let existingImgUrl = false;
        if (currentStoryId && currentStoryId !== '') {
          const currentStory = await Story.findOne(
            { _id: currentStoryId },
            'idOfCreator imageUrl _id weekCommencing',
          );
          if (currentStory) {
            // If there is any currentStory at all (might not be)
            // Check if it's from this week
            if (
              currentStory.weekCommencing ===
              moment()
                .startOf('week')
                .hour(12)
                .format()
            ) {
              noStoryYetThisWeek = false;
              // Grab existing image URL to delete it later
              existingImgUrl = currentStory.imageUrl;
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
            idOfCreator: idOfEmailer,
          });
          const createNewStory = await newStory.save();
          console.log(`${email}: created new  story - ${createNewStory.text.substring(0, 50)}`);
          // Set new currentStoryId
          const updateCurrentStoryId = await User.update(
            { email },
            { currentStoryId: createNewStory.id.toString() },
            { multi: false },
          );
          console.log(`${email}: currentStoryId update (${updateCurrentStoryId.nModified} update)`);
        } else {
          // Update existing story
          const updateStory = await Story.update(
            { _id: currentStoryId },
            { text: storyText, imageUrl: storyImgFileName, timeCreated: moment().format() },
            { multi: true },
          );
          // Delete existing photo
          const key = existingImgUrl.replace(amazonUrl, '');
          deleteFile(key);
          // Log update
          console.log(`${email}: story update (${updateStory.nModified} update)`);
        }

        // Reply with story confirmation

        // Find readers for confirmation
        const findReaders = await User.find({ $text: { $search: idOfEmailer.toString() } });
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
        console.log(`${email}: confirm readers - ${readersHumanized}`);

        // Turn story text into array for inserting into template
        const storyTextArray = storyText.split('\n');

        // Send confirmation TODO: use this for Sunday too
        sendMail(
          'on_storyconfirm',
          email,
          {
            firstName,
            lastName,
            readersHumanized,
            confirmMsg,
            stories: [
              [
                `${firstName} ${lastName}`,
                moment().format('dddd'),
                storyTextArray,
                storyImgFileName,
              ],
            ],
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

async function removeWriters(
  removeWriterEmails,
  firstName,
  lastName,
  email,
  writerIds,
  idOfEmailer,
) {
  // Remove writers
  // Must find Ids from emails first
  const removeWriterIds = [];
  const successArray = [];
  await Promise.all(
    removeWriterEmails.map(async (removeWriterEmail) => {
      if (removeWriterEmail === email) {
        console.log(`${email}: removeWriter - skip own email`);
      } else {
        const findRemoveWriter = await User.findOne(
          { email: removeWriterEmail },
          'email firstName lastName writerIds',
        );
        if (findRemoveWriter) {
          // Add to array of ids to remove
          removeWriterIds.push(findRemoveWriter.id.toString());
          successArray.push(
            `${findRemoveWriter.firstName} ${findRemoveWriter.lastName} (${removeWriterEmail})`,
          );
          // Send email saying 'X has added you. If not cool, let us know'
          sendMail('on_removedaswriter', removeWriterEmail, {
            firstName,
            lastName,
            email,
          });
          console.log(
            `${email}: removeWriter ${findRemoveWriter.firstName} ${
              findRemoveWriter.lastName
            } and notify`,
          );
        }
      }
    }),
  );

  // Now that you have the remove writer Ids, remove them
  removeWriterIds.forEach((removeWriterId) => {
    if (removeWriterId === idOfEmailer) {
      console.log(`${email}: removeWriter - skip own id`);
    } else {
      const index = writerIds.indexOf(removeWriterId);
      if (index > -1) {
        console.log(`${email}: removeWriter - ${removeWriterId} found`);
        writerIds.splice(index, 1);
      } else {
        console.log(`${email}: removeWriter - id not found`);
      }
    }
  });
  // Update user with removed writerIds
  const updateWriterIds = await User.update({ email }, { writerIds }, { multi: true });
  console.log(`${email}: removeWriter - completed (${updateWriterIds.nModified} update)`);

  return successArray;
}

async function addReaders(addReaderEmails, email, firstName, lastName, id) {
  const successArray = [];
  await Promise.all(
    addReaderEmails.map(async (addReaderEmail) => {
      if (addReaderEmail === email) {
        console.log(`${email}: addReader - skip own email`);
      } else {
        const findReferredUser = await User.findOne(
          { email: addReaderEmail },
          'email firstName lastName writerIds',
        );
        if (findReferredUser) {
          console.log(
            `${email}: addReader - ${addReaderEmail} already exists - will send on_receivefriendrequest`,
          );
          // Add to writerIds
          const writerIds = findReferredUser.writerIds;
          if (writerIds.indexOf(id.toString()) > -1) {
            // Do nothing
            console.log(`${email}: addReader - ${addReaderEmail} already a reader`);
          } else {
            writerIds.push(id.toString());
            const updateWriterIds = await User.update(
              { email: addReaderEmail },
              { writerIds },
              { multi: true },
            );
            console.log(
              `${email}: addReader - ${addReaderEmail} (${updateWriterIds.nModified} update)`,
            );
            // Send email saying 'X has added you. If not cool, let us know'
            let referredUserFirstName = false;
            if (!_.isUndefined(findReferredUser.firstName)) {
              referredUserFirstName = findReferredUser.firstName;
            }
            sendMail('on_receivefriendrequest', addReaderEmail, {
              referredUserFirstName,
              firstName,
              lastName,
              email,
            });
          }
          if (_.isUndefined(findReferredUser.firstName)) {
            successArray.push(addReaderEmail);
          } else {
            successArray.push(
              `${findReferredUser.firstName} ${findReferredUser.lastName} (${addReaderEmail})`,
            );
          }
        } else {
          const newUser = new User({
            email: addReaderEmail,
            timeCreated: moment().format(),
            referredBy: email,
            writerIds: [id.toString()],
          }); // Change to moment.js
          const createNewUser = await newUser.save();
          sendMail('on_invite', addReaderEmail, { firstName, lastName, email });
          console.log(
            `${email}: addReader - ${addReaderEmail} does not exist - create and send on_invite`,
          );
          console.log(`${email}: addReader - your friend ${createNewUser.email} saved as new user`);
          successArray.push(createNewUser.email);
        }
      }
    }),
  );
  return successArray;
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
        else console.log('>>>>>>>> Email saved >>>>>>>>');
      });
    });

    mailListener.on('error', (err) => {
      console.log(err);
    });
  },
};

export default listener;
