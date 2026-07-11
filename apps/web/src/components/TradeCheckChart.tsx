/**
 * @file apps/web/src/components/TradeCheckChart.tsx
 * Candlestick chart with level overlays and statistical projection band.
 */

"use client";

import { useEffect, useRef } from "react";
import type {
  TradeCheckChart as TradeCheckChartData,
  TradeCheckChartLevel,
  TradeCheckOhlcvBar,
  TradeCheckProjectionPoint,
} from "@tradingagents/api-types";
import styles from "./TradeCheckChart.module.css";

interface TradeCheckChartProps {
  chart: TradeCheckChartData;
  height?: number;
}

const DISPLAY_TRADING_DAYS = 30;
const RECENT_BARS_FOR_SCALE = 15;

function formatPrice(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compareBarTime(left: string, right: string): number {
  return left.localeCompare(right);
}

function selectDisplayBars(chart: TradeCheckChartData): TradeCheckOhlcvBar[] {
  const sortedBars = [...chart.bars].sort((left, right) =>
    compareBarTime(left.time, right.time),
  );
  if (sortedBars.length <= DISPLAY_TRADING_DAYS) {
    return sortedBars;
  }
  return sortedBars.slice(-DISPLAY_TRADING_DAYS);
}

function selectDisplayProjection(
  chart: TradeCheckChartData,
  lastBarTime: string,
): TradeCheckProjectionPoint[] {
  const seenTimes = new Set<string>();

  return [...chart.projection]
    .filter((point) => compareBarTime(point.time, lastBarTime) > 0)
    .sort((left, right) => compareBarTime(left.time, right.time))
    .filter((point) => {
      if (seenTimes.has(point.time)) {
        return false;
      }
      seenTimes.add(point.time);
      return true;
    })
    .slice(0, 5);
}

function computeVisiblePriceRange(
  displayBars: TradeCheckOhlcvBar[],
  levels: TradeCheckChartLevel[],
): { min: number; max: number } {
  const recentBars = displayBars.slice(-RECENT_BARS_FOR_SCALE);
  const values: number[] = [];

  for (const bar of recentBars) {
    values.push(bar.open, bar.high, bar.low, bar.close);
  }
  for (const level of levels) {
    values.push(level.price);
  }

  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, max * 0.02);
  const padding = span * 0.14;

  return {
    min: min - padding,
    max: max + padding,
  };
}

function renderPrintFallback(chart: TradeCheckChartData) {
  const displayBars = selectDisplayBars(chart);
  const lastBar = displayBars[displayBars.length - 1];
  const recentBars = displayBars.slice(-5);

  return (
    <div className={styles.printFallback} aria-hidden="true">
      {lastBar ? (
        <p className={styles.printSummary}>
          Latest close {formatPrice(lastBar.close)} on {lastBar.time}
          {" · "}
          Range {formatPrice(lastBar.low)} – {formatPrice(lastBar.high)}
        </p>
      ) : null}
      {recentBars.length > 0 ? (
        <table className={styles.printTable}>
          <caption>Recent price action (print fallback)</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Open</th>
              <th scope="col">High</th>
              <th scope="col">Low</th>
              <th scope="col">Close</th>
            </tr>
          </thead>
          <tbody>
            {recentBars.map((bar) => (
              <tr key={bar.time}>
                <td>{bar.time}</td>
                <td>{formatPrice(bar.open)}</td>
                <td>{formatPrice(bar.high)}</td>
                <td>{formatPrice(bar.low)}</td>
                <td>{formatPrice(bar.close)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {chart.levels.length > 0 ? (
        <table className={styles.printTable}>
          <caption>Chart levels (print fallback)</caption>
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col">Price</th>
            </tr>
          </thead>
          <tbody>
            {chart.levels.map((level) => (
              <tr key={`${level.label}-${level.price}`}>
                <td>{level.label}</td>
                <td>{formatPrice(level.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export default function TradeCheckChart({
  chart,
  height = 360,
}: TradeCheckChartProps) {
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
      const { createChart, ColorType, CrosshairMode } =
        await import("lightweight-charts");
      if (disposed || !container) {
        return;
      }

      const displayBars = selectDisplayBars(chart);
      if (displayBars.length === 0) {
        return;
      }

      const lastBarTime = displayBars[displayBars.length - 1].time;
      const displayProjection = selectDisplayProjection(chart, lastBarTime);
      const priceRange = computeVisiblePriceRange(displayBars, chart.levels);
      const slotCount = displayBars.length + displayProjection.length + 2;

      container.replaceChildren();
      chartInstance = createChart(container, {
        width: container.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "#0f1419" },
          textColor: "#cbd5e1",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "#1e293b" },
          horzLines: { color: "#1e293b" },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: "#334155",
          autoScale: true,
          scaleMargins: { top: 0.08, bottom: 0.08 },
        },
        timeScale: {
          borderColor: "#334155",
          fixLeftEdge: true,
          fixRightEdge: true,
          rightOffset: 2,
          barSpacing: Math.min(
            18,
            Math.max(8, (container.clientWidth - 72) / slotCount),
          ),
          minBarSpacing: 6,
        },
        watermark: {
          visible: false,
        },
      });

      const autoscaleInfoProvider = () => ({
        priceRange: {
          minValue: priceRange.min,
          maxValue: priceRange.max,
        },
      });

      const candleSeries = chartInstance.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
        autoscaleInfoProvider,
      });

      candleSeries.setData(
        displayBars.map((bar) => ({
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

      if (displayProjection.length > 0) {
        const projectionSeries = chartInstance.addLineSeries({
          color: "#38bdf8",
          lineWidth: 2,
          lineStyle: 2,
          title: "p50 projection",
          priceLineVisible: false,
          lastValueVisible: false,
          autoscaleInfoProvider: () => null,
        });
        projectionSeries.setData(
          displayProjection.map((point) => ({
            time: point.time,
            value: point.p50,
          })),
        );

        const upper = chartInstance.addLineSeries({
          color: "rgba(56, 189, 248, 0.35)",
          lineWidth: 1,
          lineStyle: 2,
          title: "p90 high",
          priceLineVisible: false,
          lastValueVisible: false,
          autoscaleInfoProvider: () => null,
        });
        upper.setData(
          displayProjection
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
          priceLineVisible: false,
          lastValueVisible: false,
          autoscaleInfoProvider: () => null,
        });
        lower.setData(
          displayProjection
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
        const nextSlotCount = displayBars.length + displayProjection.length + 2;
        chartInstance.applyOptions({
          width: container.clientWidth,
          timeScale: {
            barSpacing: Math.min(
              18,
              Math.max(8, (container.clientWidth - 72) / nextSlotCount),
            ),
          },
        });
        chartInstance.timeScale().fitContent();
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
        Price chart unavailable — market data could not be loaded for this
        ticker/date.
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div
        ref={containerRef}
        className={styles.chart}
        aria-label="Price chart with trade levels"
      />
      {renderPrintFallback(chart)}
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
