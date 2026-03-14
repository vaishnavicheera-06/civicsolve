'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="loading-screen">
      <span className="icon">🗺️</span>
      <span className="title">Loading CivicSolve...</span>
      <span className="sub">Fetching community reports</span>
    </div>
  ),
})

export default function MapPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
      else setChecking(false)
    })
  }, [router])

  if (checking) return (
    <div className="loading-screen">
      <span className="icon">🔐</span>
      <span className="title">Checking authentication...</span>
    </div>
  )

  return <MapView />
}
