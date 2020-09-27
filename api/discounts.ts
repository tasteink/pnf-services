import { NowRequest, NowResponse } from "@vercel/node"
import { URLSearchParams } from "url"
import words from "random-words"
import { of } from "await-of"
import fetch from "node-fetch"
import wretch from "wretch"
import signale from "signale"
import dayjs from "dayjs"

// Polyfills for wretch.
global.URLSearchParams = URLSearchParams as any
global.fetch = fetch

type DiscountsQueryT = {
  code: string
  totalPrice: string | number
  itemCount: string | number
}

type RequestT = NowRequest & {
  query: DiscountsQueryT
}

const RECHARGE_HEADERS = {
  "X-Recharge-Access-Token": process.env.RECHARGE_API_KEY,
  "Content-Type": "application/json",
  Accept: "application/json",
}

async function getNewDiscountValue(context) {
  if (context.matchingDiscount.discount_type === "fixed_amount") {
    const value = context.query.quantityDiscount + context.matchingDiscount.value
    return context.next({ newDiscountValue: value })
  }
  if (context.matchingDiscount.discount_type === "percentage") {
    const multiplier = context.matchingDiscount.value / 100
    const percentageDiscount = context.query.quantityDiscountedPrice * multiplier
    const value = context.query.quantityDiscount + percentageDiscount
    return context.next({ newDiscountValue: value })
  }
}

const createDiscountDescriptor = (options) => {
  const discount = {}
  Object.assign(discount, options)
  // value - cod: (context.req.query.itemCount - 1) * 20,
  // discount.discount_type = "fixed_amount"
  // discount.applies_to_product_type = "SUBSCRIPTION"
  // discount.duration = "usage_limit"
  // discount.duration_usage_limit = 33
  // discount.status = "enabled"
  // discount.usage_limit = 3
  // discount.starts_at = "2020-01-01"
  // discount.ends_at = "2021-01-01"
  return discount
}

const createDiscount = async (descriptor) => {
  const RECHARGE_API_URL = "https://api.rechargeapps.com/discounts"
  const base = wretch(RECHARGE_API_URL).headers(RECHARGE_HEADERS)
  const [response = { discount: {} }, error] = await of(base.post(descriptor).json())
  return [response.discount, error]
}

const listDiscounts = async () => {
  const RECHARGE_API_URL = "https://api.rechargeapps.com/discounts"
  return await of(wretch(RECHARGE_API_URL).headers(RECHARGE_HEADERS).get().json())
}

async function findMatchingDiscount(context) {
  const matchingDiscount = context.allDiscounts.find((discount) => {
    const codeMatch = discount.code.toLowerCase() === context.req.query.code.toLowerCase()
    const hasStarted = dayjs(discount.starts_at).isBefore(context.query.nowDate)
    const hasExpired = dayjs(discount.ends_at).isAfter(context.query.nowDate)
    return codeMatch && hasStarted && hasExpired
  })

  return !matchingDiscount
    ? { message: "INVALID_CODE", status: 200, context: context._context }
    : context.next({ matchingDiscount })
}

// const listActiveDiscounts = async () => {
//   const [{ discounts }, discountsError] = await listDiscounts()

//   discountsError
//     ? signale.error(discountsError)
//     : signale.info(`Got active discounts (${discounts.length})`)

//   return {
//     data: discounts.filter(({ status }) => status === "enabled"),
//     error: discountsError,
//   }
// }

// const main = async () => {
//   // Get all active discounts.
//   const matchingDiscount = findMatchingDiscount(discounts, code)
//   const discountDescriptor = createDiscountDescriptor(matchingDiscount, cart)
//   const [newDiscount, newDiscountError] = await createDiscount(discountDescriptor)
// }

async function getQuantityDiscount(context) {
  const quantityDiscount = context.allDiscounts.find((discount) => {
    return discount.code === context.query.quantityDiscountCode
  })

  if (!quantityDiscount) {
    const [quantityDiscount, error] = await createDiscount({
      code: context.query.quantityDiscountCode,
      value: context.query.eligibleItemCount * 20,
      discount_type: "fixed_amount",
      duration: "forever",
    })

    return error ? context.error({ status: 502, error }) : context.next({ quantityDiscount })
  }

  return context.next({ quantityDiscount })
}

async function buildQuery(context) {
  const itemCount = Number(context.req.query.itemCount)
  const totalPrice = Number(context.req.query.totalPrice)
  const quantityDiscountCode = `BOX-OF-${itemCount}`
  const eligibleItemCount = itemCount - 1
  const quantityDiscount = eligibleItemCount * 20
  const quantityDiscountedPrice = totalPrice - quantityDiscount
  const nowDate = dayjs()
  const { code } = context.req.query

  const query = {
    code,
    nowDate,
    itemCount,
    totalPrice,
    quantityDiscount,
    eligibleItemCount,
    quantityDiscountCode,
    quantityDiscountedPrice,
  }

  return context.next({ query })
}

async function fetchAllDiscounts(context) {
  const [response = {}, error] = await listDiscounts()
  const allDiscounts = response.discounts || []
  return error ? context.error({ status: 502, error }) : context.next({ allDiscounts })
}

async function filterActiveDiscounts(context) {
  const activeDiscounts = context.allDiscounts.filter(({ status }) => {
    return status === "enabled"
  })

  return context.next({ activeDiscounts })
}

async function createNewDiscount(context) {
  const [discount, error] = await createDiscount({
    ...context.matchingDiscount,
    value: context.newDiscountValue,
    code: context.newDiscountCode,
  })

  return error
    ? context.error({ status: 502, error })
    : { status: 200, message: "SUCCESS", discount }
}

async function createNewDiscountCode(context) {
  const newDiscountCode = `${context.query.code}-BOX-OF-${context.query.itemCount}`
  return context.next({ newDiscountCode })
}

const steps = [
  buildQuery,
  fetchAllDiscounts,
  filterActiveDiscounts,
  getQuantityDiscount,
  findMatchingDiscount,
  createNewDiscountCode,
  getNewDiscountValue,
  createNewDiscount,
]

const logLastData = (name, data) => {
  for (const key in data) {
    key !== "error" && signale.info(name, data[key])
  }
}

const createContext = (context) => {
  context._context = {}
  context.error = ({ error, status }) => {
    const stepName = steps[0].name
    signale.error(stepName)
    const ctx = context._context
    const keyStart = process.env.RECHARGE_API_KEY.slice(0, 4)
    return { status, error, stepName, context: ctx, keyStart }
  }

  context.start = () => {
    const nextStep = steps[0]
    return nextStep(context)
  }

  context.next = (data) => {
    logLastData(steps[0].name, data)
    steps.shift()
    Object.assign(context, data)
    Object.assign(context._context, data)
    const nextStep = steps[0]
    return nextStep(context)
  }

  return context
}

export default async function (req: RequestT, res: NowResponse) {
  signale.start(req.query)
  const context = createContext({ req, res })
  const final = await context.start()
  res.send(final)
}
