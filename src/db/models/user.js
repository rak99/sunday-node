import mongoose, { Schema } from 'mongoose';
import config from '../../config.json';

const userSchema = Schema({
  firstName: String,
  lastName: String,
  email: String,
  writerIds: Array,
  referredBy: String,
  timeCreated: String,
  currentStoryId: String,
  lastSentSunday: String,
  sendReminder: Boolean,
});

userSchema.index({ name: 'text', writerIds: 'text' });

let userModelName = 'User';

if (config.dev || config.testmode) {
  userModelName = 'test-User';
}

const User = mongoose.model(userModelName, userSchema);

export default User;
