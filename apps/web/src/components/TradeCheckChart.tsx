/**
 * @file apps/web/src/components/TradeCheckChart.tsx
 * Candlestick chart with level overlays and statistical projection band.
 */

"use client";

import { useEffect, useRef } from "react";
import type { TradeCheckChart as TradeCheckChartData } from "@tradingagents/api-types";
import styles from "./TradeCheckChart.module.css";

interface TradeCheckChartProps {
  chart: TradeCheckChartData;
  height?: number;
}

export default function TradeCheckChart({ chart, height = 320 }: TradeCheckChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || chart.bars.length === 0) {
      return;
    }

    let disposed = false;
    let chartInstance: import("lightweight-charts").IChartApi | null = null;
    let resizeHandler: (() => void) | null = null;

    async function renderChart() {
      const { createChart, ColorType, CrosshairMode } = await import("lightweight-charts");
      if (disposed || !container) {
        return;
      }

      container.replaceChildren();
      chartInstance = createChart(container, {
        width: container.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "#0f1419" },
          textColor: "#cbd5e1",
        },
        grid: {
          vertLines: { color: "#1e293b" },
          horzLines: { color: "#1e293b" },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#334155" },
        timeScale: { borderColor: "#334155" },
      });

      const candleSeries = chartInstance.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      candleSeries.setData(
        chart.bars.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        })),
      );

      for (const level of chart.levels) {
        candleSeries.createPriceLine({
          price: level.price,
          color: level.color,
          lineWidth: 2,
          lineStyle: level.style === "dotted" ? 1 : 2,
          axisLabelVisible: true,
          title: level.label,
        });
      }

      if (chart.projection.length > 0) {
        const projectionSeries = chartInstance.addLineSeries({
          color: "#38bdf8",
          lineWidth: 2,
          lineStyle: 2,
          title: "p50 projection",
        });
        projectionSeries.setData(
          chart.projection.map((point) => ({
            time: point.time,
            value: point.p50,
          })),
        );

        const upper = chartInstance.addLineSeries({
          color: "rgba(56, 189, 248, 0.35)",
          lineWidth: 1,
          lineStyle: 2,
          title: "p90 high",
        });
        upper.setData(
          chart.projection
            .filter((point) => point.p90High != null)
            .map((point) => ({
              time: point.time,
              value: point.p90High as number,
            })),
        );

        const lower = chartInstance.addLineSeries({
          color: "rgba(56, 189, 248, 0.35)",
          lineWidth: 1,
          lineStyle: 2,
          title: "p90 low",
        });
        lower.setData(
          chart.projection
            .filter((point) => point.p90Low != null)
            .map((point) => ({
              time: point.time,
              value: point.p90Low as number,
            })),
        );
      }

      chartInstance.timeScale().fitContent();

      resizeHandler = () => {
        if (!container || !chartInstance) {
          return;
        }
        chartInstance.applyOptions({ width: container.clientWidth });
      };
      window.addEventListener("resize", resizeHandler);
    }

    void renderChart();

    return () => {
      disposed = true;
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      chartInstance?.remove();
    };
  }, [chart, height]);

  if (chart.bars.length === 0) {
    return (
      <div className={styles.empty} role="img" aria-label="Chart unavailable">
        Price chart unavailable — market data could not be loaded for this ticker/date.
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.chart} aria-label="Price chart with trade levels" />
      {chart.legend.length > 0 && (
        <ul className={styles.legend}>
          {chart.legend.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
