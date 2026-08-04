import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const s = await supabase.auth.getSession()
        const session = s.data.session
        if (!session) {
          // not signed in
          window.location.href = '/login'
          return
        }
        const u = session.user
        if (mounted) setUser(u)

        // load membership
        const token = session.access_token
        const r = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001') + '/api/members', { headers: { Authorization: `Bearer ${token}` } })
        if (r.ok) {
          const d = await r.json()
          if (mounted) setMember(d.member)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const upgrade = async () => {
    const lvl = prompt('Enter membership level to upgrade to (e.g. silver, gold)')
    if (!lvl) return
    const s = await supabase.auth.getSession()
    const token = s.data.session?.access_token
    const r = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001') + '/api/members/upgrade', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ level: lvl }) })
    if (r.ok) {
      const d = await r.json()
      setMember(d.member)
      alert('Upgraded')
    } else {
      alert('Upgrade failed')
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!user) return <div className="p-8">Not signed in. <Link href="/login"><a className="text-blue-600">Sign in</a></Link></div>

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      <div className="mb-4">
        <div><strong>ID:</strong> {user.id}</div>
        <div><strong>Email:</strong> {user.email}</div>
      </div>

      <div className="mb-4 border p-4 rounded">
        <h2 className="font-medium mb-2">Membership</h2>
        {member ? (
          <div>
            <div>Level: <strong>{member.level}</strong></div>
            <div>Points: <strong>{member.points ?? 0}</strong></div>
            <button onClick={upgrade} className="mt-2 px-3 py-1 bg-green-600 text-white rounded">Upgrade</button>
          </div>
        ) : (
          <div>Not a member</div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={signOut} className="px-3 py-1 bg-red-600 text-white rounded">Sign out</button>
        <Link href="/"><a className="px-3 py-1 bg-gray-200 rounded">Home</a></Link>
      </div>
    </main>
  )
}
