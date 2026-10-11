const config = require('./backend/config');
const { initDatabase } = require('./backend/database/connection');
const { runMigrations } = require('./backend/database/migrations');
const { seedAdmin } = require('./backend/database/seed');
const app = require('./backend/app');

async function startServer() {
  try {
    console.log('--- Initializing FoodShare AI Platform ---');
    
    // 1. Initialize SQLite Database
    initDatabase();

    // 2. Run versioned schema migrations
    await runMigrations();

    // 3. Seed initial secure Admin account (Deploy-time seed as per FR-1 & Security spec)
    await seedAdmin();

    // 4. Start HTTP Server
    const server = app.listen(config.port, () => {
      console.log(`=======================================================`);
      console.log(`FoodShare AI Platform is running on port ${config.port}`);
      console.log(`Access Web Application: http://localhost:${config.port}`);
      console.log(`Default Admin Account: ${config.admin.email}`);
      console.log(`=======================================================`);
    });

    // Graceful shutdown handling
    process.on('SIGINT', () => {
      console.log('\nShutting down server gracefully...');
      server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Fatal error starting FoodShare AI server:', error);
    process.exit(1);
  }
}

startServer();
