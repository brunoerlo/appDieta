import { SupabaseClient } from '@supabase/supabase-js';
import { IBodyRepository } from './interfaces';
import { supabase as defaultSupabase } from '../../services/supabaseClient';
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
  photo_uris: string[] | null;
  created_at: string;
}

const BUCKET_NAME = 'body-photos';
const SIGNED_URL_TTL_SECONDS = 3600;

export class SupabaseBodyRepository implements IBodyRepository {
  constructor(private client: SupabaseClient = defaultSupabase) {}

  private extractStoragePath(uriOrPath: string): string {
    if (!uriOrPath) return '';
    if (!uriOrPath.startsWith('http://') && !uriOrPath.startsWith('https://')) {
      return uriOrPath;
    }
    const marker = `/${BUCKET_NAME}/`;
    const idx = uriOrPath.indexOf(marker);
    if (idx === -1) return uriOrPath;
    const afterBucket = uriOrPath.slice(idx + marker.length);
    const queryIdx = afterBucket.indexOf('?');
    return decodeURIComponent(queryIdx === -1 ? afterBucket : afterBucket.slice(0, queryIdx));
  }

  private isStoragePath(value: string): boolean {
    return (
      Boolean(value) &&
      !value.startsWith('http://') &&
      !value.startsWith('https://') &&
      !value.startsWith('file://') &&
      !value.startsWith('data:')
    );
  }

  private async resolvePhotoUrls(paths: string[]): Promise<string[]> {
    const storagePaths = paths.filter((p) => this.isStoragePath(p));
    if (storagePaths.length === 0) return paths;

    const { data, error } = await this.client.storage
      .from(BUCKET_NAME)
      .createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS);

    if (error || !data) {
      return paths;
    }

    const signedMap = new Map<string, string>();
    for (const item of data) {
      if (item.path && item.signedUrl) {
        signedMap.set(item.path, item.signedUrl);
      }
    }

    return paths.map((p) => signedMap.get(p) ?? p);
  }

  private mapRow(row: BodyLogRow, resolvedUris?: string[]): BodyLog {
    return {
      id: row.id,
      date: row.date,
      weightKg: row.weight_kg,
      bodyFatPct: row.body_fat_pct ?? undefined,
      waistCm: row.waist_cm ?? undefined,
      chestCm: row.chest_cm ?? undefined,
      armsCm: row.arms_cm ?? undefined,
      legsCm: row.legs_cm ?? undefined,
      photoUris: resolvedUris ?? (Array.isArray(row.photo_uris) ? row.photo_uris : []),
      createdAt: row.created_at,
    };
  }

  async getBodyLog(date: string): Promise<BodyLog | null> {
    const { data, error } = await this.client
      .from('body_logs')
      .select('id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris, created_at')
      .eq('date', date)
      .maybeSingle<BodyLogRow>();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const rawPaths = Array.isArray(data.photo_uris) ? data.photo_uris : [];
    const resolved = await this.resolvePhotoUrls(rawPaths);
    return this.mapRow(data, resolved);
  }

  async saveBodyLog(log: Omit<BodyLog, 'id' | 'createdAt'>): Promise<BodyLog> {
    const storedPaths = (log.photoUris ?? []).map((u) => this.extractStoragePath(u));

    const { data: sessionData } = await this.client.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      throw new Error('Usuário não autenticado.');
    }

    const { data, error } = await this.client
      .from('body_logs')
      .upsert(
        {
          user_id: userId,
          date: log.date,
          weight_kg: log.weightKg,
          body_fat_pct: log.bodyFatPct ?? null,
          waist_cm: log.waistCm ?? null,
          chest_cm: log.chestCm ?? null,
          arms_cm: log.armsCm ?? null,
          legs_cm: log.legsCm ?? null,
          photo_uris: storedPaths,
        },
        { onConflict: 'user_id,date' }
      )
      .select('id, date, weight_kg, body_fat_pct, waist_cm, chest_cm, arms_cm, legs_cm, photo_uris, created_at')
      .single<BodyLogRow>();

    if (error || !data) {
      throw new Error(error?.message ?? 'Erro ao salvar registro corporal.');
    }

    const resolved = await this.resolvePhotoUrls(
      Array.isArray(data.photo_uris) ? data.photo_uris : []
    );
    return this.mapRow(data, resolved);
  }

  async calculateMovingAverage(date: string, windowDays = 7): Promise<number | null> {
    const target = new Date(`${date}T00:00:00Z`);
    const start = new Date(target);
    start.setUTCDate(start.getUTCDate() - (windowDays - 1));
    const startDate = start.toISOString().slice(0, 10);

    const { data, error } = await this.client
      .from('body_logs')
      .select('weight_kg')
      .gt('weight_kg', 0)
      .gte('date', startDate)
      .lte('date', date)
      .returns<{ weight_kg: number }[]>();

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return null;

    const sum = data.reduce((acc, r) => acc + r.weight_kg, 0);
    return Number((sum / data.length).toFixed(2));
  }

  async getWeightHistory(startDate?: string, endDate?: string): Promise<WeightHistoryPoint[]> {
    let query = this.client
      .from('body_logs')
      .select('date, weight_kg')
      .gt('weight_kg', 0)
      .order('date', { ascending: true });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query.returns<{ date: string; weight_kg: number }[]>();
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    // Compute 7-day moving average in-memory to avoid N+1 roundtrips
    return rows.map((r, idx) => {
      const currentMs = new Date(`${r.date}T00:00:00Z`).getTime();
      const windowStartMs = currentMs - 6 * 24 * 60 * 60 * 1000;
      let sum = 0;
      let count = 0;
      for (let j = idx; j >= 0; j--) {
        const dMs = new Date(`${rows[j].date}T00:00:00Z`).getTime();
        if (dMs < windowStartMs) break;
        sum += rows[j].weight_kg;
        count++;
      }
      return {
        date: r.date,
        weightKg: r.weight_kg,
        movingAverage: count > 0 ? Number((sum / count).toFixed(2)) : null,
      };
    });
  }

  async savePhoto(date: string, photoUri: string): Promise<string[]> {
    const { data: sessionData } = await this.client.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      throw new Error('Usuário não autenticado.');
    }

    let storagePath = this.extractStoragePath(photoUri);

    // Upload local file to private Supabase Storage bucket
    if (photoUri.startsWith('file://') || photoUri.startsWith('content://')) {
      const safeDate = String(date).replace(/[^0-9-]/g, '');
      const rawFilename = photoUri.split('/').pop() || `${safeDate}_${Date.now()}.jpg`;
      const cleanFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = `${userId}/${safeDate}_${Date.now()}_${cleanFilename}`;

      const response = await fetch(photoUri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await this.client.storage
        .from(BUCKET_NAME)
        .upload(storagePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }
    }

    const { data: existingRow } = await this.client
      .from('body_logs')
      .select('id, weight_kg, photo_uris')
      .eq('date', date)
      .maybeSingle<{ id: string; weight_kg: number; photo_uris: string[] | null }>();

    const currentPaths = Array.isArray(existingRow?.photo_uris)
      ? [...existingRow.photo_uris]
      : [];

    if (!currentPaths.includes(storagePath)) {
      currentPaths.push(storagePath);
    }

    if (existingRow) {
      const { error: updateError } = await this.client
        .from('body_logs')
        .update({ photo_uris: currentPaths })
        .eq('id', existingRow.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await this.client.from('body_logs').insert({
        user_id: userId,
        date,
        weight_kg: 0,
        photo_uris: currentPaths,
      });
      if (insertError) throw new Error(insertError.message);
    }

    return this.resolvePhotoUrls(currentPaths);
  }

  async getPhotos(): Promise<{ date: string; uri: string }[]> {
    const { data, error } = await this.client
      .from('body_logs')
      .select('date, photo_uris')
      .order('date', { ascending: false })
      .returns<{ date: string; photo_uris: string[] | null }[]>();

    if (error) throw new Error(error.message);

    const flat: { date: string; path: string }[] = [];
    for (const r of data ?? []) {
      if (Array.isArray(r.photo_uris)) {
        for (const p of r.photo_uris) {
          if (p) flat.push({ date: r.date, path: p });
        }
      }
    }

    if (flat.length === 0) return [];
    const resolvedUrls = await this.resolvePhotoUrls(flat.map((item) => item.path));
    return flat.map((item, idx) => ({
      date: item.date,
      uri: resolvedUrls[idx],
    }));
  }

  async deletePhoto(date: string, photoUri: string): Promise<string[]> {
    const targetPath = this.extractStoragePath(photoUri);

    const { data: existingRow, error: fetchError } = await this.client
      .from('body_logs')
      .select('id, photo_uris')
      .eq('date', date)
      .maybeSingle<{ id: string; photo_uris: string[] | null }>();

    if (fetchError) throw new Error(fetchError.message);
    if (!existingRow || !Array.isArray(existingRow.photo_uris)) {
      return [];
    }

    const updatedPaths = existingRow.photo_uris.filter(
      (p) => p !== photoUri && p !== targetPath
    );

    const { error: updateError } = await this.client
      .from('body_logs')
      .update({ photo_uris: updatedPaths })
      .eq('id', existingRow.id);

    if (updateError) throw new Error(updateError.message);

    if (this.isStoragePath(targetPath)) {
      await this.client.storage.from(BUCKET_NAME).remove([targetPath]);
    }

    return this.resolvePhotoUrls(updatedPaths);
  }
}
