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

  // derive images and attribute selection
  const imgs: string[] = Array.isArray(product.images) && product.images.length > 0 ? product.images : [
    `https://picsum.photos/seed/${product.id}/800/600`
  ]

  // parse attrs from variants: attrs may be JSON string or object
  const parsedVariants = variants.map(v => ({ ...v, attrs: (typeof v.attrs === 'string' ? (() => { try { return JSON.parse(v.attrs) } catch(_) { return {} } })() : (v.attrs || {})) }))

  // build attribute options
  const attrOptions: Record<string, Set<string>> = {}
  parsedVariants.forEach(v => {
    const a = v.attrs || {}
    Object.keys(a).forEach(k => {
      attrOptions[k] = attrOptions[k] || new Set()
      attrOptions[k].add(String(a[k]))
    })
  })

  const attrKeys = Object.keys(attrOptions)
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string,string>>(() => {
    const initial: Record<string,string> = {}
    attrKeys.forEach(k => initial[k] = Array.from(attrOptions[k])[0])
    return initial
  })
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    // ensure selectedAttrs populated when variants load
    if (attrKeys.length > 0 && Object.keys(selectedAttrs).length === 0) {
      const initial: Record<string,string> = {}
      attrKeys.forEach(k => initial[k] = Array.from(attrOptions[k])[0])
      setSelectedAttrs(initial)
    }
  }, [variants.length])

  const matchingVariant = parsedVariants.find(v => {
    if (!v.attrs) return false
    return attrKeys.every(k => String(v.attrs[k]) === String(selectedAttrs[k]))
  })

  const selectedVariantId = matchingVariant ? matchingVariant.id : (variants[0] && variants[0].id) || null

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="border rounded overflow-hidden">
            <img src={imgs[currentIndex]} alt={product.title} className="w-full h-96 object-cover" />
            <div className="flex items-center justify-between p-2">
              <button onClick={() => setCurrentIndex((currentIndex-1+imgs.length)%imgs.length)} className="px-2 py-1 bg-gray-200 rounded">Prev</button>
              <div className="flex gap-2">
                {imgs.map((src, i) => (
                  <img key={i} src={src} onClick={() => setCurrentIndex(i)} className={`w-16 h-12 object-cover rounded cursor-pointer ${i===currentIndex? 'ring-2 ring-indigo-400': ''}`} />
                ))}
              </div>
              <button onClick={() => setCurrentIndex((currentIndex+1)%imgs.length)} className="px-2 py-1 bg-gray-200 rounded">Next</button>
            </div>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
          <p className="text-gray-600 mb-4">{product.description}</p>
          <div className="mb-4">
            <strong>Price:</strong> ¥{(product.price_cents / 100).toFixed(2)}
          </div>

          {attrKeys.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">Options</h3>
              {attrKeys.map(k => (
                <div key={k} className="mb-2">
                  <div className="text-sm text-gray-700 mb-1">{k}</div>
                  <div className="flex gap-2">
                    {Array.from(attrOptions[k]).map(opt => {
                      const disabled = !parsedVariants.some(v => v.attrs && Object.keys(selectedAttrs).concat(k).every(kk => {
                        const val = kk===k ? opt : selectedAttrs[kk]
                        return String(v.attrs[kk]) === String(val)
                      }))
                      return (
                        <button key={opt} onClick={() => setSelectedAttrs(prev => ({...prev, [k]: opt}))} disabled={disabled} className={`px-3 py-1 rounded ${selectedAttrs[k]===opt ? 'bg-indigo-600 text-white' : 'bg-gray-100' } ${disabled? 'opacity-40 cursor-not-allowed':''}`}>
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mb-4">
            <div className="text-sm text-gray-500">Selected SKU: {matchingVariant ? matchingVariant.sku : '—'}</div>
            <div className="text-sm text-gray-500">Stock: {matchingVariant ? (matchingVariant.available ?? '—') : '—'}</div>
          </div>

          <div className="flex gap-3 mb-4">
            <button onClick={() => { if (selectedVariantId) addToCart(selectedVariantId) }} className="px-4 py-2 bg-green-600 text-white rounded">Add to cart</button>
            <Link href={lastCartId ? `/checkout?cart_id=${lastCartId}` : '/checkout'}><a className="px-4 py-2 bg-indigo-600 text-white rounded">Go checkout</a></Link>
          </div>
        </div>
      </div>
    </main>
  )
}
