// import nanoid from "nanoid"
// import FormData from "form-data"
import { NowRequest, NowResponse } from "@vercel/node"
import { URLSearchParams } from "url"
import words from "random-words"
import { of } from "await-of"
import fetch from "node-fetch"
import fetch from "node-fetch"
import wretch from "wretch"
import signale from "signale"

global.fetch = fetch
global.URLSearchParams = URLSearchParams

// await
// complete
// error
// debug
// fatal
// fav
// info
// note
// pause
// pending
// star
// start
// success
// wait
// warn
// watch
// log

const RECHARGE_HEADERS = {
  "X-Recharge-Access-Token": process.env.RECHARGE_ACCESS_TOKEN,
  "Content-Type": "application/json",
  Accept: "application/json",
}

const getNewDiscountValue = (originalDiscount, cart) => {
  const cartDiscountValue = (cart.items.length - 1) * 20
  const cartPriceAfterDiscount = cart.totalPrice - cartDiscountValue

  if (originalDiscount.discount_type === "fixed_amount") {
    return cartDiscountValue + originalDiscount.value
  }

  if (originalDiscount.discount_type === "percentage") {
    const multiplier = originalDiscount.value / 100
    const percentageDiscount = cartPriceAfterDiscount * multiplier
    return cartDiscountValue + percentageDiscount
  }
}

const createDiscountDescriptor = (originalDiscount, cart) => {
  const discount = {}
  discount.code = `${originalDiscount.code}-BOX_OF_${cart.items.length}`
  discount.value = getNewDiscountValue(originalDiscount, cart)
  discount.discount_type = "fixed_amount"
  discount.applies_to_product_type = "SUBSCRIPTION"
  discount.duration = "usage_limit"
  discount.duration_usage_limit = 33
  discount.status = "enabled"
  discount.usage_limit = 3
  discount.starts_at = "2020-01-01"
  discount.ends_at = "2021-01-01"
  return discount
}

const createDiscount = async (descriptor) => {
  const RECHARGE_API_URL = "https://api.rechargeapps.com/discounts"
  return await of(wretch(RECHARGE_API_URL).headers(RECHARGE_HEADERS).post(descriptor).json())
}

const listDiscounts = async () => {
  const RECHARGE_API_URL = "https://api.rechargeapps.com/discounts"
  return await of(wretch(RECHARGE_API_URL).headers(RECHARGE_HEADERS).get().json())
}

const findMatchingDiscount = (discounts, code) => {
  const match = discounts.find((discount) => {
    return discount.code.toLowerCase() === code.toLowerCase()
  })

  match && signale.info(`Matched discount: ${match.code} - ${match.value}`)
  return match
}

const listActiveDiscounts = async () => {
  const [{ discounts }, discountsError] = await listDiscounts()

  discountsError
    ? signale.error(discountsError)
    : signale.info(`Got active discounts (${discounts.length})`)

  return {
    data: discounts.filter(({ status }) => status === "enabled"),
    error: discountsError,
  }
}

const main = async () => {
  // Get all active discounts.
  const matchingDiscount = findMatchingDiscount(discounts, code)
  const discountDescriptor = createDiscountDescriptor(matchingDiscount, cart)
  const [newDiscount, newDiscountError] = await createDiscount(discountDescriptor)
}

const getQuantityDiscount = (discounts, itemCount) => {
  const match = discounts.find((discount) => {
    return discount.code === `BOX-OF-${itemCount}`
  })
}

type DiscountsQueryT = {
  code: string
  totalPrice: string
  itemCount: string
}

type RequestT = NowRequest & {
  query: DiscountsQueryT
}

export default async function (req: RequestT, res: NowResponse) {
  const query: DiscountsQueryT = req.query
  const context = { req, res }
  signale.start(query)

  // 📃 Fetch all discounts for store and then filter out inactive ones.
  const activeDiscounts = await listActiveDiscounts()

  // 🤷‍♀️ If there is an error, there's not much we can do.
  // 🤡 I suppose we will just tell the user it is invalid.
  if (activeDiscounts.error) {
    const json = { error: activeDiscounts.error, query: query }
    return res.status(502).send(json)
  }

  // 1️⃣ Look for an active discount that matches the user submitted code.
  const matchingDiscount = findMatchingDiscount(activeDiscounts.data, query.code)

  if (!matchingDiscount) {
  }

  signale.info(activeDiscounts)
  //   res.status(200).send(`Hello ${who}!`)
  // res.status(400).json({ error: 'My custom 400 error' })
  res.send({ query, activeDiscounts })
}
