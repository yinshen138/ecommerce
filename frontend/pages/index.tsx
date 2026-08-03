import { useEffect, useState } from 'react'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export default function Home() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/products`)
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">E-commerce B2C (MVP)</h1>
        <p className="text-gray-600 mb-6">Next.js + TypeScript + Tailwind. Browse products and open details.</p>
        <div className="mb-6 flex gap-3">
          <Link href="/cart"><a className="px-3 py-1 bg-gray-700 text-white rounded">Cart</a></Link>
          <Link href="/checkout"><a className="px-3 py-1 bg-indigo-600 text-white rounded">Checkout</a></Link>
          <Link href="/orders"><a className="px-3 py-1 bg-blue-700 text-white rounded">Orders</a></Link>
          <Link href="/admin/orders"><a className="px-3 py-1 bg-slate-900 text-white rounded">Admin Orders</a></Link>
          <Link href="/admin/refunds"><a className="px-3 py-1 bg-slate-700 text-white rounded">Admin Refunds</a></Link>
        </div>

        {loading && <div>Loading products...</div>}
        {!loading && (
          <ul className="space-y-4">
            {products.map((p) => (
              <li key={p.id} className="p-4 border rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-sm text-gray-600">¥{(p.price_cents/100).toFixed(2)}</div>
                </div>
                <div>
                  <Link href={`/products/${p.id}`}>
                    <a className="px-3 py-1 bg-blue-600 text-white rounded">View</a>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
