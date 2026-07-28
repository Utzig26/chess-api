import mongoose from 'mongoose';
import { User, UserSchema } from './user.schema';

describe('UserSchema', () => {
  const UserModel = mongoose.model('UserSchemaSpec', UserSchema);

  it('exposes the mongoose id virtual as a hex string', () => {
    const user = new UserModel({ username: 'magnus', password: 'hashed' });

    expect(user.id).toBeDefined();
    expect(user.id).toBe(user._id.toString());
    expect(mongoose.isValidObjectId(user.id)).toBe(true);
  });

  it('does not declare an id path that would shadow the virtual', () => {
    expect(UserSchema.path('id')).toBeUndefined();
  });

  it('serializes the id and hides the mongo internals', () => {
    const user = new UserModel({ username: 'magnus', password: 'hashed' });

    const serialized = user.toJSON();

    expect(serialized).toHaveProperty('id', user._id.toString());
    expect(serialized).not.toHaveProperty('_id');
    expect(serialized).not.toHaveProperty('__v');
  });

  it('normalizes the username to lowercase', () => {
    const user = new UserModel({ username: 'Magnus', password: 'hashed' });

    expect(user.username).toBe('magnus');
  });

  it('keeps the password out of the default projection', () => {
    expect(UserSchema.path('password').options.select).toBe(false);
  });

  it('is registered under the expected model name', () => {
    expect(User.name).toBe('User');
  });
});
