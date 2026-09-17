import { prisma } from "../src/lib/db.js";
import { ensureInitialAdmin } from "../src/services/initialAdmin.js";

ensureInitialAdmin(process.env, prisma)
  .then(async (user) => {
    console.log(`Initial administrator is ready: ${user.email}`);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
