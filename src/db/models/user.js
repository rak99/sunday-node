import mongoose, { Schema } from 'mongoose';

const userSchema = Schema({
  firstName: String,
  lastName: String,
  email: String,
  writerIds: Array,
  referredBy: String,
  timeCreated: String,
  currentStoryId: String,
  lastSentSunday: String,
});

userSchema.index({ name: 'text', writerIds: 'text' });

// if config dev mode
// don't allow deleting

const User = mongoose.model('User', userSchema);

export default User;
