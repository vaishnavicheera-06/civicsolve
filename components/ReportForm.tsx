'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type SeverityType = 'low' | 'medium' | 'high' | 'critical'
type IssueType = 'pothole' | 'road_damage' | 'streetlight' | 'flooding' | 'garbage' | 'other'

type ReportFormProps = {
  lat: number
  lng: number
  onClose: () => void
  onSubmitted: () => void
}

const SEV_COLOR: Record<SeverityType, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}
const SEV_BG: Record<SeverityType, string> = {
  low: '#f0fdf4', medium: '#fffbeb', high: '#fef2f2', critical: '#f5f3ff',
}
const ISSUE_ICONS: Record<IssueType, string> = {
  pothole: '🕳️', road_damage: '🚧', streetlight: '💡',
  flooding: '🌊', garbage: '🗑️', other: '📍',
}

// ✅ Smart rule-based AI classifier — no API key needed
function classifyIssue(title: string, desc: string): { type: IssueType; severity: SeverityType; reason: string } {
  const text = (title + ' ' + desc).toLowerCase()

  let type: IssueType = 'other'
  let severity: SeverityType = 'medium'
  let reason = ''

  // Detect type
  if (text.includes('pothole') || text.includes('hole') || text.includes('crater')) {
    type = 'pothole'
  } else if (text.includes('road') || text.includes('crack') || text.includes('damage') || text.includes('broken')) {
    type = 'road_damage'
  } else if (text.includes('light') || text.includes('lamp') || text.includes('dark') || text.includes('streetlight')) {
    type = 'streetlight'
  } else if (text.includes('flood') || text.includes('water') || text.includes('drain') || text.includes('waterlog')) {
    type = 'flooding'
  } else if (text.includes('garbage') || text.includes('trash') || text.includes('waste') || text.includes('dump')) {
    type = 'garbage'
  }

  // Detect severity
  if (text.includes('critical') || text.includes('dangerous') || text.includes('accident') || text.includes('emergency') || text.includes('severe')) {
    severity = 'critical'
    reason = 'Critical safety hazard detected'
  } else if (text.includes('large') || text.includes('big') || text.includes('deep') || text.includes('major') || text.includes('blocking') || text.includes('block')) {
    severity = 'high'
    reason = 'Major issue that needs urgent attention'
  } else if (text.includes('small') || text.includes('minor') || text.includes('little') || text.includes('tiny')) {
    severity = 'low'
    reason = 'Minor issue, low priority'
  } else {
    severity = 'medium'
    reason = 'Moderate issue requiring attention'
  }

  if (!reason) reason = `Detected as ${type.replace('_', ' ')} with ${severity} severity`

  return { type, severity, reason }
}

export default function ReportForm({ lat, lng, onClose, onSubmitted }: ReportFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<IssueType>('pothole')
  const [severity, setSeverity] = useState<SeverityType>('medium')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  // ✅ AI Classify — works instantly, no API needed
  const handleAIClassify = async () => {
    if (!title.trim() && !description.trim()) {
      setAiSuggestion('⚠️ Please enter a title or description first')
      return
    }
    setAiLoading(true)
    setAiSuggestion('')
    await new Promise(r => setTimeout(r, 700))
    const result = classifyIssue(title, description)
    setType(result.type)
    setSeverity(result.severity)
    setAiSuggestion(`🤖 AI: ${result.reason}`)
    setAiLoading(false)
  }

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) { setError('Please enter a title'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('You must be logged in'); setLoading(false); return }

      let imageUrl: string | null = null
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('report-images')
          .upload(`reports/${Date.now()}.${fileExt}`, imageFile)
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('report-images').getPublicUrl(uploadData.path)
          imageUrl = urlData.publicUrl
        }
      }

      const { error: insertError } = await supabase.from('reports').insert({
        user_id: user.id, title: title.trim(), description: description.trim(),
        type, severity, status: 'open', latitude: lat, longitude: lng,
        image_url: imageUrl, upvotes: 0,
      })

      if (insertError) setError(insertError.message)
      else { setSuccess(true); setTimeout(() => { onSubmitted(); onClose() }, 1200) }
    } catch { setError('Something went wrong. Try again.') }
    setLoading(false)
  }

  // ✅ Success screen
  if (success) return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Issue Reported!</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Saved to map successfully</div>
      </div>
    </div>
  )

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 16, fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: '#fff',
          borderRadius: '20px 20px 0 0', zIndex: 1,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30,
                background: 'linear-gradient(135deg,#1a6fe8,#0ea5e9)',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>📋</div>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Report an Issue</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, marginLeft: 38 }}>
              📍 {lat.toFixed(4)}, {lng.toFixed(4)}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: '#f8fafc', cursor: 'pointer', fontSize: 16, color: '#64748b',
          }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {/* ── Title ── */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Issue Title *
            </label>
            <input
              type="text" value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Large pothole blocking traffic"
              maxLength={100}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit', color: '#0f172a', background: '#fafafa',
              }}
              onFocus={(e) => e.target.style.borderColor = '#1a6fe8'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          {/* ── Description + AI ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Description
              </label>
              <button
                onClick={handleAIClassify}
                disabled={aiLoading}
                style={{
                  background: aiLoading ? '#e2e8f0' : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                  border: 'none', borderRadius: 8,
                  color: aiLoading ? '#94a3b8' : '#fff',
                  padding: '6px 14px', cursor: aiLoading ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                {aiLoading ? '⏳ Analyzing...' : '✨ AI Classify'}
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Type the issue here... then click ✨ AI Classify to auto-detect type & severity"
              rows={3} maxLength={500}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit', color: '#0f172a',
                resize: 'vertical', minHeight: 80, background: '#fafafa',
              }}
              onFocus={(e) => e.target.style.borderColor = '#1a6fe8'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {aiSuggestion
                ? <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>{aiSuggestion}</span>
                : <span style={{ fontSize: 11, color: '#94a3b8' }}>Type title/description → click ✨ AI Classify</span>
              }
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{description.length}/500</span>
            </div>
          </div>

          {/* ── Issue Type ── */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Issue Type
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {(Object.keys(ISSUE_ICONS) as IssueType[]).map((t) => (
                <button key={t} onClick={() => setType(t)} style={{
                  padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  border: type === t ? '2px solid #1a6fe8' : '2px solid #e2e8f0',
                  background: type === t ? '#eff6ff' : '#fff',
                  color: type === t ? '#1a6fe8' : '#64748b',
                }}>
                  {ISSUE_ICONS[t]} {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* ── Severity ── */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Severity
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['low', 'medium', 'high', 'critical'] as SeverityType[]).map((s) => (
                <button key={s} onClick={() => setSeverity(s)} style={{
                  flex: 1, padding: '10px 4px', borderRadius: 12,
                  cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  fontFamily: 'inherit', textAlign: 'center',
                  border: severity === s ? `2px solid ${SEV_COLOR[s]}` : '2px solid #e2e8f0',
                  background: severity === s ? SEV_BG[s] : '#fff',
                  color: severity === s ? SEV_COLOR[s] : '#94a3b8',
                }}>
                  {/* ✅ Hardcoded colored dots — guaranteed to show */}
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', margin: '0 auto 5px',
                    backgroundColor:
                      s === 'low' ? '#22c55e' :
                      s === 'medium' ? '#f59e0b' :
                      s === 'high' ? '#ef4444' : '#7c3aed',
                  }} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Image Upload ── */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Photo (optional)
            </label>
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              border: `2px dashed ${imagePreview ? '#1a6fe8' : '#cbd5e1'}`,
              borderRadius: 12, padding: imagePreview ? 8 : '20px',
              cursor: 'pointer', background: imagePreview ? '#f0f9ff' : '#fafafa',
            }}>
              {imagePreview
                ? <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: 8, maxHeight: 140, objectFit: 'cover' }} />
                : <><span style={{ fontSize: 28 }}>📷</span><span style={{ fontSize: 13, color: '#94a3b8' }}>Click to upload photo</span></>
              }
              <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
            </label>
          </div>

          {/* ── Submit ── */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '14px 0',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg,#1a6fe8,#0ea5e9)',
              border: 'none', borderRadius: 12, color: '#fff',
              fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(26,111,232,0.4)',
              fontFamily: 'inherit',
            }}
          >
            {loading ? '⏳ Saving...' : '🚨 Submit Issue'}
          </button>

        </div>
      </div>
    </div>
  )
}
