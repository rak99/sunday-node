import crypto from 'crypto';
import fs from 'fs';
import htmlToText from 'html-to-text';
import Humanize from 'humanize-plus';
import sizeOf from 'image-size';
import _ from 'lodash';
import MailListener from 'mail-listener4';
import moment from 'moment';
import replyParser from 'node-email-reply-parser';
import sharp from 'sharp';
import talon from 'talon';
import schedule from 'node-schedule';
import log from '../log';
import config from '../config.json';
import { deleteAllStories, deleteStory } from '../db/actions/story';
import { deleteAllUsers } from '../db/actions/user';
import Story from '../db/models/story';
import User from '../db/models/user';
import { deleteFile, uploadAttachment } from '../mail/attachments';
import { cmd } from '../mail/commands';
import { boundaries } from '../mail/boundaries';
import { dummyname } from '../mail/dummies';
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
  shuffleArray,
} from '../mail/utils';
import { standardise } from '../mail/standardise';

const parseWithTalon = talon.signature.bruteforce.extractSignature;

// Testing
const tests = fs.readdirSync('./emails/tests/');
const testDelay = 10000;

if (config.testmode) {
  if (config.testinbound) {
    runTests();
  }
  if (config.testoutbound && !config.testinbound) {
    sundaySend();
    // reminderSend();
  }
}

const sundayHourOfDay = 19;

const sundaySchedule = schedule.scheduleJob(`0 ${sundayHourOfDay} * * 0`, () => {
  log.info('Sunday send started');
  sundaySend();
});

const reminderSchedule = schedule.scheduleJob(`0 ${sundayHourOfDay} * * 6`, () => {
  log.info('Reminder send started');
  reminderSend();
});

async function reminderSend() {
  console.log('Started reminderSend');
  try {
    const findAll = await User.find({});
    await Promise.all(
      findAll.map(async (user) => {
        // See if user is properly signed up
        if (!_.isUndefined(user.firstName)) {
          // User is signed up
          // If sendReminder is undefined or if it's true
          if (_.isUndefined(user.sendReminder) || user.sendReminder) {
            let canSendReminder = true;

            // If sendReminder is not defined, update it
            if (_.isUndefined(user.sendReminder)) {
              const updateSendReminder = await User.update(
                { email: user.email },
                { sendReminder: true },
                { multi: true },
              );
              log.info(
                `${user.email}: updated sendReminder (${updateSendReminder.nModified} update)`,
              );
            }

            // Check current story is not from this week
            if (!_.isUndefined(user.currentStoryId) && user.currentStoryId !== '') {
              // Check if there is a current story
              const currentStory = await Story.findOne(
                { _id: user.currentStoryId },
                'text imageUrl weekCommencing timeCreated',
              );
              if (currentStory) {
                // Check if it's from this week
                if (
                  currentStory.weekCommencing ===
                  moment()
                    .startOf('week')
                    .hour(12) // FIXME: should this be consistent throughout?
                    .format()
                ) {
                  canSendReminder = false;
                }
              }
            }
            // If passed the tests to send reminder, do it
            if (canSendReminder) {
              const readers = await getReaders(user.email, user.id);
              sendMail('on_reminder', user.email, {
                firstName: user.firstName,
                readers,
              });
            } else {
              log.info(`${user.email} already wrote story this week`);
            }
          } else {
            log.info(`${user.email} doesn't want a reminder`);
          }
        }
      }),
    );
  } catch (e) {
    log.info(e);
  }
}

async function findEmail(email, params) {
  const allUsers = await User.find({}, 'email _id');
  let foundId = false;
  allUsers.forEach((item) => {
    if (!foundId && standardise(item.email) === standardise(email)) {
      // console.log(`FOUND ${item.email}`);
      foundId = item._id;
    }
  });
  if (foundId) {
    return User.findById(foundId, params);
  }
  return foundId;
}

async function sundaySend() {
  try {
    log.info(`>>>>>>>> Start Sunday send at ${moment().format('h:mm:ss a, dddd MMMM Do YYYY')}`);
    // Bring up all users, who have any writerIds
    const findAll = await User.find({});
    // Define allStories object which we will add to in order to cache and save resources
    const allStories = {};
    // Go through all users
    await Promise.all(
      findAll.map(async (user) => {
        // See if lastSentSunday is today, i.e. has already sent
        if (
          !_.isUndefined(user.lastSentSunday) &&
          user.lastSentSunday ===
            moment()
              .startOf('day')
              .hour(12)
              .format()
        ) {
          log.info(`${user.email}: already sent Sunday this week`);
        } else {
          const userStories = [];
          // If they have any writers
          if (user.writerIds.length > 0) {
            // Look at all of their writers in turn
            await Promise.all(
              user.writerIds.map(async (writerId) => {
                if (!_.isUndefined(allStories[writerId])) {
                  // If we already got that writer and story, don't request again
                  // But do add to userStories array if there is a story for that writer
                  if (allStories[writerId]) {
                    userStories.push(allStories[writerId]);
                  }
                } else {
                  // Find writer
                  const writer = await User.findOne(
                    { _id: writerId },
                    'firstName lastName currentStoryId',
                  );
                  let story = false;
                  // Find out if they have a current story
                  if (writer.currentStoryId !== '') {
                    const currentStory = await Story.findOne(
                      { _id: writer.currentStoryId },
                      'text imageUrl weekCommencing timeCreated',
                    );
                    // If they have a current story
                    if (currentStory) {
                      // Check if it's from this week
                      if (
                        currentStory.weekCommencing ===
                        moment()
                          // Go to yesterday and find start of week
                          .subtract(1, 'days')
                          .startOf('week')
                          .hour(12)
                          .format()
                      ) {
                        // There is a story this week so we define it
                        story = {
                          firstName: writer.firstName,
                          name: `${writer.firstName} ${writer.lastName}`,
                          day: moment(currentStory.timeCreated).format('dddd'),
                          text: currentStory.text.split(/[\n\r]/),
                          imageUrl: currentStory.imageUrl,
                        };
                      } else {
                        log.info(
                          `No story this week (current story is ${
                            currentStory.weekCommencing
                          }, and now is ${moment()
                            .subtract(1, 'days')
                            .startOf('week')
                            .hour(12)
                            .format()})`,
                        );
                      }
                    }
                  }
                  // Add story (or false) to writerId
                  allStories[writerId] = story;
                  // If there is a story, add story to array of stories for this user
                  if (story) {
                    userStories.push(allStories[writerId]);
                  }
                }
              }),
            );
            if (userStories.length > 0) {
              let firstName = false;
              if (_.isUndefined(user.firstName)) {
                log.info(`\n>>>>>>>> Recipient is ${user.email} (${user._id})`);
              } else {
                firstName = user.firstName;
                log.info(
                  `\n>>>>>>>> Recipient is ${user.firstName} ${user.lastName} (${user.email}, ${
                    user._id
                  })`,
                );
              }
              const storyNames = [];
              userStories.forEach((story, i) => {
                storyNames.push(story.firstName);
                // log.info(`${i + 1}: ${story.name}'s story`);
                // log.info(`Day: ${story.day}`);
                // log.info(`Text: ${story.text[0].substring(0, 30)}`);
                // log.info(`Image URL: ${story.imageUrl}`);
              });
              // Randomise order of storyNames
              shuffleArray(storyNames);
              let sundayStoriesSubjectLine = `A story from ${storyNames[0]} (${moment().format(
                'dddd Do MMMM',
              )})`;
              if (storyNames.length > 1) {
                sundayStoriesSubjectLine = `Stories from ${Humanize.oxford(
                  storyNames,
                )} (${moment().format('dddd Do MMMM')})`;
              }
              sendMail('on_sunday', user.email, {
                stories: userStories,
                firstName,
                sundayStoriesSubjectLine,
              });
              // Update user with lastSentSunday
              const updateLastSentSunday = await User.update(
                { email: user.email },
                {
                  lastSentSunday: moment()
                    .startOf('day')
                    .hour(12)
                    .format(),
                },
                { multi: true },
              );
              log.info(
                `${user.email}: successfully sent Sunday (${
                  updateLastSentSunday.nModified
                } update)`,
              );
            }
          }
        }
      }),
    );
    log.info(`>>>>>>>> Finish Sunday send at ${moment().format('h:mm:ss a, dddd MMMM Do YYYY')}`);
  } catch (e) {
    log.info(e);
  }
}

function runTests() {
  if (config.deleteData) {
    deleteAllUsers();
    deleteAllStories();
  }
  // Empty array to store tests starting with number
  const testsStartingWithNumber = [];
  // Grab tests starting with number and store
  tests.forEach((test) => {
    if (!isNaN(test[0])) {
      if (config.chooseTests) {
        if (config.chooseTests.indexOf(test.substring(0, 2)) > -1) {
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
    log.info(`******** Running test '${testFileName}' ********`);
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
  username: config.username,
  password: config.password,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  connTimeout: 10000, // Default by node-imap
  authTimeout: 5000, // Default by node-imap,
  debug: null, // Or your custom function with only one incoming argument. Default: null
  tlsOptions: { rejectUnauthorized: false },
  mailbox: 'INBOX', // mailbox to monitor
  searchFilter: ['UNSEEN'], // the search filter being used after an IDLE notification has been retrieved
  markSeen: true, // all fetched email will be marked as seen and not fetched next time
  fetchUnreadOnStart: true, // use it only if you want to get all unread email on lib start
  mailParserOptions: { streamAttachments: false }, // options to be passed to mailParser lib.
  attachments: true, // download attachments as they are encountered to the project directory
  attachmentOptions: { directory: 'attachments/' }, // specify a download directory for attachments
});

async function processMail(mail) {
  try {
    const to = mail.to[0].address;
    let email = mail.from[0].address;
    email = email.toLowerCase();

    log.info(`${email}: emailed`);

    if (config.testmode) {
      if (to !== 'louis@sundaystori.es') {
        return;
      }
    } else if (to !== 'write@sundaystori.es') {
      return;
    }
    // Emails to ignore
    if (email.includes('postmarkapp.com')) {
      log.info(`${email}: emailed - ignored`);
      return;
    }

    // Look up user record from email
    const findUser = await findEmail(
      email,
      'email firstName lastName _id writerIds currentStoryId referredBy',
    );
    if (!findUser) {
      // If user doesn't exist
      log.info(`${email}: user not found - creating`);

      // Create user
      const newUser = new User({
        email,
        timeCreated: moment().format(),
        referredBy: 'direct',
      });
      const createNewUser = await newUser.save();
      log.info(`${createNewUser.email}: saved as new user`);

      // Send on_signup email asking them for further details
      sendMail('on_signup', email, {}, mail.messageId, mail.subject);
    } else {
      // If user does exist
      // Overwrite email with what's already on record
      email = findUser.email;

      // Define the user ID
      const idOfEmailer = findUser._id;

      const text = advancedReplyParser(mail.text);

      // Define first and last names false initially
      let firstName = false;
      let lastName = false;

      // Find out if first name exists
      if (_.isUndefined(findUser.firstName)) {
        log.info(`${email}: is not fully registered (did not find first name)`);
      } else {
        log.info(`${email}: is fully registered (found first name)`);
        firstName = findUser.firstName;
        lastName = findUser.lastName;
      }

      // If there is no firstName, ask for more info
      if (!firstName) {
        // If help is needed
        if (text.includes(cmd.sundayHelp) || mail.subject.includes(cmd.sundayHelp)) {
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
          log.info(`${email}: found removeWriter command`);
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
              log.info(`${email}: removeWriter - done for ${removeWritersHumanized}`);
            } else {
              // Should be optimised - duplicate with below
              log.info(`${email}: removeWriter but no valid emails!`);
              sendMail('on_removewriterfail', email, {}, mail.messageId, mail.subject);
            }
          } else {
            log.info(`${email}: removeWriter but no emails!`);
            sendMail('on_removewriterfail', email, {}, mail.messageId, mail.subject);
          }
          return;
        }

        // Search for a rejected friend request before asking for more info
        if (text.includes(cmd.rejectInvite)) {
          // Assuming there is a referral email (always should be, send 'on_rejectinvite')
          if (findUser.referredBy !== 'direct') {
            log.info(
              `${email}: rejecting invite and deleting account (referred by ${
                findUser.referredBy
              })`,
            );
            sendMail('on_rejectinvite', findUser.referredBy, { email });
          }
          User.remove({ email }, (err) => {
            if (err) {
              return log.info(err);
            }
          });
          sendMail('on_deleteaccount', email, {}, mail.messageId, mail.subject);
          return;
        }

        // Check email for firstName, lastName, and emails before asking for more info
        // Only search the boundary checked version!
        firstName = searchName(advancedReplyParser(mail.text, true), firstNameVariants);
        lastName = searchName(advancedReplyParser(mail.text, true), lastNameVariants);
        const addReaderEmailsFromSignUp = searchEmails(advancedReplyParser(mail.text, true));

        // To help debug error of double-adding names
        // log.info(firstName);
        // log.info(lastName);
        // log.info(addReaderEmailsFromSignUp);

        // Ask for more info
        if (
          !firstName ||
          !lastName ||
          !addReaderEmailsFromSignUp ||
          firstName === dummyname.firstName ||
          lastName === dummyname.lastName
        ) {
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
          log.info(
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
          sendMail('on_help', 'louis.barclay@gmail.com', { firstName, lastName, text, email });
          // Reply saying help is on the way
          sendMail('on_helpconfirm', email, {}, mail.messageId, mail.subject);
          return;
        }

        // Changing sendReminder
        if (text.includes(cmd.stopReminders)) {
          const updateSendReminder = await User.update(
            { email },
            { sendReminder: true },
            { multi: true },
          );
          log.info(
            `${email}: updated sendReminder (${updateSendReminder.nModified} update)`,
          );
          return;
        }

        // If a friend is being added or removed
        if (
          text.includes(cmd.removeReader) ||
          text.includes(cmd.addReader) ||
          text.includes(cmd.removeWriter)
        ) {
          log.info(`${email}: found remove reader, add reader, or remove writer`);
          const changes = searchAddAndRemove(text);
          // Remove duplicates (user is trying to add and remove same email)
          const addAndRemove = (array1, array2) => array2.some(item => array1.indexOf(item) >= 0);
          const duplicates = addAndRemove(changes.addReaderEmails, changes.removeReaderEmails);
          if (duplicates) {
            duplicates.forEach((item) => {
              log.info(`${email}: found duplicate in add and remove - ${item}`);
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
              if (standardise(removeReaderEmail) === standardise(email)) {
                log.info(`${email}: removeReader - skip own email`);
              } else {
                const findRemoveReader = await findEmail(
                  removeReaderEmail,
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
                  } else {
                    log.info(`${email}: removeReader - reader never had user in writerIds`);
                  }
                  const updateWriterIds = await User.update(
                    { email: removeReaderEmail },
                    { writerIds },
                    { multi: true },
                  );
                  log.info(`${email}: removeReader - done (${updateWriterIds.nModified} update)`);
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
          if (addReadersHumanized || removeReadersHumanized || removeWritersHumanized) {
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
          if (currentStoryId !== '' && currentStoryId) {
            const currentStory = await Story.findOne({ _id: currentStoryId }, 'weekCommencing');
            if (currentStory) {
              // If there is any currentStory at all (might not be)
              // Check if it's from this week
              if (
                currentStory.weekCommencing ===
                moment()
                  .subtract(sundayHourOfDay, 'hours')
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
          log.info(`${email} currentStoryId remove (${updateCurrentStoryId.nModified} update)`);
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
          storyText = advancedReplyParser(mail.text);
          // Trim and find story end
          storyText = trimAndFindStoryEnd(storyText);
          // Unwrap
          storyText = unwrapPlainText(storyText);
        } else {
          // First search for STORYEND
          if (advancedReplyParser(mail.text).indexOf(cmd.storyEnd) > -1) {
            // Grab story text up until STORYEND
            storyText = mail.text.substr(0, mail.text.indexOf(cmd.storyEnd));
            // Trim
            storyText = storyText.trim();
          } else {
            // If STORYEND not found
            // Take reply only
            let matchString = advancedReplyParser(mail.text);
            // Strip out signature
            matchString = parseWithTalon(matchString).text;
            // console.log(`Match string:\n${matchString}`);
            // Take last 100 characters of reply
            matchString = matchString.substr(matchString.length - 100);
            // Take out all whitespaces and split into array, one item per character
            const matchArray = matchString.replace(/\s/g, '').split('');
            // For every item in array, escape the character
            const escMatchArray = matchArray.map(x =>
              x.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'),
            );
            // Join the array, put whitespace before, join with whitespace
            matchString = `\\s*${escMatchArray.join('\\s*')}`;
            // Make into regex
            const matchRegex = new RegExp(matchString, 'g');
            // Convert the HTML email to text, to get it ready to match regex
            // (Or if no match, that's what we'll take!)
            // https://github.com/domchristie/turndown
            // https://github.com/EDMdesigner/textversionjs
            // https://github.com/showdownjs/showdown
            storyText = htmlToText.fromString(mail.html, {
              wordwrap: false,
              preserveNewlines: true,
              ignoreImage: true,
              hideLinkHrefIfSameAsText: true,
            });
            // console.log(storyText);
            // Find the regex in text
            const matches = storyText.match(matchRegex);
            if (matches) {
              // Take the last match and find its lastIndexOf in the text, plus its length
              const endPoint =
                storyText.lastIndexOf(matches.slice(-1)[0]) + matches.slice(-1)[0].length;
              storyText = storyText.substr(0, endPoint);
              // log.info(`Story: ${storyText}`);
              // log.info('Matched up so successfully extracted text from reply');
            } else {
              log.info("Couldn't match up so putting in full email - could send warning in future");
              // log.info(storyText);
              // log.info(matchString);
            }
            storyText = storyText.trim();
          }
        }

        // log.info(`Story text: ${storyText.substring(0, 100)}`);

        let storyImgFileName = 'none';
        let confirmMsg = imgMsgs.noImg;

        // Check for attachments
        if (!_.isUndefined(mail.attachments)) {
          // Create image upload function
          async function imgUpload(outputBuffer) {
            // Check if storyImgFileName is still 'none'
            // If not, you already uploaded an image from that email, so skip
            if (storyImgFileName === 'none') {
              // Create a crypto ID
              const cryptoImgId = crypto.randomBytes(10).toString('hex');
              // Set the storyImgFileName correctly
              storyImgFileName = `${cryptoImgId}${idOfEmailer.toString()}.png`;
              // Upload the image
              await uploadAttachment(outputBuffer, `${storyImgFileName}`);
              confirmMsg = imgMsgs.oneImg;
            } else {
              log.info(`${email}: have image already so will not do anything else`);
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
                  log.info(
                    `${email}: found small image ${fileName}, will skip (width: ${
                      dimensions.width
                    })`,
                  );
                } else if (dimensions.width > 1320) {
                  log.info(
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
                  log.info(
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
        if (storyImgFileName !== 'none') {
          storyImgFileName = `${config.s3}${storyImgFileName}`;
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
                .subtract(sundayHourOfDay, 'hours')
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
              // The deadline is sundayHourOfDay on Sunday
              .subtract(sundayHourOfDay, 'hours')
              .startOf('week')
              .hour(12)
              .format(),
            idOfCreator: idOfEmailer,
          });
          const createNewStory = await newStory.save();
          log.info(
            `${email}: created new story - ${
              createNewStory.imageUrl
            } ${createNewStory.text.substring(0, 50)}`,
          );
          // Set new currentStoryId
          const updateCurrentStoryId = await User.update(
            { email },
            { currentStoryId: createNewStory.id.toString() },
            { multi: false },
          );
          log.info(`${email}: currentStoryId update (${updateCurrentStoryId.nModified} update)`);
        } else {
          // Update existing story
          const updateStory = await Story.update(
            { _id: currentStoryId },
            { text: storyText, imageUrl: storyImgFileName, timeCreated: moment().format() },
            { multi: true },
          );
          // Delete existing photo
          if (existingImgUrl !== 'none') {
            const key = existingImgUrl.replace(config.s3, '');
            deleteFile(key);
          }
          // Log update
          log.info(`${email}: story update (${updateStory.nModified} update)`);
        }

        // Reply with story confirmation

        // Find readers for confirmation
        const readers = await getReaders(email, idOfEmailer);
        log.info('readers1:', readers);

        // Turn story text into array for inserting into template
        const storyTextArray = storyText.split(/[\n\r]/);
        // console.log(storyTextArray); // FIXME: this is the stuff to check

        // Send confirmation
        sendMail(
          'on_storyconfirm',
          email,
          {
            firstName,
            lastName,
            readers,
            confirmMsg,
            stories: [
              {
                name: `${firstName} ${lastName}`,
                day: moment().format('dddd'),
                text: storyTextArray,
                imageUrl: storyImgFileName,
              },
            ],
          },
          mail.messageId,
          mail.subject,
        );
      }
    }
  } catch (e) {
    log.info(e);
  }
}

async function getReaders(email, id) {
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
    readersHumanized = await Humanize.oxford(readersArray);
    log.info(`${email}: confirm readers2 - ${readersHumanized}`);
    return readersHumanized;
  }
  return false;
}

function advancedReplyParser(inputText, onlyBoundaryCheck) {
  // Can have only boundary check option
  let text = false;
  if (onlyBoundaryCheck) {
    text = inputText;
    // log.info(`>>>>>>>> Before boundary checking: \n${text.length}`);
  } else {
    // Parse the reply
    // log.info(`>>>>>>>> Before reply stripping: \n${inputText.length}`);
    const reply = replyParser(inputText, true);
    // log.info(`>>>>>>>> After reply stripping: \n${reply.length}`);
    text = parseWithTalon(reply).text; // Should use talon instead
    // log.info(`>>>>>>>> Before boundary checking: \n${text.length}`);
  }

  // Search any of the boundaries phrases
  let boundaryIndex = false;
  // For each boundary
  Object.values(boundaries).forEach((item) => {
    // Find where the boundary appears in the text
    const textTemp = text.replace(/\n/g, ' ');
    const index = textTemp.indexOf(item);
    // If it appears in the text
    if (index > -1) {
      // If a previous boundary already appeared
      if (boundaryIndex) {
        // If THIS index is lower than the previous one, i.e. sooner in the text
        if (index < boundaryIndex) {
          log.info(`Boundary stripping: ${item}`);
          // Make the boundary index this NEW LOWER index
          boundaryIndex = index;
        }
        // If no boundary index found yet, make boundary index this index
      } else {
        log.info(`Boundary stripping: ${item}`);
        boundaryIndex = index;
      }
    }
  });

  // console.log(text);
  // console.log(boundaryIndex);
  if (boundaryIndex) {
    text = text.substr(0, boundaryIndex);
  }
  // log.info(`>>>>>>>> After boundary checking: \n${text.length}`);
  return text;
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
      if (standardise(removeWriterEmail) === standardise(email)) {
        log.info(`${email}: removeWriter - skip own email`);
      } else {
        const findRemoveWriter = await findEmail(removeWriterEmail, 'email firstName lastName');
        // If writer to be removed exists
        if (findRemoveWriter) {
          // And if that writer is actually in our user's writers
          if (writerIds.indexOf(findRemoveWriter.id.toString()) > -1) {
            removeWriterIds.push(findRemoveWriter.id.toString());
            // Add to array of ids to remove
            successArray.push(
              `${findRemoveWriter.firstName} ${findRemoveWriter.lastName} (${removeWriterEmail})`,
            );
            // Send email saying 'X has removed you. If not cool, let us know'
            sendMail('on_removedaswriter', removeWriterEmail, {
              firstName,
              lastName,
              email,
            });
            log.info(
              `${email}: removeWriter ${findRemoveWriter.firstName} ${
                findRemoveWriter.lastName
              } and notify`,
            );
          } else {
            log.info(`${email}: removeWriter - ${removeWriterEmail} already not a writer for user`);
          }
        }
      }
    }),
  );

  // Now that you have the remove writer Ids, remove them
  removeWriterIds.forEach((removeWriterId) => {
    if (removeWriterId === idOfEmailer) {
      log.info(`${email}: removeWriter - skip own id`);
    } else {
      const index = writerIds.indexOf(removeWriterId);
      if (index > -1) {
        log.info(`${email}: removeWriter - ${removeWriterId} found`);
        writerIds.splice(index, 1);
      } else {
        log.info(`${email}: removeWriter - id not found`);
      }
    }
  });
  // Update user with removed writerIds
  const updateWriterIds = await User.update({ email }, { writerIds }, { multi: true });
  log.info(`${email}: removeWriter - completed (${updateWriterIds.nModified} update)`);

  return successArray;
}

async function addReaders(addReaderEmails, email, firstName, lastName, id) {
  const successArray = [];
  await Promise.all(
    addReaderEmails.map(async (addReaderEmail) => {
      if (standardise(addReaderEmail) === standardise(email)) {
        log.info(`${email}: addReader - skip own email`);
      } else {
        const findReferredUser = await findEmail(
          addReaderEmail,
          'email firstName lastName writerIds',
        );
        if (findReferredUser) {
          log.info(
            `${email}: addReader - ${addReaderEmail} already exists - will send on_receivefriendrequest`,
          );
          // Add to writerIds
          const writerIds = findReferredUser.writerIds;
          // If this reader already has our user as a writer
          if (writerIds.indexOf(id.toString()) > -1) {
            // Do nothing
            log.info(`${email}: addReader - ${addReaderEmail} already a reader`);
          } else {
            writerIds.push(id.toString());
            const updateWriterIds = await User.update(
              { email: addReaderEmail },
              { writerIds },
              { multi: true },
            );
            log.info(
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
          log.info(
            `${email}: addReader - ${addReaderEmail} does not exist - create and send on_invite`,
          );
          log.info(`${email}: addReader - your friend ${createNewUser.email} saved as new user`);
          successArray.push(createNewUser.email);
        }
      }
    }),
  );
  return successArray;
}

let countReconnects = 0;
let connected = false;

function restart() {
  if (!connected) {
    countReconnects += 1;
    log.info(`Attempt to reconnect ${countReconnects}`);
    mailListener.start();
  } else {
    clearInterval(this);
  }
}

const listener = {
  start: () => {
    mailListener.start();

    mailListener.on('server:connected', () => {
      log.info('imapConnected');
      countReconnects = 0;
      connected = true;
    });

    mailListener.on('server:disconnected', () => {
      log.info('imapDisconnected');
      setTimeout(() => {
        console.log('Trying to establish imap connection again');
        mailListener.restart();
      }, 5 * 1000);
      // setTimeout(() => {
      //   mailListener.start();
      // }, 5000);
      // connected = false;
      // setInterval(restart, 5000);
    });

    mailListener.on('mail', (mail, seqno, attributes) => {
      processMail(mail);

      // Save all emails to louis@sundaystori.es
      // They will have to have their 'to' address changed to work as tests
      const to = mail.to[0].address;
      if (to === 'louis@sundaystori.es' && config.saveEmails) {
        fs.writeFile(`./emails/tests/${mail.subject.toString()}.json`, JSON.stringify(mail), 'binary', (err) => {
          if (err) log.info(err);
          else log.info('>>>>>>>> Email saved >>>>>>>>');
        });
      }
    });

    mailListener.on('error', (err) => {
      log.info(err);
    });
  },
};

export default listener;
