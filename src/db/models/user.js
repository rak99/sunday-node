import mongoose, { Schema } from 'mongoose';
import passportLocalMongoose from 'passport-local-mongoose';
import config from '../../config.json';

const userSchema = Schema({
  firstName: String,
  lastName: String,
  email: String,
  referredBy: String,
  writerIds: Array,
  timeCreated: String,
  currentStoryId: String,
  lastSentSunday: String,
  sendReminder: Boolean,
  username: String,
});

userSchema.index({ name: 'text', writerIds: 'text' });

userSchema.plugin(passportLocalMongoose);

let userModelName = 'User';

if (config.dev || config.testmode) {
  userModelName = 'test-User';
}

const User = mongoose.model(userModelName, userSchema);

export default User;
