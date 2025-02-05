"use client";
import { MarketBar } from "@/app/components/MarketBar";
import { SwapUI } from "@/app/components/SwapUI";
import { TradeView } from "@/app/components/TradeView";
import { Depth } from "@/app/components/depth/Depth";
import { SignalingManager } from "@/app/utils/SignalingManager";
import { getTrades } from "@/app/utils/httpClient";
import { Trade } from "@/app/utils/types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function Page() {
  const { market } = useParams();

  const [trades, setTrades] = useState<Trade[] | null>(null);

  useEffect(() => {
    getTrades(market as string).then(setTrades);
    SignalingManager.getInstance().registerCallback(
      "trade",
      (data: Trade) => {
        console.log(data);
        setTrades((prevTrade) => [data, ...(prevTrade ?? [])]);
      },
      `TRADE-${market}`
    );
    SignalingManager.getInstance().sendMessage({ method: "SUBSCRIBE", params: [`trade.${market}`] });

    return () => {
      SignalingManager.getInstance().deRegisterCallback("trade", `TRADE-${market}`);
      SignalingManager.getInstance().sendMessage({ method: "UNSUBSCRIBE", params: [`trade.${market}`] });
    };
  }, [market]);

  useEffect(() => {
    console.log(trades);
  }, [trades]);

  return (
    <div className="flex flex-row flex-1">
      <div className="flex flex-col flex-1">
        <MarketBar market={market as string} />
        <div className="flex flex-row h-[920px] border-y border-slate-800">
          <div className="flex flex-col flex-1">
            <TradeView market={market as string} />
          </div>
          <div className="flex flex-col w-[250px] overflow-hidden">
            <Depth market={market as string} />
          </div>
        </div>
      </div>
      <div className="w-[10px] flex-col border-slate-800 border-l"></div>
      <div>
        <div className="flex flex-col w-[250px]">
          <SwapUI market={market as string} />
        </div>
      </div>
    </div>
  );
}
