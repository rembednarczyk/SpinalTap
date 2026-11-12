/**
 * The GUGiK sets of ADR-0077 for powiat 0663 (Lublin), CC BY 4.0, and the cache they are
 * downloaded to, outside the repo (only the compact extracts in `data/gugik/` are committed).
 */
import { homedir } from "node:os";
import { join } from "node:path";

export interface GugikSource {
  readonly key: "lod1" | "lod2" | "bdot";
  readonly url: string;
}

export const SOURCES: readonly GugikSource[] = [
  { key: "lod1", url: "https://opendata.geoportal.gov.pl/InneDane/Budynki3D/LOD1/2024/06/0663.zip" },
  { key: "lod2", url: "https://opendata.geoportal.gov.pl/InneDane/Budynki3D/LOD2/0663_gml.zip" },
  { key: "bdot", url: "https://opendata.geoportal.gov.pl/bdot10k/schemat2021/GPKG/06/0663_GPKG.zip" },
];

export const LICENSE = "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), Główny Urząd Geodezji i Kartografii";

export const CACHE_DIR = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "seki-gugik");
