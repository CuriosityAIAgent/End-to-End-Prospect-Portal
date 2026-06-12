---
name: Frontend date fields are strings
description: Generated api-client-react summary types serialize date fields as string, not Date — relevant when writing frontend logic against the generated hooks.
---

The generated `@workspace/api-client-react` types (e.g. `ProspectSummary`, `AssessmentSummary`) type `updatedAt` and other date-time fields as **`string`**, even though the underlying `@workspace/api-zod` / DB-side types may use `Date`. When deriving/sorting on these fields in the frontend, type your own structures as `string` and wrap with `new Date(x).getTime()` for comparisons. Assuming `Date` causes a TS2322 "Type 'string' is not assignable to type 'Date'".
