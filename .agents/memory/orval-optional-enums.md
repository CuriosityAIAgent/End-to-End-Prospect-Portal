---
name: Orval optional vs nullable enums
description: Why DB null must be mapped to undefined for non-required enum $ref response fields in this OpenAPI/Orval/Zod stack.
---

When an OpenAPI property is an enum referenced via `$ref` and is NOT listed in the schema's `required`, Orval generates the Zod validator as `.enum([...]).optional()` — i.e. it accepts `undefined`, NOT `null`. Plain string properties typed `["string","null"]` become `.nullish()` and accept both.

**Why:** A nullable DB column returns `null`, but an `.optional()` (not `.nullish()`) Zod field rejects `null`, so `Response.parse(row)` throws a 500 even though the data is valid.

**How to apply:** In route handlers, before calling `<Op>Response.parse(row)`, map nullable enum columns from `null` to `undefined` (a small `serialize` helper). Alternatively, make the field nullable in the spec (`type: ["...","null"]`) — but enum `$ref`s can't easily be made nullable, so the serialize approach is simpler.
