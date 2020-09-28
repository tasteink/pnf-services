# pnf-services
_ReCharge does not allow API calls to be made to their server from a UI. The reason for this is that each API call requires an API key to be included for authorization, and when API keys are being sent back and forth from a UI, it opens the door for major security breaches ._

pnf-services is the name of a server built to allow the PNF Shopify Store (UI) to interact with ReCharge API. It is a proxy (a “middleman”) between the UI and the ReCharge API.

Here’s the exhaustive explanation of how it works: 

1. The UI needs to be able to give the user a discount for each item added to their cart, other than the first item, but it should also allow them to provide their own discount code for promotions, sales, etc.

_ReCharge doesn’t support multiple discount codes, so we need to communicate with the ReCharge API to kind of “hack” multiple discounts to work. Essentially, we’re generating new discount codes “on the fly” that provide the user with combined quantity discount savings and promotional discount savings._

2. When a user submits a discount code, right before moving on to the ReCharge checkout, the UI sends the following data to pnf-services:

The  `totalPrice`  of the user’s cart, the total number of items in the user’s cart, aka `itemCount`, and the `discountCode`  provided by the user.

```
(Sample URL)

/api/mergeDiscounts?discountCode=WHOLE30&totalPrice=9998&itemCount=2
```

3. pnf-services check with ReCharge to see if the user submitted discount code is valid, and also if the necessary discount code for the quantity discount exists. (i.e if the user has 47 items in their cart, there needs to be a “BOX-OF-47” discount code available.)

4. If the necessary quantity discount code is **not** available (meaning it doesn’t exist), pnf-services will create one with the discount value set to $20 for each product _other than_ the first one.

5. If the user submitted discount code is valid, pnf-services will combine the quantity discount and the user submitted discount into one, creating a completely new code.

_Let’s say there are 8 items in the user’s cart and the user submitted discount code is for $30 off. The total discount value of the newly created discount code will be $30 + ($20 * (8 - 1))._

The code for the newly created discount will be the code submitted by the user (i.e “WHOLE30”) **plus** the code of the quantity discount required for their cart (i.e “BOX-OF-47”), separated by a hyphen. The end result would be  a variation of “WHOLE30-BOX-OF-47”.

The new discount will have the same start date, end date, duration, and other properties of the user submitted discount code, so it will expire at the same time, have the same rules for number of uses, etc.

6. pnf-server will then send the newly created discount code back to the UI and the UI can let the user know it worked and is applied to their cart. (Which it will be, once they click the CHECKOUT button and the UI redirects them to the ReCharge checkout.)
7. 
```
(Sample URL)

https://checkout.recharg.com/stuff?discount_code=WHOLE30-BOX-OF-47
```

6. If the user submitted discount code is **invalid**, pnf-services sends a message back to the UI, and the UI lets the user know the code did not work.

_This message also includes the necessary code needed to apply the quantity discount to the cart. So, if the user decides to skip the discount code (maybe it is expired but they were just trying it anyways), they click the CHECKOUT button and the UI sends them to the ReCharge checkout with only the quantity discount code applied._


- - - -


# Server URLs

## A simple overview of servers.
A server is basically just some code running on a computer _somewhere remote_.

A server is set up for your computer to send it a request and, depending on what your computer’s request says, it will respond accordingly.

Here is the simplest server on the planet: https://node-api.now-examples.now.sh/api/hello?name=PNF

![](pnf-services/Photo%20Sep%2027,%202020%20at%2071535%20PM.jpg)

Take a look at the last part of the URL: `?name=PNF`. You can change “PNF” to anything and this server would respond with “Hello <WHATEVER YOU PUT>!”

The `name`` part of the URL is called a parameter. (A “query parameter”, because these values are typically used to easily query a server for some data.)

Now, if you remove everything from the end of URL, starting at the “?” and you refresh the page, you’ll see “Hello World!”

This happens because the `name`  parameter is _optional_. If you don’t supply it, it defaults to “World”.

The code powering this server translates to English as: 

> When a request comes in, respond with ‘Hello ‘ + parameter `name` + ‘!’. If `name`  is not provided, use ‘World’ in its place.  

And this, ladies and gentlemen, is how browsers and apps talk to servers. 🧑🏽‍💻


- - - -

# pnf-services
pnf-services works similarly to how the “Hello World” server works.

You can use the URL to the server, along with some parameters, to give it instructions on what to do.

The following is the spec for all of the pnf-services URLs you can send requests to.


## /api/createDiscount

### Basic URL Sample

_This URL provides the required parameters (code and value) and nothing more._

```
https://pnf-services.tasteink.com/api/createDiscount?code=TEST-CODE&value=10
```

Detailed URL Sample

_This URL provides a more details to the server, which results in a more fine-tuned discount being created._

```
https://pnf-services.tasteink.com/api/createDiscount?code=TEST-CODE&value=10&start_date=2020-01-01&end_date=2020-12-31&discount_type=percentage
```


### Parameters

- [ ] `code` _required_

- [ ] `value`  _required_

- [ ] `duration = forever`

- [ ] `discount_type = fixed_amount`

- [ ]  `start_date = TODO`

- [ ] `end_date = TODO`



## /api/mergeDiscounts

### Parameters

- [ ] `discount_code`

- [ ] `itemCount`

- [ ] `totalPrice`



## /api/getDiscounts
Gets either a list of discounts or a single discount, based on the provided parameters.

When the  `code`  parameter is used, this endpoint will request the (1) discount from ReCharge that matches the code.

When the  `code`  parameter is not provided, the server will request all discounts from ReCharge, up to 250. The number of discounts retrieved from ReCharge can be controlled using the  `limit`  parameter, but can not exceed 250.

### Parameters 

- [ ] `code`

- [ ] `limit = 250`