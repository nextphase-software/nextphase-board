// SPDX-License-Identifier: Apache-2.0
import * as Canvas from "react-konva";
const { Arc, Circle, Group, Image, Path, Rect, Text } = Canvas;
import type { LinkItem } from "nextphase-board-rules/document.ts";
import { cardLines, faceLayout, LINK_LOOK as lookValues, linkLook } from "../link-cards.ts";

type TextBox = NonNullable<ReturnType<typeof faceLayout>["title"]>;
type Font = typeof lookValues.title | typeof lookValues.description | typeof lookValues.site | typeof lookValues.address;

function insideText(value: string, box: TextBox, font: Font, underline = false) {
  const oneLine = box.height <= font.line;
  const context = underline ? document.createElement("canvas").getContext("2d") : null;
  let line = value, lineWidth = 0, underlineY = 0;
  if (context) {
    context.font = `${font.style} ${font.size}px ${lookValues.fontFamily}`;
    const width = (text: string) => context.measureText(text).width;
    if (width(line) > box.width) {
      const chars = Array.from(value);
      while (chars.length && width(chars.join("") + "…") > box.width) chars.pop();
      line = chars.join("") + "…";
    }
    const metrics = context.measureText(line);
    lineWidth = Math.min(box.width, metrics.width);
    underlineY = box.y + font.line / 2 + (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + 2;
  }
  return <>
    <Text {...box} text={line} fontFamily={lookValues.fontFamily} fontStyle={font.style}
      fontSize={font.size} fill={font.color} lineHeight={font.line / font.size} wrap={oneLine ? "none" : "word"} ellipsis />
    {underline && lineWidth > 0 && <Rect x={box.x} y={underlineY} width={lineWidth} height={1} fill={font.color} />}
  </>;
}

function crop(bitmap: ImageBitmap, width: number, height: number) {
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const w = width / scale, h = height / scale;
  return { x: (bitmap.width - w) / 2, y: (bitmap.height - h) / 2, width: w, height: h };
}

export function LinkBody({ object, bitmap, selected, zoom }: { object: LinkItem; bitmap?: ImageBitmap; selected: boolean; zoom: number }) {
  const { x, y, width, height } = object;
  const look = linkLook(object, Date.now());
  const face = faceLayout(look, width, height, cardLines(object));
  const frame = lookValues.frame;
  const spin = lookValues.spinner;
  return <Group x={x} y={y}>
    <Rect width={width} height={height} cornerRadius={frame.radius} fill={frame.fill} />
    <Group clipFunc={context => {
      const { x, y, width, height } = face.inner;
      context.roundRect(x, y, width, height, lookValues.innerRadius);
    }}>
      {face.picture && (bitmap && look !== "loading"
        ? <Image {...face.picture} image={bitmap} crop={crop(bitmap, face.picture.width, face.picture.height)} />
        : <Rect {...face.picture} fill={lookValues.placeholder} />)}
      {face.divider && <Rect {...face.divider} fill={lookValues.separator} />}
      {face.spinner && <>
        <Circle {...face.spinner} radius={spin.radius} strokeWidth={spin.strokeWidth} stroke={spin.ring} />
        <Arc {...face.spinner} innerRadius={spin.radius - spin.strokeWidth / 2} outerRadius={spin.radius + spin.strokeWidth / 2}
          angle={90} rotation={-135} fill={spin.arc} />
      </>}
      {face.bars?.map(part => <Rect key={part.y} {...part} fill={lookValues.skeleton.fill} cornerRadius={lookValues.skeleton.radius} />)}
      {face.title && insideText(object.title, face.title, lookValues.title)}
      {face.description && object.description && insideText(object.description, face.description, lookValues.description)}
      {face.glyph && lookValues.glyph.paths.map(data => <Path key={data} {...face.glyph} data={data}
        scaleX={14 / 24} scaleY={14 / 24} stroke={lookValues.glyph.stroke} strokeWidth={2} lineCap="round" />)}
      {face.site && insideText(object.site, face.site, lookValues.site, true)}
      {face.address && insideText(object.url, face.address, lookValues.address, true)}
    </Group>
    <Rect x={.5} y={.5} width={width - 1} height={height - 1} cornerRadius={7.5} strokeWidth={1} stroke={frame.stroke} />
    {selected && <Rect width={width} height={height} strokeWidth={2 / zoom} stroke={lookValues.outline} />}
  </Group>;
}
