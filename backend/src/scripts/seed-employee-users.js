import { connectDb } from '../config/db.js';
import { Employee } from '../models/Employee.js';
import { EmployeeUser } from '../models/EmployeeUser.js';
import { env } from '../config/env.js';

async function main() {
  await connectDb(env.mongoUri);
  const employees = await Employee.find();
  let created = 0;
  for (const emp of employees) {
    const username = emp.name.trim().toLowerCase().replace(/\s+/g, '');
    const email = `${username}@gmail.com`;
    const password = `${username}@123`;
    const passwordHash = await EmployeeUser.hashPassword(password);
    let user = await EmployeeUser.findOne({ email });
    if (!user) {
      await EmployeeUser.create({ email, passwordHash, employee: emp._id });
      created++;
    } else {
      user.passwordHash = passwordHash;
      user.employee = emp._id;
      await user.save();
    }
    // eslint-disable-next-line no-console
    console.log(`Employee user: ${email} / ${password}`);
  }
  console.log(`Seeded ${created} employee users.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});