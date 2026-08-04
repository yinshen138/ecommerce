import { useEffect, useState } from 'react'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export default function Home() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (minPrice !== '') params.set('min_price', String(Math.round(Number(minPrice) * 100)))
    if (maxPrice !== '') params.set('max_price', String(Math.round(Number(maxPrice) * 100)))
    if (sort) params.set('sort', sort)
    if (page) params.set('page', String(page))
    const url = `${API_BASE}/api/products?` + params.toString()
    fetch(url)
      .then((r) => r.json())
      .then((data) => { if (mounted) setProducts(data.products || []) })
      .catch(() => { if (mounted) setProducts([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [q, minPrice, maxPrice, sort, page])

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

        <section className="mb-6 border rounded p-4">
          <div className="flex gap-2 items-center">
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search products" className="flex-1 border rounded px-3 py-2" />
            <input value={minPrice} onChange={(e)=>setMinPrice(e.target.value)} placeholder="Min ¥" className="w-24 border rounded px-2 py-2" />
            <input value={maxPrice} onChange={(e)=>setMaxPrice(e.target.value)} placeholder="Max ¥" className="w-24 border rounded px-2 py-2" />
            <select value={sort} onChange={(e)=>setSort(e.target.value)} className="border rounded px-2 py-2">
              <option value="newest">Newest</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
            </select>
          </div>
        </section>

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

        <div className="mt-6 flex justify-between">
          <button disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))} className="px-3 py-1 bg-gray-200 rounded">Prev</button>
          <div>Page {page+1}</div>
          <button onClick={()=>setPage(p=>p+1)} className="px-3 py-1 bg-gray-200 rounded">Next</button>
        </div>
      </div>
    </main>
  )
}
