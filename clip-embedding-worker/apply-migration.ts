
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
    const migrationPath = path.join('..', 'charpstar-unified', 'supabase', 'migrations', '20251119_create_similarity_search_func.sql');

    if (!process.env.SUPABASE_POOLED_DB_URL) {
        console.error('❌ SUPABASE_POOLED_DB_URL not found in .env.local');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.SUPABASE_POOLED_DB_URL,
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();

        console.log(`📖 Reading migration file: ${migrationPath}`);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🚀 Applying migration...');
        await client.query(sql);

        console.log('✅ Migration applied successfully!');

    } catch (error) {
        console.error('❌ Error applying migration:', error);
    } finally {
        await client.end();
    }
}

applyMigration();
