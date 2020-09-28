// import nanoid from "nanoid"
// import FormData from "form-data"
import { NowRequest, NowResponse } from "@vercel/node"
import { URLSearchParams } from "url"
import words from "random-words"
import { of } from "await-of"
import fetch from "node-fetch"
import wretch from "wretch"
import signale from "signale"
import micro from "micro-cors"
import getValue from "get-value"

// Polyfills for wretch.
global.URLSearchParams = URLSearchParams as any
global.fetch = fetch

const messenger = (() => {
  const messages = []
  const getMessages = () => messages
  const log = (key) => console.log(key) || messages.push(key)
  return { getMessages, log }
})()

const createLogger = (cache = []) => {
  const log = (identifier, data) => {
    console.log({ identifier, data })
    cache.push({ identifier, data })
  }

  log.dump = () => cache
  return log
}

const main = async (req, res) => {
  const log = createLogger()
  log("STARTING", req.query)
  const itemCount = req.query.itemCount
  const totalPrice = req.query.totalPrice
  const discountCode = req.query.discountCode
  const eligibleDiscountsCount = itemCount - 1
  const quantityDiscountCode = `BOX-OF-${itemCount}`
  const savingsFromQuantity = eligibleDiscountsCount * 20
  const priceAfterQuantityDiscount = totalPrice - savingsFromQuantity
  const [code, count] = [quantityDiscountCode, eligibleDiscountsCount]

  const done = (status, options) => {
    const logs = status === 200 ? undefined : log.dump()
    res.status(status).send({ ...options, logs })
  }

  const logApi = (thunk) => async (...args) => {
    const result = await thunk(...args)
    log(thunk.name, JSON.stringify({ args, result }, null, 2))
    return result
  }

  const recharge = (() => {
    const headers = {
      "X-Recharge-Access-Token": process.env.RECHARGE_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    }

    async function getDiscount(code) {
      const url = "https://api.rechargeapps.com/discounts?discount_code=" + code
      const result = await of(wretch(url).headers(headers).get().json())
      const discount = getValue(result[0], "discounts.0")
      return [discount, result[1]]
    }

    async function getAllDiscounts() {
      const url = "https://api.rechargeapps.com/discounts?limit=250"
      const result = await of(wretch(url).headers(headers).get().json())
      const discounts = result[0] && result[0].discounts
      return [discounts, result[1]]
    }

    async function createDiscount(candidate) {
      const url = "https://api.rechargeapps.com/discounts"
      // const result = await of(fetch(url, { headers }).then((res) => res.json()))
      const result = await of(wretch(url).headers(headers).post(candidate).json())
      const discount = result[0] && result[0].discount
      console.log("---", result[0], result[1])
      return [discount, result[1]]
    }

    async function createQuantityDiscount(code, count) {
      return recharge.createDiscount({
        code,
        value: count * 20,
        discount_type: "fixed_amount",
        duration: "forever",
      })
    }

    return {
      getDiscount: logApi(getDiscount),
      getAllDiscounts: logApi(getAllDiscounts),
      createDiscount: logApi(createDiscount),
      createQuantityDiscount: logApi(createQuantityDiscount),
    }
  })()

  let [quantityDiscount, quantityDiscountError] = await recharge.getDiscount(quantityDiscountCode)
  !quantityDiscount && log("NEW_QUANTITY_DISCOUNT_NEEDED", { quantityDiscountCode })
  quantityDiscountError && log("GET_QUANTITY_DISCOUNT_ERROR", { quantityDiscountError })

  let [promotionDiscount, promotionDiscountError] = await recharge.getDiscount(discountCode)
  promotionDiscountError && log("PROMOTION_DISCOUNT_ERROR", { promotionDiscountError })
  !promotionDiscount && log("INVALID_CODE_FROM_USER", { discountCode })

  if (!quantityDiscount) {
    ;[quantityDiscount, quantityDiscountError] = await recharge.createQuantityDiscount(code, count)
    quantityDiscount && log("CREATED_QUANTITY_DISCOUNT", { quantityDiscount })
    quantityDiscountError && log("FAILED_TO_CREATE_QUANTITY_DISCOUNT", { quantityDiscountError })
  }

  if (quantityDiscountError) {
    return done(400, { message: "CANT_CREATE_QUANTITY_DISCOUNT", type: "error", error: quantityDiscountError })
  }

  if (!promotionDiscount) {
    return done(400, { message: "INVALID_CODE", type: "warning", discountCode: quantityDiscount.code })
  }

  const [newDiscount, newDiscountError] = await recharge.createDiscount({
    code: `${promotionDiscount.code}-${quantityDiscountCode}`,
    value: `${promotionDiscount.value + savingsFromQuantity}`,
    discount_type: promotionDiscount.discount_type || "fixed_amount",
    duration: "forever",
  })

  return newDiscountError
    ? done(400, { message: "CANT_CREATE_HYBRID_DISCOUNT", type: "error", error: newDiscountError })
    : done(200, { message: "SUCCESS", type: "success", newDiscount })
}

export default micro()(main)
