import pg from 'pg';
import { PostgresEventStore } from 'es-dcb-library';

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const store = new PostgresEventStore({ pool });
