import { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATION_V2_SQL, SCHEMA_SQL, SCHEMA_VERSION } from './sql';
import seedExercises from '../data/exercises.json';

export const DB_NAME = 'kilo.db';

/** Runs on every app start (SQLiteProvider onInit). Idempotent. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  // CREATE TABLE IF NOT EXISTS never adds columns to an existing table, so read the
  // stamped version BEFORE running SCHEMA_SQL and run ALTERs for anything older.
  // No meta table yet = fresh install; SCHEMA_SQL below already has the new columns.
  await db.execAsync('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  const stored = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'schema_version'");
  const oldVersion = stored ? Number(stored.value) : SCHEMA_VERSION;
  if (oldVersion < 2) await db.execAsync(MIGRATION_V2_SQL);

  await db.execAsync(SCHEMA_SQL);
  await db.runAsync(
    'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    'schema_version',
    String(SCHEMA_VERSION),
  );

  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exercises');
  if (row && row.n === 0) {
    await seed(db);
  }
}

async function seed(db: SQLiteDatabase): Promise<void> {
  const stmt = await db.prepareAsync(
    `INSERT OR IGNORE INTO exercises
     (id, name, category, equipment, primary_muscles, secondary_muscles, instructions, is_custom)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
  );
  try {
    await db.withTransactionAsync(async () => {
      for (const e of seedExercises) {
        await stmt.executeAsync(
          e.id,
          e.name,
          e.category,
          e.equipment,
          JSON.stringify(e.primaryMuscles),
          JSON.stringify(e.secondaryMuscles),
          e.instructions,
        );
      }
    });
  } finally {
    await stmt.finalizeAsync();
  }
}
