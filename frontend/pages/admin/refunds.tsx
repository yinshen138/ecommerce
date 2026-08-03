import { useEffect, useState } from 'react'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<any[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [orderId, setOrderId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const load = () => {
    setLoading(true)
    setError(null)
    const url = status ? `${API_BASE}/api/admin/refunds?status=${encodeURIComponent(status)}` : `${API_BASE}/api/admin/refunds`
    fetch(url)
      .then((r) => r.json())
      .then((data) => setRefunds(data.refunds || []))
      .catch(() => setError('load_failed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status])

  const requestRefund = async () => {
    if (!orderId) return
    const payload: any = { reason }
    if (amount) payload.amount_cents = Math.round(Number(amount) * 100)
    const r = await fetch(`${API_BASE}/api/orders/${orderId}/refunds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await r.json()
    if (!r.ok) {
      setError(data.error || 'request_failed')
      return
    }
    setOrderId('')
    setAmount('')
    setReason('')
    load()
  }

  const review = async (refundId: string, action: 'approve' | 'reject') => {
    const r = await fetch(`${API_BASE}/api/admin/refunds/${refundId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note: action === 'approve' ? 'approved by admin' : 'rejected by admin' })
    })
    const data = await r.json()
    if (!r.ok) {
      setError(data.error || 'review_failed')
      return
    }
    load()
  }

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin - Refund Review</h1>
      <div className="mb-4 flex gap-3">
        <Link href="/"><a className="px-3 py-1 bg-gray-700 text-white rounded">Home</a></Link>
        <Link href="/admin/orders"><a className="px-3 py-1 bg-slate-900 text-white rounded">Shipping</a></Link>
      </div>

      <div className="border rounded p-4 mb-6 space-y-2">
        <h2 className="font-semibold">Create refund request (for testing / after-sales entry)</h2>
        <div className="flex gap-2">
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="order id" className="border rounded px-2 py-1 flex-1" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="amount (CNY, optional)" className="border rounded px-2 py-1 w-56" />
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason" className="border rounded px-2 py-1 w-full" />
        <button onClick={requestRefund} className="px-3 py-1 bg-indigo-600 text-white rounded">Request refund</button>
      </div>

      <div className="mb-4">
        <label className="mr-2">Status:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1">
          <option value="">All</option>
          <option value="requested">requested</option>
          <option value="processed">processed</option>
          <option value="rejected">rejected</option>
        </select>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600 mb-3">Error: {error}</div>}
      {!loading && (
        <div className="space-y-3">
          {refunds.map((r) => (
            <div key={r.id} className="border rounded p-4">
              <div className="font-medium">{r.id}</div>
              <div className="text-sm text-gray-600 mb-2">
                order: {r.order_id} | refund status: {r.status} | order status: {r.order_status} | amount: ¥{((r.amount_cents || 0) / 100).toFixed(2)}
              </div>
              <div className="text-sm mb-2">reason: {r.reason || '-'}</div>
              {r.status === 'requested' && (
                <div className="flex gap-2">
                  <button onClick={() => review(r.id, 'approve')} className="px-3 py-1 bg-green-600 text-white rounded">Approve</button>
                  <button onClick={() => review(r.id, 'reject')} className="px-3 py-1 bg-red-600 text-white rounded">Reject</button>
                </div>
              )}
            </div>
          ))}
          {refunds.length === 0 && <div>No refunds.</div>}
        </div>
      )}
    </main>
  )
}
