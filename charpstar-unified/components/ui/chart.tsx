import * as React from "react";
import { Group } from "@visx/group";
import { Bar } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { scaleBand, scaleLinear } from "@visx/scale";

export interface BarChartProps {
  width: number;
  height: number;
  data: { x: string; y: number }[];
  xLabel?: string;
  yLabel?: string;
}

export function BarChart({
  width,
  height,
  data,
  xLabel,
  yLabel,
}: BarChartProps) {
  // bounds
  const xMax = width - 40;
  const yMax = height - 40;

  // scales
  const xScale = scaleBand({
    range: [0, xMax],
    domain: data.map((d) => d.x),
    padding: 0.2,
  });
  const yScale = scaleLinear({
    range: [yMax, 0],
    domain: [0, Math.max(...data.map((d) => d.y), 10)],
  });

  return (
    <svg width={width} height={height} className="bg-card rounded-md">
      <Group left={40} top={10}>
        {data.map((d, i) => (
          <Bar
            key={`bar-${d.x}`}
            x={xScale(d.x)}
            y={yScale(d.y)}
            width={xScale.bandwidth()}
            height={yMax - yScale(d.y)}
            fill="#14b8a6"
            rx={2}
          />
        ))}
        <AxisLeft scale={yScale} numTicks={4} stroke="#888" tickStroke="#888" />
        <AxisBottom
          top={yMax}
          scale={xScale}
          tickLabelProps={() => ({
            fill: "#888",
            fontSize: 10,
            textAnchor: "middle",
          })}
        />
        {yLabel && (
          <text
            x={-30}
            y={yMax / 2}
            fill="#888"
            fontSize={12}
            textAnchor="middle"
            transform={`rotate(-90, -30, ${yMax / 2})`}
          >
            {yLabel}
          </text>
        )}
        {xLabel && (
          <text
            x={xMax / 2}
            y={yMax + 30}
            fill="#888"
            fontSize={12}
            textAnchor="middle"
          >
            {xLabel}
          </text>
        )}
      </Group>
    </svg>
  );
}
