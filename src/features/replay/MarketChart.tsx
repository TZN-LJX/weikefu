import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '../pack/contentSchema'

type MarketChartProps = {
  candles: Candle[]
}

export function MarketChart({ candles }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 330,
      layout: {
        background: { type: ColorType.Solid, color: '#111a1f' },
        textColor: '#9eabb1',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#253239' },
        horzLines: { color: '#253239' },
      },
      rightPriceScale: { borderColor: '#34434b' },
      timeScale: { borderColor: '#34434b', timeVisible: true },
      crosshair: { vertLine: { color: '#697a82' }, horzLine: { color: '#697a82' } },
    })
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#2b9b7f',
      downColor: '#bd5358',
      wickUpColor: '#2b9b7f',
      wickDownColor: '#bd5358',
      borderVisible: false,
      priceScaleId: 'right',
    })
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } })
    candleSeries.setData(candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })))
    volumeSeries.setData(candles.map((candle) => ({
      time: candle.time as UTCTimestamp,
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(43,155,127,.55)' : 'rgba(189,83,88,.55)',
    })))
    chart.timeScale().fitContent()

    const resize = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: Math.floor(entry.contentRect.width) })
    })
    resize.observe(container)
    return () => {
      resize.disconnect()
      chart.remove()
    }
  }, [candles])

  return <div className="market-chart" ref={containerRef} aria-label="ETH K线与成交量图表" />
}
