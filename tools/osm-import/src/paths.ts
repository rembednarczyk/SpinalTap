import { fileURLToPath } from "node:url";

/** Repository root: the importer lives in `tools/osm-import/src`. */
export const REPO = fileURLToPath(new URL("../../../", import.meta.url));
