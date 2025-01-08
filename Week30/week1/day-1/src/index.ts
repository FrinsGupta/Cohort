import express from 'express';
import { orderInputSchema } from './types';
import {orderbook, bookWithQuantity} from './orderbook'


const BASE_ASSET = 'BTC';
const QUOTE_ASSET = 'USD';

const app = express();

app.use(express.json());

let GLOBAL_TRADE_ID = 0;

app.post('/api/v1/order', (req, res) => {
    const order = orderInputSchema.safeParse(req.body);
    if (!order.success) {
        res.status(400).send(order.error.message)
        return;
    }

    const {baseAsset, quoteAsset, price, quantity, side, kind } = order.data 
    const orderId = getOrderId();

    if (baseAsset!== BASE_ASSET || quoteAsset !== QUOTE_ASSET) {
        res.status(400).send('Invalid base or qoute asset')
        return;
    }

    res.send({
        orderId
    })

})

interface Fill {
    'price': number,
    'qty': number,
    'tradeId': number
}

function fillOrder(orderId: string, price: number, quantity: number, side: 'buy' | 'sell', type?:'ioc'):{status: 'accepted' | 'rejected', executedQuantity: number, fills: Fill[]}{
    const fills: Fill[] = [];
    const maxFillQuantity = getFillAmount(price, quantity, side);
    let executedQuantity = 0;

    if (type ==='ioc' && maxFillQuantity < quantity) {
        return {status: 'rejected', executedQuantity: maxFillQuantity, fills: []};
    }

    if (side === 'buy') {
        orderbook.asks.forEach(o => {
            if (o.price < price && quantity > 0) {
                const filledQuantity = Math.min(quantity, o.quantity);

                executedQuantity += filledQuantity;
                quantity -= filledQuantity;
                o.quantity -= filledQuantity; // updating orderbook
                bookWithQuantity.asks[o.price] = (bookWithQuantity.asks[o.price] || 0) - filledQuantity;  // updating bookWithQuantity

                fills.push({
                    price: o.price,
                    qty: filledQuantity,
                    tradeId: GLOBAL_TRADE_ID++
                })

                if (o.quantity === 0) {
                    orderbook.asks.splice(orderbook.asks.indexOf(o),1); // deleting from orderbook when that asks quantity becomes o
                }
                if (bookWithQuantity.asks[price] === 0) {  // deleting from bookWithQuantity object when that asks quantity becomes 0
                    delete bookWithQuantity.asks[price];
                }
            }
            if (quantity !==0) {
                orderbook.bids.push({
                    price,
                    quantity: quantity - executedQuantity,
                    side: 'bid',
                    orderId
                })
                bookWithQuantity.bids[price] = (bookWithQuantity.bids[price] || 0) + (quantity - executedQuantity)
            }
        })
    } else {
        orderbook.bids.forEach(o => {
            if (o.price > price && quantity > 0) {
                const filledQuantity = Math.min(quantity, o.quantity)

                quantity -= filledQuantity;
                o.quantity -= filledQuantity;
                executedQuantity += filledQuantity;
                bookWithQuantity.bids[o.price] = (bookWithQuantity.bids[o.price] || 0) - filledQuantity;

                fills.push({
                    price: o.price,
                    qty: o.quantity,
                    tradeId: GLOBAL_TRADE_ID++
                })

                if (o.quantity === 0) {
                    orderbook.bids.splice(orderbook.bids.indexOf(o),1)
                }

                if (bookWithQuantity.bids[price] === 0) {
                    delete bookWithQuantity.bids[price]
                }
            }
        })

        if (quantity !== 0) {
            orderbook.asks.push({
                price,
                quantity: quantity - executedQuantity,
                side: 'ask',
                orderId
            })
            bookWithQuantity.asks[price] = (bookWithQuantity.asks[price] || 0) + (quantity - executedQuantity)
        }
    }

return {
    status: 'accepted',
    executedQuantity,
    fills
}
}

function getFillAmount (price: number, quantity: number, side: 'buy' | 'sell'): number {
  let filled = 0;

  if (side === 'buy') {
    orderbook.asks.forEach(o =>{
        if (o.price < price) {
            filled += Math.min(quantity, o.quantity)
        }
        // else{
        //     return filled; // my logic
        // }
    })
  } else {
    orderbook.bids.forEach(o => {
        if (o.price > price) {
            filled += Math.min(quantity, o.quantity)
        }
        // else {
        //     return filled; // my logic
        // }
    })
  }
  return filled;
}

app.listen(3000,()=> {
    console.log("Server started at port 3000");
})

function getOrderId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}