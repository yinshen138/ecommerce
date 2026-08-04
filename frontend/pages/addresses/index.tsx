import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({ full_name: '', phone: '', line1: '', city: '', state: '', postal_code: '', country: 'CN', is_default: false })

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const s = await supabase.auth.getSession()
        const token = s.data.session?.access_token
        if (!token) return
        const r = await fetch(`${API_BASE}/api/addresses`, { headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok) return
        const data = await r.json()
        if (mounted) setAddresses(data.addresses || [])
      } catch (err) {
        console.warn('load addresses err', err)
      } finally { if (mounted) setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [])

  const startCreate = () => { setEditing(null); setForm({ full_name: '', phone: '', line1: '', city: '', state: '', postal_code: '', country: 'CN', is_default: false }) }
  const startEdit = (a:any) => { setEditing(a); setForm(a) }

  const save = async () => {
    setSaving(true)
    try {
      const s = await supabase.auth.getSession()
      const token = s.data.session?.access_token
      if (!token) throw new Error('not_authenticated')
      const method = editing ? 'PATCH' : 'POST'
      const url = editing ? `${API_BASE}/api/addresses/${editing.id}` : `${API_BASE}/api/addresses`
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) })
      if (!r.ok) throw new Error('save_failed')
      await r.json()
      // reload
      const list = await fetch(`${API_BASE}/api/addresses`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await list.json()
      setAddresses(data.addresses || [])
      setEditing(null)
    } catch (err) {
      alert('Save failed: ' + (err as any).message)
    } finally { setSaving(false) }
  }

  const remove = async (id:string) => {
    if (!confirm('Delete address?')) return
    try {
      const s = await supabase.auth.getSession()
      const token = s.data.session?.access_token
      if (!token) throw new Error('not_authenticated')
      const r = await fetch(`${API_BASE}/api/addresses/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) throw new Error('delete_failed')
      setAddresses(addresses.filter(a => a.id !== id))
    } catch (err) {
      alert('Delete failed')
    }
  }

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Manage Addresses</h1>
      <div className="mb-4"><Link href="/checkout"><a className="px-3 py-1 bg-gray-200 rounded">Back to checkout</a></Link></div>
      {loading && <div>Loading...</div>}
      {!loading && (
        <>
          <div className="mb-4">
            <button onClick={startCreate} className="px-3 py-1 bg-green-600 text-white rounded">Add address</button>
          </div>
          <div className="space-y-2 mb-6">
            {addresses.map(a => (
              <div key={a.id} className="border p-3 rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{a.full_name || 'Unnamed'}</div>
                    <div className="text-sm">{a.line1}, {a.city} {a.postal_code}</div>
                    <div className="text-sm">{a.phone}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => startEdit(a)} className="px-2 py-1 bg-blue-600 text-white rounded">Edit</button>
                    <button onClick={() => remove(a.id)} className="px-2 py-1 bg-red-600 text-white rounded">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border p-4 rounded">
            <h2 className="font-medium mb-2">{editing ? 'Edit address' : 'Add address'}</h2>
            <div className="grid grid-cols-1 gap-2">
              <input placeholder="Full name" value={form.full_name} onChange={(e)=>setForm({...form, full_name: e.target.value})} className="border rounded px-2 py-2" />
              <input placeholder="Phone" value={form.phone} onChange={(e)=>setForm({...form, phone: e.target.value})} className="border rounded px-2 py-2" />
              <input placeholder="Street / Line1" value={form.line1} onChange={(e)=>setForm({...form, line1: e.target.value})} className="border rounded px-2 py-2" />
              <input placeholder="City" value={form.city} onChange={(e)=>setForm({...form, city: e.target.value})} className="border rounded px-2 py-2" />
              <input placeholder="State" value={form.state} onChange={(e)=>setForm({...form, state: e.target.value})} className="border rounded px-2 py-2" />
              <input placeholder="Postal code" value={form.postal_code} onChange={(e)=>setForm({...form, postal_code: e.target.value})} className="border rounded px-2 py-2" />
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_default} onChange={(e)=>setForm({...form, is_default: e.target.checked})} /> Set as default</label>
              <div className="flex gap-2">
                <button onClick={save} disabled={saving} className="px-3 py-1 bg-indigo-600 text-white rounded">Save</button>
                <button onClick={()=>{ setEditing(null); setForm({ full_name: '', phone: '', line1: '', city: '', state: '', postal_code: '', country: 'CN', is_default: false }) }} className="px-3 py-1 bg-gray-300 rounded">Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
