// Vercel serverless function entry point.
// The Express app is pre-built to dist-vercel/vercel.mjs by build-vercel.mjs
// (run as part of the Vercel build command). Using a pre-built .mjs avoids
// Vercel running tsc on the TypeScript source and failing on workspace imports.
export { default } from "../artifacts/api-server/dist-vercel/vercel.mjs";
