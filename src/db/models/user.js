import mongoose, { Schema } from 'mongoose';

const userSchema = Schema({
  firstName: String,
  lastName: String,
  email: String,
  writerIds: Array,
  referredBy: String,
  timeCreated: String,
  currentStoryId: String,
});

userSchema.index({ name: 'text', writerIds: 'text' });

const User = mongoose.model('User', userSchema);

export default User;
