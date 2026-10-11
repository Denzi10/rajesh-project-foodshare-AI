const bcrypt = require('bcryptjs');
const { getDatabase } = require('./connection');
const config = require('../config');

async function seedAdmin(customDb = null) {
  const db = customDb || getDatabase();

  const adminEmail = config.admin.email.toLowerCase().trim();
  const existing = await db.get('SELECT id, email FROM users WHERE email = ?', [adminEmail]);

  if (!existing) {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(config.admin.password, saltRounds);

    const result = await db.run(
      `INSERT INTO users (name, email, password_hash, role, enabled)
       VALUES (?, ?, ?, 'ADMIN', 1)`,
      [config.admin.name, adminEmail, passwordHash]
    );

    console.log(`[Seed] Initial ADMIN seeded successfully (ID: ${result.lastID}, Email: ${adminEmail})`);
    return result.lastID;
  }

  return existing.id;
}

module.exports = {
  seedAdmin
};
