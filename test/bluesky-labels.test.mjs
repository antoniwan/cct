import assert from "node:assert/strict";
import test from "node:test";

import { assertBlueskyCommandLabelsInSyncWithRouter } from "../dist/core/bluesky-commands.js";

test("bluesky command label keys match commandTree (menu drift guard)", () => {
  assert.doesNotThrow(() => assertBlueskyCommandLabelsInSyncWithRouter());
});
