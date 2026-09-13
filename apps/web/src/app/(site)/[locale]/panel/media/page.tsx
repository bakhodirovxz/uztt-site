'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError, type AuthUser } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const LOCALES = ['uz', 'ru', 'en'] as const;

interface GalleryRow {
  id: string;
  title: string;
  photoCount: number;
}
interface VideoRow {
  id: string;
  youtubeId: string;
  title: string;
  category: string | null;
}
interface TournamentOption {
  id: string;
  name: string;
}

export default function AdminMediaPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [galleries, setGalleries] = useState<GalleryRow[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Video formasi: 3 tilli sarlavha
  const [videoForm, setVideoForm] = useState({
    youtubeId: '',
    category: 'highlights',
    tournamentId: '',
    uz: '',
    ru: '',
    en: '',
  });
  // Galereya formasi
  const [galleryTitle, setGalleryTitle] = useState({ uz: '', ru: '', en: '' });
  const [galleryTournamentId, setGalleryTournamentId] = useState('');
  const [selectedGallery, setSelectedGallery] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const load = useCallback(() => {
    api.get<VideoRow[]>('/videos?locale=uz').then(setVideos).catch(() => {});
    api.get<GalleryRow[]>('/galleries?locale=uz').then(setGalleries).catch(() => {});
    api.get<TournamentOption[]>('/tournaments').then(setTournaments).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => {
        if (!user.permissions.includes('media.manage')) throw new Error();
        load();
      })
      .catch(() => router.replace('/login'));
  }, [router, load]);

  function ok(m: string) {
    setMsg(m);
    setError(null);
    load();
  }
  function fail(e: unknown) {
    setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    setMsg(null);
  }

  async function addVideo() {
    try {
      const translations = LOCALES.filter((l) => videoForm[l]).map((l) => ({
        locale: l,
        title: videoForm[l],
      }));
      await api.post('/videos', {
        youtubeId: videoForm.youtubeId,
        category: videoForm.category || undefined,
        tournamentId: videoForm.tournamentId || undefined,
        translations,
      });
      setVideoForm({
        youtubeId: '',
        category: 'highlights',
        tournamentId: '',
        uz: '',
        ru: '',
        en: '',
      });
      ok('Video qo‘shildi');
    } catch (e) {
      fail(e);
    }
  }

  async function createGallery() {
    try {
      const translations = LOCALES.filter((l) => galleryTitle[l]).map((l) => ({
        locale: l,
        title: galleryTitle[l],
      }));
      await api.post('/galleries', {
        translations,
        tournamentId: galleryTournamentId || undefined,
      });
      setGalleryTitle({ uz: '', ru: '', en: '' });
      setGalleryTournamentId('');
      ok('Galereya yaratildi');
    } catch (e) {
      fail(e);
    }
  }

  /** Rasm yuklash (sharp pipeline) → galereyaga qo'shish */
  async function uploadPhoto() {
    if (!photoFile || !selectedGallery) return;
    try {
      const form = new FormData();
      form.append('file', photoFile);
      const res = await fetch(`${API_BASE}/api/uploads/image`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const asset = (await res.json()) as {
        url?: string;
        thumbUrl?: string;
        message?: string;
      };
      if (!res.ok || !asset.url) throw new Error(asset.message ?? 'Yuklash xatosi');
      await api.post(`/galleries/${selectedGallery}/photos`, {
        url: asset.url,
        thumbUrl: asset.thumbUrl,
      });
      setPhotoFile(null);
      ok('Surat yuklandi va galereyaga qo‘shildi');
    } catch (e) {
      fail(e);
    }
  }

  const input =
    'w-full rounded-md border border-border px-3 py-2 outline-none focus:border-accent-500';

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-extrabold uppercase">Media boshqaruvi</h1>
      {msg && <p className="mt-3 rounded-md bg-win/10 px-3 py-2 text-sm font-semibold text-win">{msg}</p>}
      {error && <p className="mt-3 rounded-md bg-accent-100 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Video qo'shish */}
        <div className="rounded-card bg-surface-card p-5 shadow-card">
          <h2 className="font-heading font-bold">Video qo'shish (YouTube)</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={videoForm.youtubeId}
              onChange={(e) => setVideoForm({ ...videoForm, youtubeId: e.target.value })}
              placeholder="YouTube ID (masalan dQw4w9WgXcQ)"
              className={`${input} font-mono text-sm`}
            />
            <select
              value={videoForm.category}
              onChange={(e) => setVideoForm({ ...videoForm, category: e.target.value })}
              className="rounded-md border border-border px-2 py-2"
            >
              {['highlights', 'interview', 'training', 'live'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <select
            value={videoForm.tournamentId}
            onChange={(e) =>
              setVideoForm({ ...videoForm, tournamentId: e.target.value })
            }
            aria-label="Videoni musobaqaga bog'lash"
            className={`mt-2 ${input}`}
          >
            <option value="">Musobaqaga bog‘lanmagan</option>
            {tournaments.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>
          {LOCALES.map((l) => (
            <input
              key={l}
              value={videoForm[l]}
              onChange={(e) => setVideoForm({ ...videoForm, [l]: e.target.value })}
              placeholder={`Sarlavha (${l})`}
              className={`mt-2 ${input}`}
            />
          ))}
          <button
            type="button"
            disabled={!videoForm.youtubeId || !videoForm.uz}
            onClick={addVideo}
            className="mt-3 rounded-md bg-accent-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            Qo'shish
          </button>

          <div className="mt-4 space-y-1.5">
            {videos.map((v) => (
              <div key={v.id} className="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                <span className="font-mono text-xs text-muted">{v.youtubeId}</span>
                <span className="min-w-0 flex-1 truncate">{v.title}</span>
                <button
                  type="button"
                  onClick={() => api.del(`/videos/${v.id}`).then(() => load()).catch(fail)}
                  className="font-semibold text-live"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Galereya + surat yuklash */}
        <div className="rounded-card bg-surface-card p-5 shadow-card">
          <h2 className="font-heading font-bold">Yangi galereya</h2>
          {LOCALES.map((l) => (
            <input
              key={l}
              value={galleryTitle[l]}
              onChange={(e) => setGalleryTitle({ ...galleryTitle, [l]: e.target.value })}
              placeholder={`Nomi (${l})`}
              className={`mt-2 ${input}`}
            />
          ))}
          <select
            value={galleryTournamentId}
            onChange={(e) => setGalleryTournamentId(e.target.value)}
            aria-label="Galereyani musobaqaga bog'lash"
            className={`mt-2 ${input}`}
          >
            <option value="">Musobaqaga bog‘lanmagan</option>
            {tournaments.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!galleryTitle.uz}
            onClick={createGallery}
            className="mt-3 rounded-md bg-accent-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            Yaratish
          </button>

          <h2 className="mt-6 font-heading font-bold">Surat yuklash</h2>
          <select
            value={selectedGallery}
            onChange={(e) => setSelectedGallery(e.target.value)}
            className={`mt-2 ${input}`}
          >
            <option value="">Galereya...</option>
            {galleries.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title} ({g.photoCount})
              </option>
            ))}
          </select>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm"
          />
          <button
            type="button"
            disabled={!photoFile || !selectedGallery}
            onClick={uploadPhoto}
            className="mt-3 rounded-md bg-navy-900 px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            Yuklash (webp'ga o'giriladi)
          </button>
        </div>
      </div>
    </div>
  );
}
