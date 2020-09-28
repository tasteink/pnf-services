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

const RECHARGE_HEADERS = {
  "X-Recharge-Access-Token": process.env.RECHARGE_API_KEY,
  "Content-Type": "application/json",
  Accept: "application/json",
}

const api = (url) => {
  return wretch(url).headers(RECHARGE_HEADERS)
}

const cancelSubscription = async (subscriptionId, cancellation_reason = "Unprovided") => {
  const RECHARGE_API_URL = `https://api.rechargeapps.com/subscriptions/${subscriptionId}/cancel`
  const result = await of(api(RECHARGE_API_URL).post({ cancellation_reason }).json())
  const [response = { subscription: {} }, error] = result
  return [response.subscription, error]
}

export default async function (req: NowRequest, res: NowResponse) {
  const { subscriptionId, cancellationReason } = req.query
  const [subscription, error] = await cancelSubscription(subscriptionId, cancellationReason as string)

  return error
    ? res.status(200).send({ message: "SRY_IT_FAILED", error })
    : res.status(200).send({ message: "SUCCESS", subscription })
}
