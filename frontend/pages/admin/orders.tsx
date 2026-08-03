import { useEffect, useState } from 'react'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shipState, setShipState] = useState<Record<string, { carrier: string; tracking: string }>>({})

  const load = () => {
    setLoading(true)
    setError(null)
    const url = status ? `${API_BASE}/api/admin/orders?status=${encodeURIComponent(status)}` : `${API_BASE}/api/admin/orders`
    fetch(url)
      .then((r) => r.json())
      .then((data) => setOrders(data.orders || []))
      .catch(() => setError('load_failed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status])

  const shipOrder = async (orderId: string) => {
    const form = shipState[orderId] || { carrier: '', tracking: '' }
    const r = await fetch(`${API_BASE}/api/admin/orders/${orderId}/ship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrier: form.carrier, tracking_no: form.tracking })
    })
    const data = await r.json()
    if (!r.ok) {
      setError(data.error || 'ship_failed')
      return
    }
    load()
  }

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin - Orders & Shipping</h1>
      <div className="mb-4 flex gap-3">
        <Link href="/"><a className="px-3 py-1 bg-gray-700 text-white rounded">Home</a></Link>
        <Link href="/admin/refunds"><a className="px-3 py-1 bg-slate-700 text-white rounded">Refund Review</a></Link>
      </div>

      <div className="mb-4">
        <label className="mr-2">Status:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1">
          <option value="">All</option>
          <option value="created">created</option>
          <option value="paid">paid</option>
          <option value="shipped">shipped</option>
          <option value="cancelled">cancelled</option>
          <option value="refunded">refunded</option>
        </select>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600 mb-3">Error: {error}</div>}

      {!loading && (
        <div className="space-y-3">
          {orders.map((o) => {
            const form = shipState[o.id] || { carrier: '', tracking: '' }
            return (
              <div key={o.id} className="border rounded p-4">
                <div className="font-medium">{o.id}</div>
                <div className="text-sm text-gray-600 mb-2">status: {o.status} | total: ¥{((o.total_cents || 0) / 100).toFixed(2)}</div>
                {o.status === 'paid' && (
                  <div className="flex gap-2 items-center">
                    <input
                      value={form.carrier}
                      onChange={(e) => setShipState((s) => ({ ...s, [o.id]: { ...form, carrier: e.target.value } }))}
                      placeholder="carrier"
                      className="border rounded px-2 py-1"
                    />
                    <input
                      value={form.tracking}
                      onChange={(e) => setShipState((s) => ({ ...s, [o.id]: { ...form, tracking: e.target.value } }))}
                      placeholder="tracking no."
                      className="border rounded px-2 py-1"
                    />
                    <button onClick={() => shipOrder(o.id)} className="px-3 py-1 bg-blue-600 text-white rounded">Ship</button>
                  </div>
                )}
              </div>
            )
          })}
          {orders.length === 0 && <div>No orders.</div>}
        </div>
      )}
    </main>
  )
}
