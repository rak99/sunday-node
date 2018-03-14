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
      console.log(text);
      return text;
    }
  }
  return false;
};

export const searchEmails = (emailText) => {
  const emails = emailText.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
  console.log(emails);
  return emails;
};

const testIt = `ok ok ok\n\nfirst name: Lugikus\nlast name: Bagikus\n\nemails:\nlouisbarclay@gmail.com\nlouis@nudgeware.io\n\n\n\nOn Wed, Sep 13, 2017 at 3:26 PM, Sunday Stories <louis@sundaystori.es>\nwrote:\n\n> Hey! We\'ve set up your account now with that email address, but we need a\n> bit more info still. Can you please reply with your first name,
  last name,\n> and emails you\'d like to send Sunday stories to? Write us in this sort of\n> format (copy, paste and change this if you like): First name: Barack Last\n> name
  : Obama Emails to send to: miche@obama.com hillary@clinton.com\n> donald@trump.com Put as many emails as you like. Thanks! Sunday\n`;

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
