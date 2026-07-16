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
import type {
  Coordinate,
  IChartApiBase,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  SeriesPrimitivePaneViewZOrder,
  SeriesType,
  Time,
} from "lightweight-charts";
import styles from "./TradeCheckChart.module.css";

interface TradeCheckChartProps {
  chart: TradeCheckChartData;
  height?: number;
}

const DISPLAY_TRADING_DAYS = 30;
const RECENT_BARS_FOR_SCALE = 15;
const CHART_BACKGROUND = "#0f1419";
const PROJECTION_BAND_FILL = "rgba(56, 189, 248, 0.28)";
const PROJECTION_BAND_LINE = "rgba(56, 189, 248, 0.7)";
const PROJECTION_P50_COLOR = "#38bdf8";
const CLOSE_LINE_COLOR = "rgba(226, 232, 240, 0.85)";

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
  projection: TradeCheckProjectionPoint[],
): { min: number; max: number } {
  const recentBars = displayBars.slice(-RECENT_BARS_FOR_SCALE);
  const values: number[] = [];

  for (const bar of recentBars) {
    values.push(bar.open, bar.high, bar.low, bar.close);
  }
  for (const level of levels) {
    values.push(level.price);
  }
  for (const point of projection) {
    values.push(point.p50);
    if (point.p90High != null) {
      values.push(point.p90High);
    }
    if (point.p90Low != null) {
      values.push(point.p90Low);
    }
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

interface ProjectionBandDatum {
  time: Time;
  high: number;
  low: number;
}

interface BandScreenPoint {
  x: Coordinate;
  high: Coordinate;
  low: Coordinate;
}

type CanvasTarget = Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0];

/**
 * Renders the translucent fill + boundary strokes for the p90 range band.
 *
 * A single instance is cached on the primitive so lightweight-charts' internal
 * renderer cache (which compares by reference) keeps hitting across redraws.
 */
class ProjectionBandRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(
    private readonly chart: IChartApiBase<Time>,
    private readonly series: ISeriesApi<SeriesType, Time>,
    private readonly data: ProjectionBandDatum[],
    private readonly fillColor: string,
    private readonly lineColor: string,
  ) {}

  draw(target: CanvasTarget): void {
    if (this.data.length < 2) {
      return;
    }

    target.useMediaCoordinateSpace((scope) => {
      const ctx = scope.context;
      const timeScale = this.chart.timeScale();

      // Split into contiguous runs of on-screen points so an off-screen gap
      // never bridges the fill across a discontinuity while panning.
      let run: BandScreenPoint[] = [];
      const flush = () => {
        this.paintSegment(ctx, run);
        run = [];
      };

      for (const datum of this.data) {
        const x = timeScale.timeToCoordinate(datum.time);
        const high = this.series.priceToCoordinate(datum.high);
        const low = this.series.priceToCoordinate(datum.low);
        if (x === null || high === null || low === null) {
          flush();
          continue;
        }
        run.push({ x, high, low });
      }
      flush();
    });
  }

  private paintSegment(
    ctx: CanvasRenderingContext2D,
    points: BandScreenPoint[],
  ): void {
    if (points.length < 2) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].high);
    for (let index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index].x, points[index].high);
    }
    for (let index = points.length - 1; index >= 0; index -= 1) {
      ctx.lineTo(points[index].x, points[index].low);
    }
    ctx.closePath();
    ctx.fillStyle = this.fillColor;
    ctx.fill();

    ctx.strokeStyle = this.lineColor;
    ctx.lineWidth = 1;
    drawPolyline(ctx, points.map((point) => ({ x: point.x, y: point.high })));
    drawPolyline(ctx, points.map((point) => ({ x: point.x, y: point.low })));
  }
}

/**
 * Draws a translucent p90 range band between the low/high projection lines.
 *
 * A series primitive is used instead of stacked area series so the fill is
 * genuinely transparent: gridlines and the pane background stay visible through
 * the band rather than being painted over by an opaque mask.
 */
class ProjectionBandPrimitive implements ISeriesPrimitive<Time> {
  private renderer: ProjectionBandRenderer | null = null;
  private readonly paneViewList: ISeriesPrimitivePaneView[];

  constructor(
    private readonly data: ProjectionBandDatum[],
    private readonly fillColor: string,
    private readonly lineColor: string,
  ) {
    this.paneViewList = [
      {
        zOrder: (): SeriesPrimitivePaneViewZOrder => "bottom",
        renderer: (): ISeriesPrimitivePaneRenderer | null => this.renderer,
      },
    ];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.renderer = new ProjectionBandRenderer(
      param.chart,
      param.series,
      this.data,
      this.fillColor,
      this.lineColor,
    );
  }

  detached(): void {
    this.renderer = null;
  }

  updateAllViews(): void {}

  paneViews(): readonly ISeriesPrimitivePaneView[] {
    return this.paneViewList;
  }
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
): void {
  if (points.length < 2) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.stroke();
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
      const priceRange = computeVisiblePriceRange(
        displayBars,
        chart.levels,
        displayProjection,
      );
      const slotCount = displayBars.length + displayProjection.length + 2;

      container.replaceChildren();
      chartInstance = createChart(container, {
        width: container.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: CHART_BACKGROUND },
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

      const closeLineSeries = chartInstance.addLineSeries({
        color: CLOSE_LINE_COLOR,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        autoscaleInfoProvider,
      });
      closeLineSeries.setData(
        displayBars.map((bar) => ({
          time: bar.time,
          value: bar.close,
        })),
      );

      // Show only the right-axis annotation for each level; the horizontal
      // line across the chart was visual noise the user could not decode.
      for (const level of chart.levels) {
        candleSeries.createPriceLine({
          price: level.price,
          color: level.color,
          lineVisible: false,
          axisLabelVisible: true,
          axisLabelColor: level.color,
          axisLabelTextColor: CHART_BACKGROUND,
          title: level.label,
        });
      }

      if (displayProjection.length > 0) {
        // Only shade where both p90 bounds exist so the band never desyncs.
        const bandData: ProjectionBandDatum[] = displayProjection
          .filter((point) => point.p90High != null && point.p90Low != null)
          .map((point) => ({
            time: point.time,
            high: point.p90High as number,
            low: point.p90Low as number,
          }));

        if (bandData.length >= 2) {
          candleSeries.attachPrimitive(
            new ProjectionBandPrimitive(
              bandData,
              PROJECTION_BAND_FILL,
              PROJECTION_BAND_LINE,
            ),
          );
        }

        const p50Series = chartInstance.addLineSeries({
          color: PROJECTION_P50_COLOR,
          lineWidth: 1,
          lineStyle: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider: () => null,
        });
        p50Series.setData(
          displayProjection.map((point) => ({
            time: point.time,
            value: point.p50,
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
