import { describe, expect, it } from "vitest";
import { type Dtm, dtmAtGrid, dtmFromBytes, dtmToBytes, encodeHeight, latticeAt } from "../src/dtm.ts";
import { assembleRings } from "../src/features.ts";
import { readGeoTiff } from "../src/geotiff.ts";
import { filterOsm, parseExtract, parseOsmXml, serializeOsm } from "../src/osm.ts";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
 <node id="1" visible="true" version="2" user="a" lat="51.2480" lon="22.5600"/>
 <node id="2" lat="51.2480" lon="22.5610"/>
 <node id="3" lat="51.2490" lon="22.5610"/>
 <node id="4" lat="51.2490" lon="22.5600">
  <tag k="name" v="Caf&#233; &amp; Bar"/>
  <tag k="amenity" v="cafe"/>
  <tag k="opening_hours" v="24/7"/>
 </node>
 <node id="5" lat="51.25" lon="22.57"/>
 <way id="10" version="3">
  <nd ref="1"/>
  <nd ref="2"/>
  <nd ref="3"/>
  <nd ref="4"/>
  <nd ref="1"/>
  <tag k="building" v="yes"/>
  <tag k="source" v="survey"/>
 </way>
 <way id="11">
  <nd ref="5"/>
  <tag k="barrier" v="fence"/>
 </way>
 <relation id="20">
  <member type="way" ref="10" role="outer"/>
  <tag k="type" v="route"/>
 </relation>
</osm>`;

describe("OSM data", () => {
  it("parses the API's XML with entities", () => {
    const d = parseOsmXml(XML);
    expect(d.nodes.size).toBe(5);
    expect(d.nodes.get(4)!.tags!.name).toBe("Café & Bar");
    expect(d.ways.get(10)!.nodes).toEqual([1, 2, 3, 4, 1]);
    expect(d.relations.get(20)!.members[0]).toEqual({ type: "way", ref: 10, role: "outer" });
  });

  it("keeps only what the generator reads and round-trips the extract", () => {
    const f = filterOsm(parseOsmXml(XML));
    expect([...f.ways.keys()]).toEqual([10]);
    expect(f.ways.get(10)!.tags).toEqual({ building: "yes" });
    expect(f.relations.size).toBe(0);
    expect(f.nodes.has(5)).toBe(false);
    expect(f.nodes.get(4)!.tags).toEqual({ amenity: "cafe", name: "Café & Bar" });
    const text = serializeOsm(f, { test: true });
    const back = parseExtract(text);
    expect(serializeOsm(back, { test: true })).toBe(text);
  });

  it("keeps walls for the scan's steps between walls (G-203), not fences", () => {
    const xml = XML.replace('<tag k="barrier" v="fence"/>', '<tag k="barrier" v="wall"/>');
    const f = filterOsm(parseOsmXml(xml));
    expect(f.ways.get(11)!.tags).toEqual({ barrier: "wall" });
    expect(f.nodes.has(5)).toBe(true);
    expect(filterOsm(parseOsmXml(xml.replace('v="wall"', 'v="retaining_wall"'))).ways.has(11)).toBe(true);
  });

  it("assembles multipolygon rings from pieces in any direction", () => {
    expect(assembleRings([[1, 2, 3], [5, 4, 3], [5, 1]])).toEqual([[1, 2, 3, 4, 5, 1]]);
    expect(assembleRings([[1, 2, 3]])).toEqual([]);
  });
});

/** A little-endian float32 TIFF of `w` × `h`, in one strip, with the GeoTIFF tags GUGiK writes. */
const tiff = (w: number, h: number, e0: number, n0: number, values: number[]): Uint8Array => {
  const entries: [number, number, number, number[]][] = [
    [256, 3, 1, [w]],
    [257, 3, 1, [h]],
    [258, 3, 1, [32]],
    [259, 3, 1, [1]],
    [273, 4, 1, [0]],
    [277, 3, 1, [1]],
    [278, 3, 1, [h]],
    [339, 3, 1, [3]],
    [33550, 12, 3, [1, 1, 0]],
    [33922, 12, 6, [0, 0, 0, e0, n0, 0]],
  ];
  const ifd = 8;
  const extra = ifd + 2 + entries.length * 12 + 4;
  const doubles = entries.filter((e) => e[1] === 12);
  const dataAt = extra + doubles.reduce((s, e) => s + e[2] * 8, 0);
  const buf = new ArrayBuffer(dataAt + values.length * 4);
  const dv = new DataView(buf);
  dv.setUint8(0, 0x49);
  dv.setUint8(1, 0x49);
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifd, true);
  dv.setUint16(ifd, entries.length, true);
  let at = extra;
  entries.forEach(([tag, type, n, vals], i) => {
    const e = ifd + 2 + i * 12;
    dv.setUint16(e, tag, true);
    dv.setUint16(e + 2, type, true);
    dv.setUint32(e + 4, n, true);
    if (type === 12) {
      dv.setUint32(e + 8, at, true);
      vals.forEach((v, k) => dv.setFloat64(at + k * 8, v, true));
      at += n * 8;
    } else if (tag === 273) dv.setUint32(e + 8, dataAt, true);
    else if (type === 3) dv.setUint16(e + 8, vals[0]!, true);
    else dv.setUint32(e + 8, vals[0]!, true);
  });
  values.forEach((v, k) => dv.setFloat32(dataAt + k * 4, v, true));
  return new Uint8Array(buf);
};

describe("terrain model", () => {
  it("reads an uncompressed float32 GeoTIFF", () => {
    const r = readGeoTiff(tiff(3, 2, 748300, 381900, [1, 2, 3, 4, 5, 6]));
    expect(r).toMatchObject({ width: 3, height: 2, e0: 748300, n0: 381900, step: 1 });
    expect([...r.values]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => readGeoTiff(new Uint8Array([0, 0, 0, 0]))).toThrow();
  });

  it("stores heights in decimetres and interpolates them on the grid", () => {
    expect(encodeHeight(195.84)).toBe(958);
    expect(encodeHeight(Number.NaN)).toBe(0);
    const cells = dtmFromBytes(dtmToBytes(Uint16Array.from([950, 960, 970, 980])));
    const d: Dtm = {
      header: { source: "t", crs: "EPSG:2180", vertical: "t", e0: 0, n0: 2, cols: 2, rows: 2, step: 1, offset: 100, scale: 0.1 },
      cells,
    };
    // Pixel centres: (0.5, 1.5) 195, (1.5, 1.5) 196, (0.5, 0.5) 197, (1.5, 0.5) 198.
    expect(dtmAtGrid(d, { e: 0.5, n: 1.5 })).toBeCloseTo(195, 9);
    expect(dtmAtGrid(d, { e: 1, n: 1 })).toBeCloseTo(196.5, 9);
    expect(dtmAtGrid(d, { e: 5, n: 1 })).toBeNaN();
  });

  it("interpolates the EU-DEM fallback lattice", () => {
    const l = { source: "t", originX: 0, originZ: 0, step: 25, cols: 2, rows: 2, heights: [180, 190, 200, 210] };
    expect(latticeAt(l, { x: 12.5, z: 12.5 })).toBeCloseTo(195, 9);
  });
});
