const express = require('express')
const bodyParser = require('body-parser')
const cartRoutes = require('./src/routes/cart')

const app = express()
app.use(bodyParser.json())
cartRoutes(app)

app.listen(5000, () => console.log('Test cart server listening on 5000'))
