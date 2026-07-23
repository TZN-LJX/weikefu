import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  TickMarkType,
  createChart,
  createSeriesMarkers,
  type BarData,
  type HistogramData,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '../pack/contentSchema'
import { formatBeijingCrosshair, formatBeijingTick } from './chartTime'

type MarketChartProps = {
  candles: Candle[]
  annotations?: { time: number; label: string; description?: string }[]
}

export function MarketChart({ candles, annotations = [] }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

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
      localization: {
        locale: 'zh-CN',
        timeFormatter: formatBeijingCrosshair,
        dateFormat: 'yyyy-MM-dd',
      },
      grid: {
        vertLines: { color: '#253239' },
        horzLines: { color: '#253239' },
      },
      rightPriceScale: { borderColor: '#34434b' },
      timeScale: {
        borderColor: '#34434b',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => formatBeijingTick(time, tickMarkType),
      },
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
    createSeriesMarkers(candleSeries, annotations.map((annotation) => ({
      time: annotation.time as UTCTimestamp,
      position: 'aboveBar' as const,
      shape: 'square' as const,
      color: '#d7a83b',
      text: annotation.label,
      size: 1.2,
      id: annotation.label,
    })))
    chart.timeScale().fitContent()

    const handleCrosshairMove = (parameter: Parameters<Parameters<typeof chart.subscribeCrosshairMove>[0]>[0]) => {
      const tooltip = tooltipRef.current
      if (!tooltip || !parameter.time || !parameter.point) {
        if (tooltip) tooltip.hidden = true
        return
      }
      const price = parameter.seriesData.get(candleSeries) as BarData<UTCTimestamp> | undefined
      const volume = parameter.seriesData.get(volumeSeries) as HistogramData<UTCTimestamp> | undefined
      if (!price || !('open' in price)) {
        tooltip.hidden = true
        return
      }
      tooltip.textContent = [
        formatBeijingCrosshair(parameter.time),
        `开 ${price.open.toFixed(2)}  高 ${price.high.toFixed(2)}`,
        `低 ${price.low.toFixed(2)}  收 ${price.close.toFixed(2)}`,
        `成交量 ${volume?.value.toLocaleString('zh-CN', { maximumFractionDigits: 3 }) ?? '-'}`,
      ].join('\n')
      tooltip.hidden = false
    }
    chart.subscribeCrosshairMove(handleCrosshairMove)

    const resize = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: Math.floor(entry.contentRect.width) })
    })
    resize.observe(container)
    return () => {
      resize.disconnect()
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
      chart.remove()
    }
  }, [annotations, candles])

  return <div className="market-chart-wrap" data-annotation-count={annotations.length}>
    <div className="market-chart" ref={containerRef} aria-label="ETH K线与成交量图表" />
    <div className="market-chart-tooltip" ref={tooltipRef} hidden aria-live="polite" />
  </div>
}
