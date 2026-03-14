'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Report = {
  id: string; title: string; type: string; severity: string
  status: string; upvotes: number; created_at: string; latitude: number; longitude: number
}

const SEV_COLOR: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}
const ISSUE_ICONS: Record<string, string> = {
  pothole: '🕳️', road_damage: '🚧', streetlight: '💡',
  flooding: '🌊', garbage: '🗑️', other: '📍',
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'resolved'>('all')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      const { data } = await supabase
        .from('reports').select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      if (data) setReports(data)
      setLoading(false)
    }
    load()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleResolve = async (id: string) => {
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', id)
    setReports(p => p.map(r => r.id === id ? { ...r, status: 'resolved' } : r))
  }

  const handleDelete = async (id: string) => {
    await supabase.from('reports').delete().eq('id', id)
    setReports(p => p.filter(r => r.id !== id))
  }

  const totalUpvotes = reports.reduce((sum, r) => sum + (r.upvotes || 0), 0)
  const openCount = reports.filter(r => r.status === 'open').length
  const resolvedCount = reports.filter(r => r.status === 'resolved').length
  const criticalCount = reports.filter(r => r.severity === 'critical' || r.severity === 'high').length

  const filtered = reports.filter(r =>
    activeTab === 'all' ? true :
    activeTab === 'open' ? r.status === 'open' : r.status === 'resolved'
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
        <div style={{ color: '#64748b', fontWeight: 600 }}>Loading profile...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── TOP NAV ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '14px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/map')} style={{
            background: '#f1f5f9', border: 'none', borderRadius: 10,
            padding: '7px 14px', cursor: 'pointer', fontSize: 13,
            fontWeight: 700, color: '#475569', fontFamily: 'inherit',
          }}>← Map</button>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>My Profile</span>
        </div>
        <button onClick={handleSignOut} style={{
          background: '#fef2f2', border: 'none', borderRadius: 10,
          padding: '7px 14px', cursor: 'pointer', fontSize: 13,
          fontWeight: 700, color: '#ef4444', fontFamily: 'inherit',
        }}>Sign Out</button>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── PROFILE CARD ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1a6fe8, #0ea5e9)',
          borderRadius: 20, padding: '28px 24px', marginBottom: 16,
          color: '#fff', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -30, right: 40, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 800, border: '2px solid rgba(255,255,255,0.4)',
            }}>
              {user?.email?.[0]?.toUpperCase() || '👤'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{user?.email}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>CivicSolve Member · {reports.length} reports submitted</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Total', value: reports.length, icon: '📋' },
              { label: 'Open', value: openCount, icon: '🔴' },
              { label: 'Resolved', value: resolvedCount, icon: '✅' },
              { label: 'Upvotes', value: totalUpvotes, icon: '👍' },
            ].map((s) => (
              <div key={s.label} style={{
                flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 12,
                padding: '10px 8px', textAlign: 'center', backdropFilter: 'blur(4px)',
              }}>
                <div style={{ fontSize: 16 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{s.value}</div>
                <div style={{ fontSize: 10, opacity: 0.8, marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── IMPACT CARD ── */}
        {criticalCount > 0 && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '16px 20px', marginBottom: 16,
            border: '1.5px solid #fde68a', display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <span style={{ fontSize: 28 }}>🏆</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Community Impact</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                You reported {criticalCount} high/critical issue{criticalCount > 1 ? 's' : ''} — helping keep Hyderabad safe!
              </div>
            </div>
          </div>
        )}

        {/* ── TABS ── */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 6,
          display: 'flex', gap: 4, marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {(['all', 'open', 'resolved'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '9px 4px', borderRadius: 12, border: 'none',
              background: activeTab === tab ? '#1a6fe8' : 'transparent',
              color: activeTab === tab ? '#fff' : '#64748b',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {tab === 'all' ? `All (${reports.length})` :
               tab === 'open' ? `Open (${openCount})` : `Resolved (${resolvedCount})`}
            </button>
          ))}
        </div>

        {/* ── REPORTS LIST ── */}
        {filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: '48px 24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>No issues here</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Click the map to report your first issue!</div>
            <button onClick={() => router.push('/map')} style={{
              marginTop: 16, background: '#1a6fe8', border: 'none', borderRadius: 10,
              color: '#fff', padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            }}>Go to Map</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((r) => (
              <div key={r.id} style={{
                background: '#fff', borderRadius: 16, padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                borderLeft: `4px solid ${SEV_COLOR[r.severity] || '#94a3b8'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{ISSUE_ICONS[r.type] || '📍'}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{r.title}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ background: `${SEV_COLOR[r.severity]}18`, color: SEV_COLOR[r.severity], borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{r.severity}</span>
                      <span style={{ background: r.status === 'open' ? '#fef9c3' : '#f0fdf4', color: r.status === 'open' ? '#ca8a04' : '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{r.status}</span>
                      <span style={{ color: '#94a3b8', fontSize: 11, padding: '2px 0' }}>
                        👍 {r.upvotes} · {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                    {r.status === 'open' && (
                      <button onClick={() => handleResolve(r.id)} style={{
                        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                        padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: '#16a34a', fontWeight: 700, fontFamily: 'inherit',
                      }}>✅ Resolve</button>
                    )}
                    <button onClick={() => handleDelete(r.id)} style={{
                      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                      padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: '#ef4444', fontWeight: 700, fontFamily: 'inherit',
                    }}>🗑️ Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}