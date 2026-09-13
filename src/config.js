/**
 * The only file you edit after deploying the backend.
 *
 * API_BASE is the public URL of the `license` Edge Function. It contains no
 * secret: the service-role key and the admin token live on the server only.
 */
export const API_BASE = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/license';

/** How often the service worker re-checks an active licence (minutes). */
export const REVALIDATE_EVERY_MINUTES = 720; // 12 h
