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

  const [selectedIds, setSelectedIds] = useState<Record<string,boolean>>({})
  const [selectAll, setSelectAll] = useState(false)
  const [bulkQty, setBulkQty] = useState(1)

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
        const sel: Record<string,boolean> = {}
        (data.items || []).forEach((it:any)=> sel[it.id]=false)
        setSelectedIds(sel)
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

  const toggleSelect = (id:string) => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleSelectAll = () => {
    const newVal = !selectAll
    setSelectAll(newVal)
    const sel: Record<string,boolean> = {}
    items.forEach(it => sel[it.id] = newVal)
    setSelectedIds(sel)
  }

  const bulkDelete = async () => {
    const ids = Object.keys(selectedIds).filter(id => selectedIds[id])
    if (ids.length === 0) return alert('No items selected')
    if (!confirm(`Delete ${ids.length} items?`)) return
    const r = await fetch(`${API_BASE}/api/cart/items`, { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ids }) })
    if (!r.ok) return alert('Delete failed')
    setItems(items.filter(it => !ids.includes(it.id)))
    const sel: Record<string,boolean> = {}
    items.forEach(it => sel[it.id]=false)
    setSelectedIds(sel)
    setSelectAll(false)
  }

  const bulkUpdateQty = async () => {
    const ids = Object.keys(selectedIds).filter(id => selectedIds[id])
    if (ids.length === 0) return alert('No items selected')
    const updates = ids.map(id=> ({ id, qty: Number(bulkQty) }))
    const r = await fetch(`${API_BASE}/api/cart/items`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ updates }) })
    if (!r.ok) return alert('Bulk update failed')
    const data = await r.json()
    const updatedMap: Record<string, any> = {}
    (data.items || []).forEach((it:any)=> updatedMap[it.id]=it)
    setItems(items.map(it=> updatedMap[it.id] ? updatedMap[it.id] : it))
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

      <div className="mb-4 flex items-center gap-3">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={selectAll} onChange={toggleSelectAll} /> Select all</label>
        <button onClick={bulkDelete} className="px-3 py-1 bg-red-600 text-white rounded">Delete selected</button>
        <div className="ml-auto flex items-center gap-2">
          <input type="number" value={bulkQty} onChange={(e)=>setBulkQty(Number(e.target.value))} className="w-24 border rounded px-2 py-1" />
          <button onClick={bulkUpdateQty} className="px-3 py-1 bg-gray-700 text-white rounded">Set qty for selected</button>
        </div>
      </div>

      <ul className="space-y-3">
        {items.map(it => (
          <li key={it.id} className="p-3 border rounded flex justify-between items-center">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={!!selectedIds[it.id]} onChange={()=>toggleSelect(it.id)} />
              <div>
                <div className="font-medium">Variant: {it.variant_id}</div>
                <div className="text-sm text-gray-600">Qty: {it.qty}</div>
              </div>
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
