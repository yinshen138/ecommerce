import { useEffect, useState } from 'react'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  useEffect(() => {
    setLoading(true)
    const url = status ? `${API_BASE}/api/orders?status=${encodeURIComponent(status)}` : `${API_BASE}/api/orders`
    fetch(url)
      .then((r) => r.json())
      .then((data) => setOrders(data.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [status])

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Orders</h1>
      <div className="mb-4 flex gap-3">
        <Link href="/"><a className="px-3 py-1 bg-gray-700 text-white rounded">Home</a></Link>
        <Link href="/checkout"><a className="px-3 py-1 bg-indigo-600 text-white rounded">Checkout</a></Link>
      </div>
      <div className="mb-4">
        <label className="mr-2">Status:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1">
          <option value="">All</option>
          <option value="created">created</option>
          <option value="paid">paid</option>
          <option value="cancelled">cancelled</option>
        </select>
      </div>
      {loading && <div>Loading orders...</div>}
      {!loading && orders.length === 0 && <div>No orders found.</div>}
      {!loading && orders.length > 0 && (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="border rounded p-4 flex justify-between items-center">
              <div>
                <div className="font-medium">{o.id}</div>
                <div className="text-sm text-gray-600">Status: {o.status}</div>
                <div className="text-sm text-gray-600">Total: ¥{((o.total_cents || 0) / 100).toFixed(2)}</div>
              </div>
              <Link href={`/orders/${o.id}`}>
                <a className="px-3 py-1 bg-blue-600 text-white rounded">Detail</a>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
