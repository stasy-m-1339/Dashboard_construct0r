import { useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ECharts } from 'echarts';

type ChartHostProps = React.ComponentProps<typeof ReactECharts>;

type ChartRef = {
  getEchartsInstance: () => ECharts;
};

/**
 * ECharts fills its parent only after resize(). On F5 / grid restore the
 * container often gets its final size after the chart first paints — observe
 * the host and call resize after layout.
 */
export function ChartHost(props: ChartHostProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartRef | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const inst = chartRef.current?.getEchartsInstance?.();
          if (!inst) return;
          const { clientWidth: w, clientHeight: h } = host;
          if (w > 0 && h > 0) inst.resize({ width: w, height: h });
          else inst.resize();
        });
      });
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(host);
    resize();
    const t1 = window.setTimeout(resize, 50);
    const t2 = window.setTimeout(resize, 250);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const { style, onChartReady, className, opts, ...rest } = props;

  return (
    <div
      ref={hostRef}
      className={`chart-host${className ? ` ${className}` : ''}`}
      style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
    >
      <ReactECharts
        ref={chartRef as never}
        {...rest}
        style={{ width: '100%', height: '100%', ...(style || {}) }}
        opts={{ renderer: 'canvas', ...(opts || {}) }}
        onChartReady={(inst) => {
          onChartReady?.(inst);
          requestAnimationFrame(() => {
            const host = hostRef.current;
            if (host && host.clientWidth > 0 && host.clientHeight > 0) {
              inst.resize({ width: host.clientWidth, height: host.clientHeight });
            } else {
              inst.resize();
            }
          });
        }}
      />
    </div>
  );
}
