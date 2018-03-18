import mongoose, { Schema } from 'mongoose';

const userSchema = Schema({
  firstName: String,
  lastName: String,
  email: String,
  receiveFromIds: Array,
  timeCreated: String,
  currentStoryId: String,
});

const User = mongoose.model('User', userSchema);

export default User;
