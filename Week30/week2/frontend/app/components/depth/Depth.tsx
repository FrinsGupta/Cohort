"use client";

import { useEffect, useState } from "react";
import { getDepth, getKlines, getTicker, getTrades } from "../../utils/httpClient";
import { BidTable } from "./BidTable";
import { AskTable } from "./AskTable";
import { SignalingManager } from "../../utils/SignalingManager";
import { Ticker } from "../../utils/types";

export function Depth({ market }: { market: string }) {
  const [bids, setBids] = useState<[string, string][]>();
  const [asks, setAsks] = useState<[string, string][]>();
  const [ticker, setTicker] = useState<string>();

  useEffect(() => {
    //DEPTH
    SignalingManager.getInstance().registerCallback(
      "depth",
      (data: any) => {
        // console.log(data);
        
        setBids((originalBids) => {
          const bidsAfterUpdate = [...(originalBids || [])];

          for (let i = 0; i < bidsAfterUpdate.length; i++) {
            for (let j = 0; j < data.bids.length; j++) {
              if (bidsAfterUpdate[i][0] === data.bids[j][0]) {
                bidsAfterUpdate[i][1] = data.bids[j][1];

                if (Number(bidsAfterUpdate[i][1]) === 0) {
                  bidsAfterUpdate.splice(i, 1);
                }
                break;
              }
            }
          }

          for (let j = 0; j < data.bids.length; j++) {
            if (Number(data.bids[j][1]) !== 0 && !bidsAfterUpdate.map((x) => x[0]).includes(data.bids[j][0])) {
              bidsAfterUpdate.push(data.bids[j]);
              break;
            }
          }
          bidsAfterUpdate.sort((x, y) => (Number(y[0]) > Number(x[0]) ? -1 : 1)).reverse();
          return bidsAfterUpdate;
        });

        setAsks((originalAsks) => {
          const asksAfterUpdate = [...(originalAsks || [])];

          for (let i = 0; i < asksAfterUpdate.length; i++) {
            for (let j = 0; j < data.asks.length; j++) {
              if (asksAfterUpdate[i][0] === data.asks[j][0]) {
                asksAfterUpdate[i][1] = data.asks[j][1];
                if (Number(asksAfterUpdate[i][1]) === 0) {
                  asksAfterUpdate.splice(i, 1);
                  i--;
                }
                break;
              }
            }
          }

          for (let j = 0; j < data.asks.length; j++) {
            if (Number(data.asks[j][1]) !== 0 && !asksAfterUpdate.map((x) => x[0]).includes(data.asks[j][0])) {
              asksAfterUpdate.push(data.asks[j]);
              break;
            }
          }
          asksAfterUpdate.sort((x, y) => (Number(y[0]) > Number(x[0]) ? 1 : -1)).reverse();
          return asksAfterUpdate;
        });
      },
      `DEPTH-${market}`
    );

    SignalingManager.getInstance().sendMessage({ method: "SUBSCRIBE", params: [`depth.${market}`] });

    getDepth(market).then((d) => {
      // console.log(d);
      
      setBids(d.bids.reverse());
      setAsks(d.asks);
    });


    // TICKER
    getTicker(market).then((ticker) => setTicker(ticker.lastPrice)); // MySelft Task: To directly import ticker from MarketBar
    SignalingManager.getInstance().registerCallback(
      "ticker",
      // (data: Partial<Ticker>) => setTicker((prevTicker) => data?.lastPrice ?? prevTicker ?? ""),
      (data: Ticker) => setTicker((prevTicker) => data?.lastPrice ?? prevTicker ?? ""),
      `TICKER-${market}`
    );
    SignalingManager.getInstance().sendMessage({ method: "SUBSCRIBE", params: [`ticker.${market}`] });

    // TRADES
    // getTrades(market).then(t => setPrice(t[0].price));

    return () => {
      //Unsubscribing DEPTH
      SignalingManager.getInstance().sendMessage({ method: "UNSUBSCRIBE", params: [`depth.${market}`] });
      SignalingManager.getInstance().deRegisterCallback("depth", `DEPTH-${market}`);

      //Unsubscribing TICKER
      SignalingManager.getInstance().deRegisterCallback("ticker", `TICKER-${market}`);
      SignalingManager.getInstance().sendMessage({ method: "UNSUBSCRIBE", params: [`ticker.${market}`] });
    };
  }, [market]);

  // useEffect(() => {
  //     console.log("bids have been updated:", bids);
  //   }, [bids]);

  return (
    <div>
      <TableHeader />
      {asks && <AskTable asks={asks} />}
      {ticker && <div>{ticker}</div>}
      {bids && <BidTable bids={bids} />}
    </div>
  );
}

function TableHeader() {
  return (
    <div className="flex justify-between text-xs">
      <div className="text-white">Price</div>
      <div className="text-slate-500">Size</div>
      <div className="text-slate-500">Total</div>
    </div>
  );
}
