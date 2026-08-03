import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [cartId, setCartId] = useState<string | null>(null)

  useEffect(() => {
    const fromQuery = typeof router.query.cart_id === 'string' ? router.query.cart_id : null
    const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('cart_id') : null
    const id = fromQuery || fromStorage
    if (id) {
      if (typeof window !== 'undefined') localStorage.setItem('cart_id', id)
      setCartId(id)
    }
    const url = id ? `${API_BASE}/api/cart?cart_id=${encodeURIComponent(id)}` : `${API_BASE}/api/cart`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setCart(data.cart)
        setItems(data.items || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router.query.cart_id])

  const updateQty = (id: string, qty: number) => {
    fetch(`${API_BASE}/api/cart/items/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ qty }) })
      .then(r=>r.json()).then(data=>{
        setItems(items.map(it => it.id === id ? data.item : it))
      }).catch(()=>{})
  }

  const removeItem = (id: string) => {
    fetch(`${API_BASE}/api/cart/items/${id}`, { method: 'DELETE' })
      .then(r=>r.json()).then(()=> setItems(items.filter(it=>it.id!==id)))
  }

  if (loading) return <div className="p-8">Loading cart...</div>

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Shopping Cart</h1>
      <div className="mb-4 flex gap-3">
        <Link href={cartId ? `/checkout?cart_id=${cartId}` : '/checkout'}>
          <a className="px-3 py-1 bg-indigo-600 text-white rounded">Checkout</a>
        </Link>
        <Link href="/orders"><a className="px-3 py-1 bg-blue-700 text-white rounded">Orders</a></Link>
      </div>
      {!cart && <div>Your cart is empty</div>}
      {items.length === 0 && <div>No items</div>}
      <ul className="space-y-3">
        {items.map(it => (
          <li key={it.id} className="p-3 border rounded flex justify-between items-center">
            <div>
              <div className="font-medium">Variant: {it.variant_id}</div>
              <div className="text-sm text-gray-600">Qty: {it.qty}</div>
            </div>
            <div className="space-x-2">
              <button onClick={()=>updateQty(it.id, Math.max(1, it.qty-1))} className="px-2 py-1 bg-gray-200 rounded">-</button>
              <button onClick={()=>updateQty(it.id, it.qty+1)} className="px-2 py-1 bg-gray-200 rounded">+</button>
              <button onClick={()=>removeItem(it.id)} className="px-2 py-1 bg-red-500 text-white rounded">Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
