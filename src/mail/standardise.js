const test1 = 'l.a.w.r.e.n.c.ebarclay@googlemail.com';
const test2 = 'lawrencebarclay+hive@googlemail.com';
const test3 = 'l.a.w.r.e.n.c.e.b.a.r.c.l.a.y@gmail.com';

export const standardise = (email) => {
  const end = email.substr(email.indexOf('@') + 1);
  if (end === 'gmail.com' || end === 'googlemail.com') {
    let start = email.substr(0, email.indexOf('@'));
    start = start.replace(/\./g, '');
    const newEmail = `${start}@gmail.com`;
    return newEmail;
  }
  return email;
};
