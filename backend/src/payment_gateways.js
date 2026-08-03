const crypto = require('crypto')
const fetch = require('node-fetch')

function env(name, required = false) {
  const v = process.env[name]
  if (required && !v) throw new Error(`missing_env_${name}`)
  return v
}

function normalizePem(keyText) {
  if (!keyText) return ''
  return keyText.includes('\\n') ? keyText.replace(/\\n/g, '\n') : keyText
}

function nonce(len = 24) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len)
}

function amountToYuan(amountCents) {
  return (Number(amountCents || 0) / 100).toFixed(2)
}

function buildAlipaySignContent(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '' && k !== 'sign' && k !== 'sign_type')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
}

function signRSA2(content, privateKey) {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(content, 'utf8')
  signer.end()
  return signer.sign(normalizePem(privateKey), 'base64')
}

function verifyRSA2(content, sign, publicKey) {
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(content, 'utf8')
  verifier.end()
  return verifier.verify(normalizePem(publicKey), sign, 'base64')
}

async function createAlipayOrder({ paymentId, subject, amountCents }) {
  const gateway = env('ALIPAY_GATEWAY_URL', false) || 'https://openapi.alipay.com/gateway.do'
  const appId = env('ALIPAY_APP_ID', true)
  const privateKey = env('ALIPAY_PRIVATE_KEY', true)
  const notifyUrl = env('ALIPAY_NOTIFY_URL', true)
  const returnUrl = env('ALIPAY_RETURN_URL', false) || ''
  const charset = 'utf-8'
  const signType = 'RSA2'
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const bizContent = JSON.stringify({
    out_trade_no: paymentId,
    total_amount: amountToYuan(amountCents),
    subject: subject || 'E-commerce order',
    product_code: 'FAST_INSTANT_TRADE_PAY'
  })

  const params = {
    app_id: appId,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: charset,
    sign_type: signType,
    timestamp,
    version: '1.0',
    notify_url: notifyUrl,
    return_url: returnUrl,
    biz_content: bizContent
  }

  const content = buildAlipaySignContent(params)
  const sign = signRSA2(content, privateKey)
  const url = `${gateway}?${content}&sign=${encodeURIComponent(sign)}`
  return {
    gateway: 'alipay',
    payment_url: url,
    gateway_payment_id: paymentId,
    raw: { params }
  }
}

function buildWechatAuthorization({ method, path, body }) {
  const mchid = env('WECHAT_MCH_ID', true)
  const serialNo = env('WECHAT_SERIAL_NO', true)
  const privateKey = env('WECHAT_PRIVATE_KEY', true)
  const ts = `${Math.floor(Date.now() / 1000)}`
  const n = nonce(32)
  const message = `${method}\n${path}\n${ts}\n${n}\n${body}\n`
  const signature = signRSA2(message, privateKey)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${n}",timestamp="${ts}",serial_no="${serialNo}",signature="${signature}"`
}

async function createWechatOrder({ paymentId, subject, amountCents }) {
  const appid = env('WECHAT_APP_ID', true)
  const mchid = env('WECHAT_MCH_ID', true)
  const notifyUrl = env('WECHAT_NOTIFY_URL', true)
  const apiBase = env('WECHAT_API_BASE_URL', false) || 'https://api.mch.weixin.qq.com'
  const path = '/v3/pay/transactions/native'
  const bodyObj = {
    appid,
    mchid,
    description: subject || 'E-commerce order',
    out_trade_no: paymentId,
    notify_url: notifyUrl,
    amount: {
      total: Number(amountCents || 0),
      currency: 'CNY'
    }
  }
  const body = JSON.stringify(bodyObj)
  const auth = buildWechatAuthorization({ method: 'POST', path, body })
  const r = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body
  })
  const text = await r.text()
  let data
  try { data = JSON.parse(text) } catch (_) { data = { raw: text } }
  if (!r.ok) {
    const code = data.code || r.status
    throw new Error(`wechat_create_failed_${code}`)
  }
  return {
    gateway: 'wechat',
    payment_url: data.code_url || null,
    gateway_payment_id: data.prepay_id || paymentId,
    raw: data
  }
}

function decryptWechatResource(resource, apiV3Key) {
  const key = Buffer.from(apiV3Key, 'utf8')
  if (key.length !== 32) throw new Error('invalid_wechat_apiv3_key_length')
  const nonce = Buffer.from(resource.nonce, 'utf8')
  const aad = Buffer.from(resource.associated_data || '', 'utf8')
  const ciphertext = Buffer.from(resource.ciphertext, 'base64')
  const authTag = ciphertext.slice(ciphertext.length - 16)
  const encryptedData = ciphertext.slice(0, ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAAD(aad)
  decipher.setAuthTag(authTag)
  const decoded = Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8')
  return JSON.parse(decoded)
}

function verifyAlipayNotify(payload) {
  const skip = process.env.ALIPAY_NOTIFY_SKIP_VERIFY === '1'
  if (skip) return true
  const publicKey = env('ALIPAY_PUBLIC_KEY', true)
  const sign = payload.sign
  if (!sign) return false
  const content = buildAlipaySignContent(payload)
  return verifyRSA2(content, sign, publicKey)
}

module.exports = {
  createAlipayOrder,
  createWechatOrder,
  decryptWechatResource,
  verifyAlipayNotify
}
