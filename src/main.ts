import { DrillApp } from "./app.js";
import { Menu } from "./menu.js";

// Seed from ?seed= for shareable/reproducible draws, else random.
const params = new URLSearchParams(location.search);
const raw = params.get("seed");
const seed = raw !== null && /^\d+$/.test(raw)
  ? parseInt(raw, 10)
  : Math.floor(Math.random() * 1_000_000);

function showMenu(): void {
  new Menu((choice) => {
    new DrillApp(seed, { lucia: choice === "lucia", onMenu: showMenu }).start();
  }).start();
}

showMenu();
