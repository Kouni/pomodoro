import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);

test("index.html pins the Vue version and SRI hash of the vendored build", () => {
    const html = readFileSync(
        new URL("../index.html", import.meta.url),
        "utf8"
    );
    const [, version] = html.match(
        /unpkg\.com\/vue@([\d.]+)\/dist\/vue\.global\.prod\.js/
    );
    const [, integrity] = html.match(/integrity="(sha384-[^"]+)"/);
    const build = readFileSync(require.resolve("vue/dist/vue.global.prod.js"));
    const expected = `sha384-${createHash("sha384").update(build).digest("base64")}`;
    assert.equal(version, require("vue/package.json").version);
    assert.equal(integrity, expected);
});
