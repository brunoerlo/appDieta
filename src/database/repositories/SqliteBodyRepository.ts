import { IBodyRepository, ISqliteDatabase } from './interfaces';
import { BodyLog, WeightHistoryPoint } from '../../types/domain';
import { PhotoStorageService } from '../../services/PhotoStorageService';

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
  private txChain: Promise<void> = Promise.resolve();

  constructor(private db: ISqliteDatabase) {}

  private async getActiveUserId(): Promise<string> {
    const row = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id FROM users WHERE is_logged_in = 1 LIMIT 1;`
    );
    return row?.id ?? 'default_user';
  }

  private async runSerializedTransaction<T>(task: () => Promise<T>): Promise<T> {
    let result!: T;
    const next = this.txChain.then(async () => {
      await this.db.withTransactionAsync(async () => {
        result = await task();
      });
    });
    this.txChain = next.catch(() => undefined);
    await next;
    return result;
  }

  private mapRow(row: BodyLogRow): BodyLog {
    let photoUris: string[] = [];
    if (row.photo_uris_json) {
      try {
        const parsed = JSON.parse(row.photo_uris_json);
        if (Array.isArray(parsed)) {
          photoUris = parsed.filter((u): u is string => typeof u === 'string');
        }
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
    const userId = await this.getActiveUserId();
    const row = await this.db.getFirstAsync<BodyLogRow>(
      `SELECT id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at
       FROM body_logs
       WHERE date = ? AND user_id = ?
       LIMIT 1;`,
      date,
      userId
    );

    return row ? this.mapRow(row) : null;
  }

  async saveBodyLog(log: Omit<BodyLog, 'id' | 'createdAt'>): Promise<BodyLog> {
    const userId = await this.getActiveUserId();
    const id =
      userId === 'default_user'
        ? `body-log-${log.date}`
        : `body-log-${userId}-${log.date}`;
    const createdAt = new Date().toISOString();
    const safePhotos = Array.isArray(log.photoUris)
      ? log.photoUris.filter((u): u is string => typeof u === 'string')
      : [];
    const photoUrisJson = JSON.stringify(safePhotos);

    await this.db.runAsync(
      `INSERT INTO body_logs (id, user_id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         weight_kg = excluded.weight_kg,
         body_fat_pct = excluded.body_fat_pct,
         waist_cm = excluded.waist_cm,
         chest_cm = excluded.chest_cm,
         arms_cm = excluded.arms_cm,
         legs_cm = excluded.legs_cm,
         photo_uris_json = excluded.photo_uris_json;`,
      id,
      userId,
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
      photoUris: safePhotos,
      createdAt,
    };
  }

  async calculateMovingAverage(date: string, windowDays = 7): Promise<number | null> {
    const userId = await this.getActiveUserId();
    const safeWindow = Math.max(1, Math.min(365, Math.floor(Number(windowDays) || 7)));
    const offsetDays = `-${safeWindow - 1} days`;

    interface AvgResult {
      moving_avg: number | null;
      count: number;
    }

    const res = await this.db.getFirstAsync<AvgResult>(
      `SELECT AVG(weight_kg) as moving_avg, COUNT(*) as count
       FROM body_logs
       WHERE user_id = ? AND date <= ? AND date >= date(?, ?) AND weight_kg > 0;`,
      userId,
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
    const userId = await this.getActiveUserId();
    let sql = `SELECT date, weight_kg FROM body_logs WHERE user_id = ? AND weight_kg > 0`;
    const params: string[] = [userId];

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
    return this.runSerializedTransaction(async () => {
      const userId = await this.getActiveUserId();
      const row = await this.db.getFirstAsync<BodyLogRow>(
        `SELECT id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at
         FROM body_logs
         WHERE date = ? AND user_id = ?
         LIMIT 1;`,
        date,
        userId
      );
      const existing = row ? this.mapRow(row) : null;
      const photoUris = existing?.photoUris ? [...existing.photoUris] : [];
      if (!photoUris.includes(photoUri)) {
        photoUris.push(photoUri);
      }

      if (existing) {
        await this.db.runAsync(
          `UPDATE body_logs SET photo_uris_json = ? WHERE date = ? AND user_id = ?;`,
          JSON.stringify(photoUris),
          date,
          userId
        );
      } else {
        const id =
          userId === 'default_user'
            ? `body-log-${date}`
            : `body-log-${userId}-${date}`;
        const createdAt = new Date().toISOString();
        await this.db.runAsync(
          `INSERT INTO body_logs (id, user_id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at)
           VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)
           ON CONFLICT(user_id, date) DO UPDATE SET
             photo_uris_json = excluded.photo_uris_json;`,
          id,
          userId,
          date,
          0,
          JSON.stringify(photoUris),
          createdAt
        );
      }

      return photoUris;
    });
  }

  async getPhotos(): Promise<{ date: string; uri: string }[]> {
    const userId = await this.getActiveUserId();
    const rows = await this.db.getAllAsync<{ date: string; photo_uris_json: string | null }>(
      `SELECT date, photo_uris_json
       FROM body_logs
       WHERE user_id = ? AND photo_uris_json IS NOT NULL AND photo_uris_json != '[]'
       ORDER BY date DESC;`,
      userId
    );

    const photos: { date: string; uri: string }[] = [];
    for (const r of rows) {
      if (r.photo_uris_json) {
        try {
          const parsed = JSON.parse(r.photo_uris_json);
          if (Array.isArray(parsed)) {
            for (const u of parsed) {
              if (typeof u === 'string') {
                photos.push({ date: r.date, uri: u });
              }
            }
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }

    return photos;
  }

  async deletePhoto(date: string, photoUri: string): Promise<string[]> {
    const updatedUris = await this.runSerializedTransaction(async () => {
      const userId = await this.getActiveUserId();
      const row = await this.db.getFirstAsync<BodyLogRow>(
        `SELECT id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris_json, created_at
         FROM body_logs
         WHERE date = ? AND user_id = ?
         LIMIT 1;`,
        date,
        userId
      );
      const existing = row ? this.mapRow(row) : null;
      if (!existing || !existing.photoUris) {
        return [] as string[];
      }
      const nextUris = existing.photoUris.filter((u) => u !== photoUri);
      await this.db.runAsync(
        `UPDATE body_logs SET photo_uris_json = ? WHERE date = ? AND user_id = ?;`,
        JSON.stringify(nextUris),
        date,
        userId
      );
      return nextUris;
    });

    if (photoUri && photoUri.startsWith('file://')) {
      await PhotoStorageService.deletePhotoFile(photoUri);
    }

    return updatedUris;
  }
}
