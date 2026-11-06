// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import { validate } from "json-schema";
import { getValidatorSchema } from "./ValidatorSchema";

describe("getValidatorSchema", () => {
  it("validates without writing schema defaults into the content", () => {
    const schema: any = {
      type: "array",
      items: {
        type: "object",
        properties: { volume: { type: "number", default: 1 }, default: { type: "string" } },
      },
    };

    const adapted: any = getValidatorSchema(schema);
    assert.property(adapted.items.properties, "default");

    const content = [{ name: "sounds/foo" }];
    validate(content as any, adapted);
    assert.deepEqual(content, [{ name: "sounds/foo" }]);
  });

  it("does not report an optional object with a required list as missing", () => {
    const schema: any = {
      type: "object",
      properties: {
        uv_anim: { type: "object", required: ["offset", "scale"] },
        required: { type: "string", required: true },
      },
    };

    const adapted: any = getValidatorSchema(schema);
    assert.property(adapted.properties, "required");

    assert.isTrue(validate({ required: "x" } as any, adapted).valid);
    assert.isFalse(validate({} as any, adapted).valid);
  });
});
