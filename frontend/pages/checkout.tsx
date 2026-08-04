import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

type CartItem = { id: string; variant_id: string; qty: number }

export default function CheckoutPage() {
  const router = useRouter()
  const [cartId, setCartId] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)

  const checkoutPayload = useMemo(
    () => ({ items: items.map((it) => ({ variant_id: it.variant_id, qty: it.qty })), coupon_code: couponCode || undefined, address_id: selectedAddressId || undefined }),
    [items, couponCode, selectedAddressId]
  )

  useEffect(() => {
    const fromQuery = typeof router.query.cart_id === 'string' ? router.query.cart_id : null
    const fromStorage = typeof window !== 'undefined' ? localStorage.getItem('cart_id') : null
    const id = fromQuery || fromStorage
    setCartId(id)
    if (!id) {
      setLoading(false)
      return
    }
    if (typeof window !== 'undefined') localStorage.setItem('cart_id', id)
    fetch(`${API_BASE}/api/cart?cart_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [router.query.cart_id])

  useEffect(() => {
    if (items.length === 0) {
      setPreview(null)
      return
    }
    fetch(`${API_BASE}/api/checkout/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map((it) => ({ variant_id: it.variant_id, qty: it.qty })), coupon_code: couponCode || undefined })
    })
      .then((r) => r.json())
      .then((data) => setPreview(data))
      .catch(() => setPreview(null))
  }, [couponCode, items.length])

  useEffect(() => {
    // load user addresses when checkout opens
    let mounted = true
    async function loadAddresses() {
      try {
        const s = await supabase.auth.getSession()
        const token = s.data.session?.access_token
        if (!token) return
        const r = await fetch(`${API_BASE}/api/addresses`, { headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok) return
        const data = await r.json()
        if (mounted) {
          setAddresses(data.addresses || [])
          const def = (data.addresses || []).find((a:any) => a.is_default)
          if (def) setSelectedAddressId(def.id)
        }
      } catch (err) {
        console.warn('Could not load addresses', err)
      }
    }
    loadAddresses()
    return () => { mounted = false }
  }, [])

  const placeOrder = async () => {
    setSubmitting(true)
    setError(null)
    try {
      // include supabase token if available
      const s = await supabase.auth.getSession()
      const token = s.data.session?.access_token
      const r = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(checkoutPayload)
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'place_order_failed')
      const orderId = data.order_id || (data.order && data.order.id)
      if (!orderId) throw new Error('missing_order_id')
      router.push(`/orders/${orderId}`)
    } catch (e: any) {
      setError(e.message || 'place_order_failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-8">Loading checkout...</div>
  if (!cartId) return <div className="p-8">No cart selected. <Link href="/cart"><a className="text-blue-600">Go cart</a></Link></div>

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>
      <div className="mb-4 flex gap-3">
        <Link href={`/cart?cart_id=${cartId}`}><a className="px-3 py-1 bg-gray-700 text-white rounded">Back to Cart</a></Link>
        <Link href="/orders"><a className="px-3 py-1 bg-blue-700 text-white rounded">Orders</a></Link>
      </div>

      {items.length === 0 && <div>No items to checkout.</div>}
      {items.length > 0 && (
        <>
          <div className="mb-4">
            <h2 className="font-medium mb-2">Shipping address</h2>
            {addresses.length === 0 && <div className="mb-2">No addresses saved. <Link href="/addresses"><a className="text-blue-600">Manage addresses</a></Link></div>}
            {addresses.length > 0 && (
              <div className="space-y-2 mb-2">
                {addresses.map((a) => (
                  <label key={a.id} className={`block border p-3 rounded ${selectedAddressId === a.id ? 'ring-2 ring-indigo-400' : ''}`}>
                    <input type="radio" name="address" checked={selectedAddressId === a.id} onChange={() => setSelectedAddressId(a.id)} className="mr-2" />
                    <div><strong>{a.full_name || a.user_id}</strong> {a.is_default && <span className="text-sm text-gray-500">(default)</span>}</div>
                    <div>{a.line1}, {a.city} {a.postal_code || ''}</div>
                    <div>{a.phone || ''}</div>
                  </label>
                ))}
              </div>
            )}
            <div><Link href="/addresses"><a className="px-3 py-1 bg-green-600 text-white rounded">Manage addresses</a></Link></div>
          </div>

          <ul className="space-y-2 mb-4">
            {items.map((it) => (
              <li key={it.id} className="border rounded p-3 flex justify-between">
                <span>Variant: {it.variant_id}</span>
                <span>Qty: {it.qty}</span>
              </li>
            ))}
          </ul>

          <div className="mb-4">
            <label className="block mb-1 font-medium">Coupon code</label>
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="e.g. WELCOME10"
              className="border rounded px-3 py-2 w-full"
            />
          </div>

          {preview && !preview.error && (
            <div className="border rounded p-4 mb-4 space-y-1">
              <div>Subtotal: ¥{((preview.subtotal_cents || 0) / 100).toFixed(2)}</div>
              <div>Shipping: ¥{((preview.shipping_cents || 0) / 100).toFixed(2)}</div>
              <div>Discount: -¥{((preview.discount_cents || 0) / 100).toFixed(2)}</div>
              <div className="font-semibold">Total: ¥{((preview.total_cents || 0) / 100).toFixed(2)}</div>
            </div>
          )}

          {preview && preview.error && <div className="text-red-600 mb-4">Preview error: {preview.error}</div>}
          {error && <div className="text-red-600 mb-4">Order error: {error}</div>}

          <button
            onClick={placeOrder}
            disabled={submitting}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-60"
          >
            {submitting ? 'Placing order...' : 'Place order'}
          </button>
        </>
      )}
    </main>
  )
}
