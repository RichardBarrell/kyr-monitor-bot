import { rolldown } from "rolldown";
import * as fs from "fs";

async function main() {
  await fs.promises.rm("dist", { recursive: true, force: true });
  const bundle = await rolldown({
    input: ["src/mb.ts"],
    platform: "node",
    external: ["zlib-sync"],
  });
  try {
    await bundle.write({
      format: "esm",
      dir: "dist/",
      minify: false,
      sourcemap: false,
      chunkFileNames: "chunks/[name]-[hash].js",
    });
  } finally {
    await bundle.close();
  }
}

try {
  await main();
} catch (error) {
  console.log(error);
  process.exit(1);
}
