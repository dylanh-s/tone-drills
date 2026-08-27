import { DrillApp } from "./app.js";

// Seed from ?seed= for shareable/reproducible draws, else random.
const params = new URLSearchParams(location.search);
const raw = params.get("seed");
const seed = raw !== null && /^\d+$/.test(raw)
  ? parseInt(raw, 10)
  : Math.floor(Math.random() * 1_000_000);

new DrillApp(seed).start();
