import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.get('/api/products', (_req, res) => {
  res.json({ products: [{ id: 1, title: 'Sample Product', price: 1999 }] })
})

const port = process.env.PORT || 4000
app.listen(port, () => console.log(`API server listening on ${port}`))
