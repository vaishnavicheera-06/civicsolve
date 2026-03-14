'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabaseClient'
import ReportForm from './ReportForm'
import { ToastContainer, ToastType } from './Toast'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const SEV_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}

const mkPin = (severity: string) => {
  const color = SEV_COLORS[severity] || '#ef4444'
  const isPulse = severity === 'high' || severity === 'critical'
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:25px;height:41px;">
        ${isPulse ? `<div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:25px;height:25px;border-radius:50%;background:${color};opacity:0.2;animation:ripple 1.6s ease-out infinite;"></div>` : ''}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41">
          <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.325 12.5 28.5 12.5 28.5S25 20.825 25 12.5C25 5.596 19.404 0 12.5 0z" fill="${color}" stroke="white" stroke-width="2"/>
          <circle cx="12.5" cy="12.5" r="5" fill="white" opacity="0.9"/>
        </svg>
      </div>`,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  })
}

const startIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:25px;height:41px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41"><path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.325 12.5 28.5 12.5 28.5S25 20.825 25 12.5C25 5.596 19.404 0 12.5 0z" fill="#1a6fe8" stroke="white" stroke-width="2"/><text x="12.5" y="17" text-anchor="middle" font-size="11" font-weight="800" fill="white" font-family="sans-serif">A</text></svg></div>`,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

const endIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:25px;height:41px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41"><path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.325 12.5 28.5 12.5 28.5S25 20.825 25 12.5C25 5.596 19.404 0 12.5 0z" fill="#ef4444" stroke="white" stroke-width="2"/><text x="12.5" y="17" text-anchor="middle" font-size="11" font-weight="800" fill="white" font-family="sans-serif">B</text></svg></div>`,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

type Report = {
  id: string; title: string; description: string; type: string
  severity: string; status: string; latitude: number; longitude: number
  image_url: string | null; upvotes: number; created_at: string
}

function distMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

export default function MapView() {
  const [reports, setReports] = useState<Report[]>([])
  const [showForm, setShowForm] = useState(false)
  const [clickedPos, setClickedPos] = useState<{ lat: number; lng: number } | null>(null)
  const [routeStart, setRouteStart] = useState<[number, number] | null>(null)
  const [routeEnd, setRouteEnd] = useState<[number, number] | null>(null)
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([])
  const [routeMode, setRouteMode] = useState<'none' | 'pickStart' | 'pickEnd'>('none')
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; warnings: string[] } | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [showDangerZones, setShowDangerZones] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bottomSheet, setBottomSheet] = useState(false) // mobile bottom sheet
  const [toasts, setToasts] = useState<ToastType[]>([])
  const router = useRouter()

  const addToast = useCallback((message: string, type: ToastType['type'] = 'info') => {
    const id = Date.now().toString()
    setToasts(p => [...p, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(p => p.filter(t => t.id !== id))
  }, [])

  const fetchReports = useCallback(async () => {
    const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false })
    if (!error && data) setReports(data)
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  useEffect(() => {
    const channel = supabase.channel('reports-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
        if (payload.eventType === 'INSERT') setReports((p) => [payload.new as Report, ...p])
        if (payload.eventType === 'UPDATE') setReports((p) => p.map((r) => r.id === (payload.new as Report).id ? payload.new as Report : r))
        if (payload.eventType === 'DELETE') setReports((p) => p.filter((r) => r.id !== (payload.old as any).id))
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleMapClick = (lat: number, lng: number) => {
    if (routeMode === 'pickStart') { setRouteStart([lat, lng]); setRouteMode('pickEnd'); return }
    if (routeMode === 'pickEnd') { setRouteEnd([lat, lng]); setRouteMode('none'); return }
    setClickedPos({ lat, lng })
    setShowForm(true)
  }

  const getRoute = useCallback(async (start: [number, number], end: [number, number]) => {
    setRouteLoading(true); setRouteCoords([]); setRouteInfo(null)
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`)
      const data = await res.json()
      if (data.routes?.length > 0) {
        const route = data.routes[0]
        const coords: [number, number][] = route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng])
        setRouteCoords(coords)
        const dangerReports = reports.filter(r => ['high', 'critical'].includes(r.severity) && r.status === 'open')
        const warnings: string[] = []
        dangerReports.forEach(r => {
          const closest = Math.min(...coords.map(([lat, lng]) => distMeters(lat, lng, r.latitude, r.longitude)))
          if (closest < 200) warnings.push(`"${r.title}" (${r.severity})`)
        })
        setRouteInfo({ distance: `${(route.distance / 1000).toFixed(1)} km`, duration: `${Math.round(route.duration / 60)} min`, warnings })
      }
    } catch (err) { console.error('Routing error:', err) }
    setRouteLoading(false)
  }, [reports])

  useEffect(() => { if (routeStart && routeEnd) getRoute(routeStart, routeEnd) }, [routeStart, routeEnd, getRoute])

  const clearRoute = () => {
    setRouteStart(null); setRouteEnd(null); setRouteCoords([]); setRouteInfo(null); setRouteMode('none')
  }

  const handleUpvote = async (id: string, current: number) => {
    await supabase.from('reports').update({ upvotes: current + 1 }).eq('id', id)
  }
  const handleResolve = async (id: string) => {
    const report = reports.find(r => r.id === id)
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', id)
    if (report) addToast(`✅ Resolved: "${report.title}"`, 'success')
  }

  const dangerZones = reports.filter(r => ['high', 'critical'].includes(r.severity) && r.status === 'open')
  const filteredReports = filterSeverity === 'all' ? reports : reports.filter(r => r.severity === filterSeverity)
  const openCount = reports.filter(r => r.status === 'open').length

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes ripple { 0%{transform:translateX(-50%) scale(1);opacity:0.3} 100%{transform:translateX(-50%) scale(3.5);opacity:0} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes slideIn { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }

        /* ── MOBILE STYLES ── */
        @media (max-width: 640px) {
          .toolbar { top: 8px !important; gap: 6px !important; }
          .brand-pill { padding: 7px 12px !important; font-size: 13px !important; }
          .route-pill { padding: 7px 10px !important; }
          .legend-panel { display: none !important; }
          .bottom-hint { display: none !important; }
          .desktop-sidebar { display: none !important; }
        }
        @media (min-width: 641px) {
          .mobile-bottom-bar { display: none !important; }
          .mobile-sheet { display: none !important; }
        }
      `}</style>

      {/* ── TOP TOOLBAR ── */}
      <div className="toolbar" style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, display: 'flex', gap: 8, alignItems: 'center',
        flexWrap: 'wrap', justifyContent: 'center', width: '95%', maxWidth: 700,
      }}>
        {/* Brand */}
        <div className="brand-pill" style={{
          background: '#fff', borderRadius: 14, padding: '9px 18px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>🗺️</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>CivicSolve</span>
          <span style={{ background: '#eff6ff', color: '#1a6fe8', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            {openCount} open
          </span>
          {dangerZones.length > 0 && (
            <span style={{ background: '#fef2f2', color: '#ef4444', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
              🚨 {dangerZones.length}
            </span>
          )}
          <button onClick={() => router.push('/profile')} style={{
            background: '#f1f5f9', border: 'none', borderRadius: 8,
            padding: '4px 10px', cursor: 'pointer', fontSize: 12,
            fontWeight: 700, color: '#475569', fontFamily: 'inherit',
          }}>👤 Profile</button>
        </div>

        {/* Route */}
        <div className="route-pill" style={{
          background: '#fff', borderRadius: 14, padding: '9px 14px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          {routeMode === 'none' && !routeStart && (
            <button onClick={() => setRouteMode('pickStart')} style={{
              background: 'linear-gradient(135deg,#1a6fe8,#0ea5e9)', border: 'none',
              borderRadius: 10, color: '#fff', padding: '6px 14px',
              cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            }}>🛣️ Safe Route</button>
          )}
          {routeMode === 'pickStart' && <span style={{ color: '#1a6fe8', fontWeight: 700, fontSize: 13 }}>🔵 Tap START (A)</span>}
          {routeMode === 'pickEnd'   && <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>🔴 Tap END (B)</span>}
          {routeLoading && <span style={{ fontSize: 12, color: '#94a3b8' }}>⏳ Routing...</span>}
          {routeInfo && !routeLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>📏 {routeInfo.distance}</span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>⏱ {routeInfo.duration}</span>
              {routeInfo.warnings.length > 0 && (
                <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  ⚠️ {routeInfo.warnings.length}
                </span>
              )}
            </div>
          )}
          {(routeStart || routeCoords.length > 0) && (
            <button onClick={clearRoute} style={{
              background: '#fef2f2', border: 'none', borderRadius: 8,
              color: '#ef4444', padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            }}>✕</button>
          )}
        </div>
      </div>

      {/* ── DESKTOP: Legend + Controls ── */}
      <div className="legend-panel" style={{
        position: 'absolute', top: 76, right: 12, zIndex: 1000,
        background: '#fff', borderRadius: 16, padding: '14px 14px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', gap: 4, minWidth: 145,
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.8px', marginBottom: 4 }}>SEVERITY</div>
        {Object.entries(SEV_COLORS).map(([sev, color]) => (
          <button key={sev} onClick={() => setFilterSeverity(filterSeverity === sev ? 'all' : sev)} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px',
            borderRadius: 9, border: 'none', background: filterSeverity === sev ? `${color}15` : 'transparent',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="12" height="20" style={{ flexShrink: 0 }}>
              <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.325 12.5 28.5 12.5 28.5S25 20.825 25 12.5C25 5.596 19.404 0 12.5 0z" fill={filterSeverity === sev ? color : '#9ca3af'} stroke="white" strokeWidth="2"/>
              <circle cx="12.5" cy="12.5" r="5" fill="white" opacity="0.9"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: filterSeverity === sev ? 700 : 500, color: filterSeverity === sev ? color : '#475569' }}>
              {sev.charAt(0).toUpperCase() + sev.slice(1)}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              {reports.filter(r => r.severity === sev).length}
            </span>
          </button>
        ))}
        {filterSeverity !== 'all' && (
          <button onClick={() => setFilterSeverity('all')} style={{ fontSize: 11, color: '#94a3b8', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: '2px 8px' }}>← All</button>
        )}
        <div style={{ height: 1, background: '#f1f5f9', margin: '6px 0' }} />
        <button onClick={() => setShowDangerZones(!showDangerZones)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 9, border: 'none',
          background: showDangerZones ? '#fef2f2' : 'transparent', color: showDangerZones ? '#ef4444' : '#94a3b8',
          fontWeight: 600, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
        }}><span>{showDangerZones ? '🚨' : '⭕'}</span> Danger Zones</button>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 9, border: 'none',
          background: sidebarOpen ? '#eff6ff' : 'transparent', color: sidebarOpen ? '#1a6fe8' : '#64748b',
          fontWeight: 600, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
        }}><span>📋</span> {sidebarOpen ? 'Hide List' : 'Show List'}</button>
      </div>

      {/* ── DESKTOP: Bottom Hint ── */}
      <div className="bottom-hint" style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, background: 'rgba(15,23,42,0.78)', backdropFilter: 'blur(8px)',
        color: '#fff', borderRadius: 12, padding: '8px 20px',
        fontSize: 13, fontWeight: 500, pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        {routeMode === 'none' ? '🖱️ Click anywhere on map to report an issue'
          : routeMode === 'pickStart' ? '🔵 Click to set start point (A)'
          : '🔴 Click to set end point (B)'}
      </div>

      {/* ── DESKTOP: Sidebar ── */}
      {sidebarOpen && (
        <div className="desktop-sidebar" style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 300,
          background: '#fff', zIndex: 999,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column',
          animation: 'slideIn 0.22s ease',
        }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>All Issues</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{reports.length} total · {openCount} open</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'inherit' }}>✕</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {reports.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>No issues yet.
              </div>
            )}
            {reports.map((r) => (
              <div key={r.id} style={{ padding: '12px 18px', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="12" height="20" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.325 12.5 28.5 12.5 28.5S25 20.825 25 12.5C25 5.596 19.404 0 12.5 0z" fill={SEV_COLORS[r.severity] || '#94a3b8'} stroke="white" strokeWidth="2"/>
                    <circle cx="12.5" cy="12.5" r="5" fill="white" opacity="0.9"/>
                  </svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{r.title}</div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{r.type?.replace('_', ' ')}</span>
                      <span style={{ background: r.status === 'open' ? '#fef9c3' : '#f0fdf4', color: r.status === 'open' ? '#ca8a04' : '#16a34a', borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{r.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MOBILE: Bottom Bar ── */}
      <div className="mobile-bottom-bar" style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: '#fff', borderTop: '1px solid #f1f5f9',
        padding: '10px 16px 20px',
        display: 'flex', gap: 8, justifyContent: 'space-around',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
      }}>
        <button onClick={() => { setBottomSheet(!bottomSheet); setSidebarOpen(false) }} style={{
          flex: 1, padding: '10px 8px', borderRadius: 12, border: 'none',
          background: bottomSheet ? '#eff6ff' : '#f8fafc',
          color: bottomSheet ? '#1a6fe8' : '#475569',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }}>
          <span style={{ fontSize: 18 }}>📋</span>
          Issues ({reports.length})
        </button>

        <button onClick={() => {
          if (routeMode === 'none' && !routeStart) setRouteMode('pickStart')
          else clearRoute()
        }} style={{
          flex: 1, padding: '10px 8px', borderRadius: 12, border: 'none',
          background: routeMode !== 'none' || routeStart ? '#eff6ff' : '#f8fafc',
          color: routeMode !== 'none' || routeStart ? '#1a6fe8' : '#475569',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }}>
          <span style={{ fontSize: 18 }}>🛣️</span>
          {routeStart ? 'Clear Route' : 'Route'}
        </button>

        <button onClick={() => setShowDangerZones(!showDangerZones)} style={{
          flex: 1, padding: '10px 8px', borderRadius: 12, border: 'none',
          background: showDangerZones ? '#fef2f2' : '#f8fafc',
          color: showDangerZones ? '#ef4444' : '#475569',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          Zones {showDangerZones ? 'ON' : 'OFF'}
        </button>

        <button onClick={() => {
          setClickedPos({ lat: 17.3850, lng: 78.4867 })
          setShowForm(true)
        }} style={{
          flex: 1, padding: '10px 8px', borderRadius: 12, border: 'none',
          background: 'linear-gradient(135deg,#1a6fe8,#0ea5e9)',
          color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        }}>
          <span style={{ fontSize: 18 }}>➕</span>
          Report
        </button>
      </div>

      {/* ── MOBILE: Bottom Sheet (Issue List) ── */}
      {bottomSheet && (
        <div className="mobile-sheet" style={{
          position: 'absolute', bottom: 80, left: 0, right: 0, zIndex: 998,
          background: '#fff', borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
          maxHeight: '55vh', display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.25s ease',
        }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>All Issues · {reports.length}</div>
            <button onClick={() => setBottomSheet(false)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 13, color: '#64748b', fontFamily: 'inherit' }}>✕</button>
          </div>

          {/* Severity filter pills — mobile */}
          <div style={{ padding: '8px 14px', display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid #f1f5f9' }}>
            {['all', 'low', 'medium', 'high', 'critical'].map(s => (
              <button key={s} onClick={() => setFilterSeverity(s)} style={{
                padding: '4px 12px', borderRadius: 20, border: 'none', whiteSpace: 'nowrap',
                background: filterSeverity === s ? '#1a6fe8' : '#f1f5f9',
                color: filterSeverity === s ? '#fff' : '#475569',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredReports.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 24px', color: '#94a3b8', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>No issues found
              </div>
            )}
            {filteredReports.map((r) => (
              <div key={r.id} style={{ padding: '12px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="12" height="20" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 8.325 12.5 28.5 12.5 28.5S25 20.825 25 12.5C25 5.596 19.404 0 12.5 0z" fill={SEV_COLORS[r.severity] || '#94a3b8'} stroke="white" strokeWidth="2"/>
                  <circle cx="12.5" cy="12.5" r="5" fill="white" opacity="0.9"/>
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{r.title}</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{r.type?.replace('_', ' ')}</span>
                    <span style={{ background: r.status === 'open' ? '#fef9c3' : '#f0fdf4', color: r.status === 'open' ? '#ca8a04' : '#16a34a', borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>{r.status}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>👍 {r.upvotes}</span>
                  </div>
                  {r.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{r.description.slice(0, 60)}...</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HAZARD WARNING ── */}
      {routeInfo && routeInfo.warnings.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#fff', border: '1.5px solid #fde68a',
          borderRadius: 14, padding: '12px 18px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          maxWidth: 380, width: '90%',
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 6 }}>⚠️ Hazards near route:</div>
          {routeInfo.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: '#78350f', padding: '3px 0', borderTop: i > 0 ? '1px solid #fef3c7' : 'none' }}>• {w}</div>
          ))}
        </div>
      )}

      {/* ── MAP ── */}
      <MapContainer center={[17.3850, 78.4867]} zoom={13} style={{ width: '100%', height: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
        <ClickHandler onMapClick={handleMapClick} />

        {showDangerZones && dangerZones.map((r) => (
          <Circle key={`dz-${r.id}`} center={[r.latitude, r.longitude]}
            radius={r.severity === 'critical' ? 220 : 140}
            pathOptions={{ color: SEV_COLORS[r.severity], fillColor: SEV_COLORS[r.severity], fillOpacity: 0.1, weight: 2, dashArray: '8 5' }}
          />
        ))}

        {filteredReports.map((report) => (
          <Marker key={report.id} position={[report.latitude, report.longitude]} icon={mkPin(report.severity)}>
            <Popup maxWidth={260} minWidth={200}>
              <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: '4px 0' }}>
                {report.image_url && <img src={report.image_url} alt="issue" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 6 }}>{report.title}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{report.type?.replace('_', ' ')}</span>
                  <span style={{ background: `${SEV_COLORS[report.severity]}18`, color: SEV_COLORS[report.severity], borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{report.severity}</span>
                  <span style={{ background: report.status === 'open' ? '#fef9c3' : '#f0fdf4', color: report.status === 'open' ? '#ca8a04' : '#16a34a', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{report.status}</span>
                </div>
                {report.description && <p style={{ fontSize: 12, color: '#475569', margin: '0 0 8px', lineHeight: 1.5 }}>{report.description}</p>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleUpvote(report.id, report.upvotes)} style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: '#475569', fontFamily: 'inherit', fontWeight: 600 }}>👍 {report.upvotes}</button>
                  {report.status === 'open' && <button onClick={() => handleResolve(report.id)} style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 12, color: '#16a34a', fontFamily: 'inherit', fontWeight: 600 }}>✅ Resolve</button>}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {routeCoords.length > 0 && (
          <>
            <Polyline positions={routeCoords} color="#000" weight={7} opacity={0.06} />
            <Polyline positions={routeCoords} color="#1a6fe8" weight={4} opacity={0.9} />
            <Polyline positions={routeCoords} color="#fff" weight={1.5} opacity={0.4} dashArray="8 12" />
          </>
        )}
        {routeStart && <Marker position={routeStart} icon={startIcon} />}
        {routeEnd   && <Marker position={routeEnd}   icon={endIcon} />}
      </MapContainer>

      {showForm && clickedPos && (
        <ReportForm lat={clickedPos.lat} lng={clickedPos.lng}
          onClose={() => setShowForm(false)}
          onSubmitted={() => { fetchReports(); setShowForm(false); addToast('🚨 Issue reported successfully!', 'success') }} />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}