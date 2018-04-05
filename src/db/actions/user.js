/* eslint-disable import/prefer-default-export */

import User from '../models/user';

export const createUser = (userObj) => {
  // more shit goes here
  const user = new User(userObj);
  user.save((err) => {
    if (err) console.log(err);
  });
};

// createUser({ email: 'louis.barclay@gmail.com', firstName: 'Louis', lastName: 'Barclay' });

export const createUserAddReceiveFromId = (userObj, receiveFromEmail) => {
  console.log(receiveFromEmail);
  // more shit goes here
  const user = new User(userObj);
  user.save((err) => {
    if (err) console.log(err);
  });
};

export const emailHasUser = (object) => {
  User.findOne({ email: object.email }, 'email firstName lastName _id', (err, user) => {
    if (err) {
      return;
    }
    if (user) {
      console.log('user exists, add user to mailObject');
      console.log(user);
      object.user = user;
    } else {
      console.log('user doesnt exist, set mailObject user false');
      object.user = false;
    }
    console.log('run callback');
  });
};

async function check() {
  const foundMe = await User.findOne(
    { email: 'louis.barclay@gmail.com' },
    'email firstName lastName _id',
  );
  if (foundMe) {
    console.log();
  } else {
    console.log();
  }
}

check();

export const deleteAllUsers = () => {
  User.remove({}, (err) => {
    if (err) {
      return console.log(err);
    }
    // removed!
  });
};

export const updateUser = (email, updateObj) => {
  const conditions = { email };
  const update = updateObj;
  const options = { multi: true };
  function callback(err, numAffected) {
    console.log(err);
    console.log(numAffected);
    // numAffected is the number of updated documents
  }
  User.update(conditions, update, options, callback);
};

/* eslint-enable import/prefer-default-export */
