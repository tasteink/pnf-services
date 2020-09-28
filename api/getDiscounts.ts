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

const HEADERS = {
  "X-Recharge-Access-Token": process.env.RECHARGE_API_KEY,
  "Content-Type": "application/json",
  Accept: "application/json",
}

const main = async (req, res) => {
  const queryString = req.url.substr(req.url.indexOf("?"))
  const isSingle = queryString.includes("discount_code")
  const forwardUrl = "https://api.rechargeapps.com/discounts" + queryString || ""
  const result = await of(wretch(forwardUrl).headers(HEADERS).get().json())
  const key = isSingle ? "discount" : "discounts"
  const final = isSingle ? getValue(result[0], "discounts.0") : getValue(result[0], "discounts")
  const data = { query: req.query, [key]: final, error: result[1] }
  console.log({ data, queryString, forwardUrl })
  return res.send({ name: "getDiscounts", ...data })
}

export default micro()(main)
