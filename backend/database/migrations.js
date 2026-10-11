const { getDatabase } = require('./connection');

async function runMigrations(customDb = null) {
  const db = customDb || getDatabase();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appliedRows = await db.all('SELECT version FROM schema_migrations ORDER BY version ASC');
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  const migrations = [
    {
      version: 1,
      name: 'initial_core_schema',
      sql: `
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('DONOR', 'NGO', 'VOLUNTEER', 'ADMIN')),
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- NGO profiles table
        CREATE TABLE IF NOT EXISTS ngo_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          organisation_name TEXT NOT NULL,
          registration_number TEXT NOT NULL,
          address TEXT NOT NULL,
          verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
          reviewed_by INTEGER REFERENCES users(id),
          reviewed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Food listings table with version for optimistic locking
        CREATE TABLE IF NOT EXISTS food_listings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit TEXT NOT NULL,
          pickup_address TEXT NOT NULL,
          pickup_window TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'CLAIMED', 'PICKED_UP', 'DELIVERED', 'CANCELLED', 'EXPIRED')),
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Claims table with UNIQUE(listing_id) preventing double claims
        CREATE TABLE IF NOT EXISTS claims (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          listing_id INTEGER NOT NULL UNIQUE REFERENCES food_listings(id) ON DELETE CASCADE,
          ngo_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
          status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'CANCELLED'))
        );

        -- Deliveries table with unique claim_id
        CREATE TABLE IF NOT EXISTS deliveries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          claim_id INTEGER NOT NULL UNIQUE REFERENCES claims(id) ON DELETE CASCADE,
          volunteer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK(status IN ('ASSIGNED', 'PICKED_UP', 'DELIVERED')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          picked_up_at TEXT,
          delivered_at TEXT
        );

        -- Notifications table
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          message TEXT NOT NULL,
          type TEXT NOT NULL,
          read_flag INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Indexes for query efficiency and consistency
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_listings_status ON food_listings(status, expires_at);
        CREATE INDEX IF NOT EXISTS idx_listings_donor ON food_listings(donor_id);
        CREATE INDEX IF NOT EXISTS idx_claims_listing ON claims(listing_id);
        CREATE INDEX IF NOT EXISTS idx_claims_ngo ON claims(ngo_id);
        CREATE INDEX IF NOT EXISTS idx_deliveries_volunteer ON deliveries(volunteer_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_flag);
      `
    }
  ];

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      await db.exec(migration.sql);
      await db.run(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
        [migration.version, migration.name]
      );
      console.log(`[Migration] Applied version ${migration.version}: ${migration.name}`);
    }
  }
}

module.exports = {
  runMigrations
};
