import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

export default function OrderDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [order, setOrder] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gateway, setGateway] = useState<'alipay' | 'wechat'>('alipay')

  const load = () => {
    if (!id) return
    setLoading(true)
    fetch(`${API_BASE}/api/orders/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setOrder(data.order || null)
        setItems(data.items || [])
      })
      .catch(() => setError('fetch_failed'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [id])

  const cancelOrder = async () => {
    if (!id) return
    setError(null)
    const r = await fetch(`${API_BASE}/api/orders/${id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'user_cancelled' }) })
    const data = await r.json()
    if (!r.ok) {
      setError(data.error || 'cancel_failed')
      return
    }
    load()
  }

  const payNow = async () => {
    if (!id) return
    setError(null)
    const createRes = await fetch(`${API_BASE}/api/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: id, gateway })
    })
    const created = await createRes.json()
    if (!createRes.ok) {
      setError(created.error || 'payment_create_failed')
      return
    }
    const paymentId = created.payment_id || (created.payment && created.payment.id)
    if (!paymentId) {
      setError('missing_payment_id')
      return
    }
    const notifyRes = await fetch(`${API_BASE}/api/payments/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId, gateway_payment_id: `SBX-${Date.now()}`, success: true })
    })
    const notified = await notifyRes.json()
    if (!notifyRes.ok) {
      setError(notified.error || 'payment_notify_failed')
      return
    }
    load()
  }

  if (loading) return <div className="p-8">Loading order...</div>
  if (!order) return <div className="p-8">Order not found</div>

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Order Detail</h1>
      <div className="mb-4 flex gap-3">
        <Link href="/orders"><a className="px-3 py-1 bg-gray-700 text-white rounded">Back to Orders</a></Link>
        <Link href="/"><a className="px-3 py-1 bg-blue-700 text-white rounded">Home</a></Link>
      </div>

      <div className="border rounded p-4 mb-4 space-y-1">
        <div><strong>ID:</strong> {order.id}</div>
        <div><strong>Status:</strong> {order.status}</div>
        <div><strong>Total:</strong> ¥{((order.total_cents || 0) / 100).toFixed(2)}</div>
        <div><strong>Shipping:</strong> ¥{((order.shipping_cents || 0) / 100).toFixed(2)}</div>
        <div><strong>Discount:</strong> ¥{((order.discount_cents || 0) / 100).toFixed(2)}</div>
      </div>

      <h2 className="text-lg font-semibold mb-2">Items</h2>
      <ul className="space-y-2 mb-6">
        {items.map((it) => (
          <li key={it.id} className="border rounded p-3 flex justify-between">
            <span>{it.title || it.variant_id}</span>
            <span>x{it.qty}</span>
          </li>
        ))}
      </ul>

      {error && <div className="text-red-600 mb-4">Error: {error}</div>}

      {order.status === 'created' && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={cancelOrder} className="px-3 py-1 bg-red-600 text-white rounded">Cancel order</button>
          <select value={gateway} onChange={(e) => setGateway(e.target.value as 'alipay' | 'wechat')} className="border rounded px-2 py-1">
            <option value="alipay">Alipay (sandbox)</option>
            <option value="wechat">WeChat Pay (sandbox)</option>
          </select>
          <button onClick={payNow} className="px-3 py-1 bg-green-600 text-white rounded">Pay now (sandbox)</button>
        </div>
      )}
    </main>
  )
}
