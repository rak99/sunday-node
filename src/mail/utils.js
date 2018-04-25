import { cmd } from '../mail/commands';
import { dummies } from '../mail/dummies';

export const searchName = (emailText, nameVariants) => {
  for (let i = 0; i < nameVariants.length; i += 1) {
    let index = emailText.toLowerCase().indexOf(nameVariants[i].toLowerCase());
    let text = emailText;
    if (index < 0) {
      // If not found, or currentVariant doesn't exist
      text = false;
    } else {
      // Found the variant so finding the string after it
      text = text.substr(index + nameVariants[i].length);
      index = text.search(/[\u00C0-\u1FFF\u2C00-\uD7FF\w]/i);
      text = text.substr(index);
      index = text.search(/\n/i);
      text = text.substr(0, index);
      const capitalizeFirstLetter = string => string.charAt(0).toUpperCase() + string.slice(1);
      return capitalizeFirstLetter(text);
    }
  }
  return false;
};

const testAddAndRemove = `
  First name: Louistest
Last name: Barclaytest

- louis.barclay+janet@gmail.com
`;

const matchEmail = /([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
const matchAddReader = new RegExp(
  `(${cmd.addReader}\\s+[a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9._-]+)`,
  'gi',
);
const matchRemoveReader = new RegExp(
  `(${cmd.removeReader}\\s+[a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9._-]+)`,
  'gi',
);
const matchRemoveWriter = new RegExp(
  `(${cmd.removeWriter}\\s+[a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9._-]+)`,
  'gi',
);

export const searchAddAndRemove = (emailText) => {
  // Arrays to provide the info in
  const addReaderEmails = [];
  const removeReaderEmails = [];
  const removeWriterEmails = [];
  // Pull out emails according to the regex
  function findEmails(emailsArray, regexOption) {
    if (emailText.match(regexOption) !== null) {
      emailText.match(regexOption).forEach((item) => {
        let notDummy = true;
        dummies.forEach((dummy) => {
          if (item.match(matchEmail)[0] === dummy) {
            notDummy = false;
          }
        });
        if (notDummy) {
          emailsArray.push(item.match(matchEmail)[0]);
        }
      });
    }
  }
  findEmails(removeReaderEmails, matchRemoveReader);
  findEmails(addReaderEmails, matchAddReader);
  findEmails(removeWriterEmails, matchRemoveWriter);
  return {
    removeReaderEmails,
    addReaderEmails,
    removeWriterEmails,
  };
};

searchAddAndRemove(testAddAndRemove);

export const searchEmails = (emailText) => {
  const emails = emailText.match(matchEmail);
  let uniq = [...new Set(emails)];
  uniq = uniq.map(v => v.toLowerCase());
  // Remove any of the dummies emails
  dummies.forEach((item) => {
    const index = uniq.indexOf(item);
    if (index > -1) {
      uniq.splice(index, 1);
    }
  });
  if (uniq.length === 0) {
    return false;
  }
  return uniq;
};

export const firstNameVariants = [
  'first name',
  'frist name',
  'fist name',
  'first nam',
  'firt name',
  'firs name',
  'first name',
  'firts name',
  'first nmae',
  'fistname',
  'firstname',
];

export const lastNameVariants = [
  'last name',
  'lastr name',
  'lsat name',
  'lats name',
  'last nmae',
  'last nam',
  'las name',
  'lasname',
  'lastname',
];

export const trimAndFindStoryEnd = (emailText) => {
  if (emailText.includes(cmd.storyEnd)) {
    emailText = emailText.substr(0, emailText.indexOf(cmd.storyEnd));
  }
  emailText = emailText.trim();
  return emailText;
};

export const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

export const unwrapPlainText = (plainText) => {
  const array = plainText.split('\n');
  // Find current max line length
  let max = 0;
  array.forEach((item) => {
    if (item.length > max) {
      max = item.length;
    }
  });
  // Adjust cutoff if max line length is longer
  let cutOff = 70;
  if (max > cutOff) {
    cutOff = max;
  }
  let newString = '';
  for (let i = 0; i < array.length; i++) {
    // Define this item
    const thisItem = array[i];
    // Define next item
    const nextItem = array[i + 1];
    if (typeof nextItem === 'undefined') {
      // See if there is a next item
    } else if (thisItem === '') {
      newString += '\n'; // Add a line break for empty strings in array
    } else {
      // Define next item array split by space, to grab first word
      const nextItemArray = nextItem.split(' ');
      // log.info(thisItem, nextItemArray[0], thisItem.length, nextItemArray[0].length);
      // See if line would have been long enough to force wrap
      if (thisItem.length + nextItemArray[0].length + 1 > cutOff) {
        newString += `${thisItem} `; // Put a space after string - not a real line break
      } else {
        newString += `${thisItem}\n`; // Put a line break after string - real line break
      }
    }
  }
  return newString;
};

export const imgMsgs = {
  noImg:
    "We didn't find any attached image large enough to include in your story. You might not want to include an image, but if you do, reply to this email including the original story, and with an image attached which is at least 660 pixels wide.",
  oneImg:
    'We found an image with your story and have included it below. If this is the wrong image, reply to this email with your original story in the reply and the new image attached. If you decide you no longer want an image, simply reply to this email with your original story only, and no image.',
};
