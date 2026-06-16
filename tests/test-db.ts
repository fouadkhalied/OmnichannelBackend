import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'src/config/.env' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function testConfig() {
    try {
        await client.connect();
        console.log('Connected to Postgres successfully.');
        const res = await client.query('SELECT 1');
        console.log('Query executed successfully:', res.rows);
        await client.end();
        console.log('Connection closed.');
    } catch (err) {
        console.error('Connection failed:', err);
        process.exit(1);
    }
}

testConfig();
