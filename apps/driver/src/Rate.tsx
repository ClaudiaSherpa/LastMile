import { useState } from 'react';
import { api } from './lib/api';
import { useI18n } from './lib/i18n';

/** Public consignee rating page, opened from the rating link (no account). */
export function Rate({ token }: { token: string }) {
  const { t, lang, setLang } = useI18n();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!stars) return;
    setBusy(true); setErr('');
    try { await api.submitRating(token, stars, feedback || undefined); setDone(true); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--paper)', padding: 20 }}>
      <div className="card" style={{ width: 420, maxWidth: '94vw', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--brand)' }} />
            <span className="display" style={{ fontSize: 16, fontWeight: 600 }}>PasarEx<span style={{ color: 'var(--brand-600)' }}>LM</span></span>
          </div>
          <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} className="mono" style={{ border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>{lang.toUpperCase()}</button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--brand-tint)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 28 }}>★</div>
            <h1 className="display" style={{ fontSize: 22, margin: '0 0 6px' }}>{t('¡Gracias!', 'Thank you!')}</h1>
            <p style={{ color: 'var(--ink-500)', fontSize: 14, margin: 0 }}>{t('Tu calificación ayuda a mejorar el servicio.', 'Your rating helps improve the service.')}</p>
          </div>
        ) : (<>
          <span className="eyebrow">{t('Califica tu entrega', 'Rate your delivery')}</span>
          <h1 className="display" style={{ fontSize: 23, margin: '8px 0 18px' }}>{t('¿Cómo estuvo tu conductor?', 'How was your driver?')}</h1>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setStars(n)}
                style={{ border: 'none', background: 'transparent', fontSize: 38, lineHeight: 1, cursor: 'pointer', color: (hover || stars) >= n ? 'var(--amber)' : 'var(--line)' }}>★</button>
            ))}
          </div>
          <textarea className="textarea" rows={3} placeholder={t('Comentario (opcional)', 'Comment (optional)')} value={feedback} onChange={(e) => setFeedback(e.target.value)} style={{ marginBottom: 14 }} />
          {err && <div className="badge badge-red" style={{ marginBottom: 12 }}>{err}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={!stars || busy} onClick={submit}>{busy ? '…' : t('Enviar calificación', 'Submit rating')}</button>
        </>)}
      </div>
    </div>
  );
}
