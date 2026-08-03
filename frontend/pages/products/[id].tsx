import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

type Variant = {
  id: string
  sku: string
  title: string
  attrs: any
  price_cents: number
  available?: number
}

export default function ProductPage() {
  const router = useRouter()
  const { id } = router.query
  const [product, setProduct] = useState<any>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastCartId, setLastCartId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`${API_BASE}/api/products/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch')
        return r.json()
      })
      .then((data) => {
        setProduct(data.product)
        setVariants(data.variants || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>
  if (!product) return <div className="p-8">Product not found</div>

  const addToCart = (variantId: string) => {
    fetch(`${API_BASE}/api/cart/items`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ variant_id: variantId, qty: 1 })
    })
      .then(r=>r.json())
      .then(d=>{
        const cartId = d.cart_id || null
        if (cartId) {
          localStorage.setItem('cart_id', cartId)
          setLastCartId(cartId)
        }
        alert('Added to cart')
      })
      .catch(()=>alert('Failed'))
  }

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{product.title}</h1>
      <p className="text-gray-600 mb-4">{product.description}</p>
      <div className="mb-6">
        <strong>Price:</strong> ¥{(product.price_cents / 100).toFixed(2)}
      </div>
      <div className="mb-6 flex gap-3">
        <Link href={lastCartId ? `/cart?cart_id=${lastCartId}` : '/cart'}>
          <a className="px-3 py-1 bg-gray-700 text-white rounded">View Cart</a>
        </Link>
        <Link href={lastCartId ? `/checkout?cart_id=${lastCartId}` : '/checkout'}>
          <a className="px-3 py-1 bg-indigo-600 text-white rounded">Go Checkout</a>
        </Link>
      </div>
      <section>
        <h2 className="text-lg font-semibold mb-2">Variants</h2>
        {variants.length === 0 && <div className="mb-3">No variants</div>}
        <ul className="space-y-3">
          {variants.length === 0 ? (
            <li className="p-3 border rounded">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{product.title}</div>
                  <div className="text-sm text-gray-600">¥{(product.price_cents/100).toFixed(2)}</div>
                </div>
                <div>
                  <button
                    onClick={() => addToCart(product.id)}
                    className="mt-2 px-3 py-1 bg-green-600 text-white rounded"
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            </li>
          ) : (
            variants.map((v) => (
              <li key={v.id} className="p-3 border rounded">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{v.title || v.sku}</div>
                    <div className="text-sm text-gray-600">SKU: {v.sku}</div>
                  </div>
                  <div className="text-right">
                    <div>¥{(v.price_cents / 100).toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Stock: {v.available ?? '—'}</div>
                  </div>
                </div>
                  <div className="mt-3">
                    <button
                      onClick={() => addToCart(v.id)}
                      className="mt-2 px-3 py-1 bg-green-600 text-white rounded"
                    >
                      Add to cart
                    </button>
                  </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  )
}
