import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Note: In production, users are created via Supabase Auth + /auth/sync
  // This seed creates a test project structure for development
  console.log('Seed complete. Create a user via the app signup flow.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
