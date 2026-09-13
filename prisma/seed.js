// Creates the admin user from environment variables on first start.
// Existing users are left unchanged so restarts do not reset the password.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const MIN_PASSWORD_LENGTH = 8;

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const prisma = new PrismaClient();

  try {
    if (email && password) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(
          `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        );
      }
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        console.log(`Admin user ${email} already exists.`);
      } else {
        const passwordHash = await bcrypt.hash(password, 12);
        let username = (email.split("@")[0] || "admin")
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_");
        if (username.length < 3) username = `${username}_admin`;
        username = username.slice(0, 32);
        await prisma.user.create({
          data: { email, username, passwordHash, role: "admin" },
        });
        console.log(`Created admin user ${email}.`);
      }
    } else {
      console.warn("ADMIN_EMAIL or ADMIN_PASSWORD is missing — skipping admin seed.");
    }

    const folderCount = await prisma.scanFolder.count();
    if (folderCount === 0) {
      const paths = (process.env.SCAN_PATHS || "/media")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      for (const folderPath of paths) {
        await prisma.scanFolder.create({
          data: {
            label: folderPath === "/media" ? "Media" : folderPath,
            kind: "local",
            path: folderPath,
          },
        });
        console.log(`Added default scan folder ${folderPath}.`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
