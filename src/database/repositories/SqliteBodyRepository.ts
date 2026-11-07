import { IBodyRepository, ISqliteDatabase } from './interfaces';
import { BodyLog, WeightHistoryPoint } from '../../types/domain';

interface BodyLogRow {
  id: string;
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arms_cm: number | null;
  legs_cm: number | null;
  photo_uris_json: string | null;
  created_at: string;
}

export class SqliteBodyRepository implements IBodyRepository {
  constructor(private db: ISqliteDatabase) {}

  private mapRow(row: BodyLogRow): BodyLog {
    let photoUris: string[] = [];
    if (row.photo_uris_json) {
      try {
        photoUris = JSON.parse(row.photo_uris_json);
      } catch {
        photoUris = [];
      }
    }

    return {
      id: row.id,
      date: row.date,
      weightKg: row.weight_kg,
      bodyFatPct: row.body_fat_pct ?? undefined,
      waistCm: row.waist_cm ?? undefined,
      chestCm: row.chest_cm ?? undefined,
      armsCm: row.arms_cm ?? undefined,
      legsCm: row.legs_cm ?? undefined,
      photoUris,
      createdAt: row.created_at,
    };
  }

  async getBodyLog(date: string): Promise<BodyLog | null> {
    const row = await this.db.getFirstAsync<BodyLogRow>(
      `SELECT id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at
       FROM body_logs
       WHERE date = ?
       LIMIT 1;`,
      date
    );

    return row ? this.mapRow(row) : null;
  }

  async saveBodyLog(log: Omit<BodyLog, 'id' | 'createdAt'>): Promise<BodyLog> {
    const id = `body-log-${log.date}`;
    const createdAt = new Date().toISOString();
    const photoUrisJson = JSON.stringify(log.photoUris ?? []);

    await this.db.runAsync(
      `INSERT INTO body_logs (id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         weight_kg = excluded.weight_kg,
         body_fat_pct = excluded.body_fat_pct,
         waist_cm = excluded.waist_cm,
         chest_cm = excluded.chest_cm,
         arms_cm = excluded.arms_cm,
         legs_cm = excluded.legs_cm,
         photo_uris_json = excluded.photo_uris_json;`,
      id,
      log.date,
      log.weightKg,
      log.bodyFatPct ?? null,
      log.waistCm ?? null,
      log.chestCm ?? null,
      log.armsCm ?? null,
      log.legsCm ?? null,
      photoUrisJson,
      createdAt
    );

    return {
      ...log,
      id,
      photoUris: log.photoUris ?? [],
      createdAt,
    };
  }

  async calculateMovingAverage(date: string, windowDays = 7): Promise<number | null> {
    const offsetDays = `-${windowDays - 1} days`;

    interface AvgResult {
      moving_avg: number | null;
      count: number;
    }

    const res = await this.db.getFirstAsync<AvgResult>(
      `SELECT AVG(weight_kg) as moving_avg, COUNT(*) as count
       FROM body_logs
       WHERE date <= ? AND date >= date(?, ?) AND weight_kg > 0;`,
      date,
      date,
      offsetDays
    );

    if (!res || res.count === 0 || res.moving_avg === null) {
      return null;
    }

    return Number(res.moving_avg.toFixed(2));
  }

  async getWeightHistory(startDate?: string, endDate?: string): Promise<WeightHistoryPoint[]> {
    let sql = `SELECT date, weight_kg FROM body_logs WHERE weight_kg > 0`;
    const params: string[] = [];

    if (startDate && endDate) {
      sql += ` AND date >= ? AND date <= ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      sql += ` AND date >= ?`;
      params.push(startDate);
    } else if (endDate) {
      sql += ` AND date <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY date ASC;`;

    interface WeightRow {
      date: string;
      weight_kg: number;
    }

    const rows = await this.db.getAllAsync<WeightRow>(sql, ...params);

    const historyPoints: WeightHistoryPoint[] = [];
    for (const r of rows) {
      const ma = await this.calculateMovingAverage(r.date, 7);
      historyPoints.push({
        date: r.date,
        weightKg: r.weight_kg,
        movingAverage: ma,
      });
    }

    return historyPoints;
  }

  async savePhoto(date: string, photoUri: string): Promise<string[]> {
    const existing = await this.getBodyLog(date);
    const photoUris = existing?.photoUris ? [...existing.photoUris] : [];
    if (!photoUris.includes(photoUri)) {
      photoUris.push(photoUri);
    }

    if (existing) {
      await this.db.runAsync(
        `UPDATE body_logs SET photo_uris_json = ? WHERE date = ?;`,
        JSON.stringify(photoUris),
        date
      );
    } else {
      await this.saveBodyLog({
        date,
        weightKg: 0,
        photoUris,
      });
    }

    return photoUris;
  }

  async getPhotos(): Promise<{ date: string; uri: string }[]> {
    const rows = await this.db.getAllAsync<{ date: string; photo_uris_json: string | null }>(
      `SELECT date, photo_uris_json
       FROM body_logs
       WHERE photo_uris_json IS NOT NULL AND photo_uris_json != '[]'
       ORDER BY date DESC;`
    );

    const photos: { date: string; uri: string }[] = [];
    for (const r of rows) {
      if (r.photo_uris_json) {
        try {
          const uris: string[] = JSON.parse(r.photo_uris_json);
          for (const u of uris) {
            photos.push({ date: r.date, uri: u });
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }

    return photos;
  }

  async deletePhoto(date: string, photoUri: string): Promise<string[]> {
    const existing = await this.getBodyLog(date);
    if (!existing || !existing.photoUris) {
      return [];
    }
    const updatedUris = existing.photoUris.filter((u) => u !== photoUri);
    await this.db.runAsync(
      `UPDATE body_logs SET photo_uris_json = ? WHERE date = ?;`,
      JSON.stringify(updatedUris),
      date
    );
    return updatedUris;
  }
}

