import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await supabase.auth.signUp({ email, password })
      if (res.error) throw res.error
      alert('Registration started. Check your email for confirmation if required.')
      window.location.href = '/login'
    } catch (err: any) {
      setError(err.message || JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      <form onSubmit={signUp} className="space-y-3">
        <div>
          <label className="block mb-1">Email</label>
          <input className="border rounded px-3 py-2 w-full" value={email} onChange={(e)=>setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block mb-1">Password</label>
          <input type="password" className="border rounded px-3 py-2 w-full" value={password} onChange={(e)=>setPassword(e.target.value)} />
        </div>
        {error && <div className="text-red-600">{error}</div>}
        <div className="flex gap-3">
          <button disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded">{loading ? 'Registering...' : 'Register'}</button>
          <Link href="/login"><a className="px-4 py-2 bg-gray-200 rounded">Sign In</a></Link>
        </div>
      </form>
    </main>
  )
}
