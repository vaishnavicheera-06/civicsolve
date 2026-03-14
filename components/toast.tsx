'use client'
 
import { useEffect, useState } from 'react'
 
export type ToastType = {
  id: string
  message: string
  type: 'success' | 'warning' | 'info'
}
 
export function ToastContainer({ toasts, onRemove }: { toasts: ToastType[]; onRemove: (id: string) => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      maxWidth: 320, pointerEvents: 'none',
    }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}
 
function ToastItem({ toast, onRemove }: { toast: ToastType; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
 
  useEffect(() => {
    setTimeout(() => setVisible(true), 10)
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 300)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])
 
  const colors = {
    success: { bg: '#f0fdf4', border: '#86efac', icon: '✅', text: '#166534' },
    warning: { bg: '#fffbeb', border: '#fde68a', icon: '⚠️', text: '#92400e' },
    info:    { bg: '#eff6ff', border: '#93c5fd', icon: 'ℹ️', text: '#1e40af' },
  }
  const c = colors[toast.type]
 
  return (
    <div style={{
      background: c.bg, border: `1.5px solid ${c.border}`,
      borderRadius: 14, padding: '12px 16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      pointerEvents: 'auto', cursor: 'pointer',
      transform: visible ? 'translateX(0)' : 'translateX(120%)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
    }} onClick={() => onRemove(toast.id)}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{c.icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: c.text, lineHeight: 1.4 }}>
        {toast.message}
      </span>
    </div>
  )
}
 