// Main menu — pick a drill mode. Arrow-key / click / hotkey driven, matching
// the k9s-style aesthetic of the drill screens.

type MenuChoice = "classic" | "lucia";

interface MenuItem {
  key: string;              // hotkey chip + shortcut
  choice: MenuChoice | null; // null = disabled (coming soon)
  title: string;
  hint: string;
}

const ITEMS: MenuItem[] = [
  { key: "a", choice: "classic", title: "drill listening (classic)", hint: "type tone numbers" },
  { key: "s", choice: "lucia", title: "drill listening (lucia)", hint: "match to words with same tone" },
  { key: "d", choice: null, title: "practice pronunciation", hint: "coming soon" },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class Menu {
  private root: HTMLElement;
  private cursor = 0;
  private onPick: (choice: MenuChoice) => void;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(onPick: (choice: MenuChoice) => void) {
    this.root = document.getElementById("app")!;
    this.onPick = onPick;
  }

  start(): void {
    window.addEventListener("keydown", this.keyHandler);
    this.render();
  }

  private stop(): void {
    window.removeEventListener("keydown", this.keyHandler);
  }

  private pick(i: number): void {
    const item = ITEMS[i];
    if (!item.choice) return; // disabled
    this.stop();
    this.onPick(item.choice);
  }

  private move(dir: number): void {
    const n = ITEMS.length;
    this.cursor = (this.cursor + dir + n) % n;
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    const key = e.key;
    if (key === "ArrowDown" || key === "j") { this.move(1); e.preventDefault(); return; }
    if (key === "ArrowUp" || key === "k") { this.move(-1); e.preventDefault(); return; }
    if (key === "Enter" || key === " ") { this.pick(this.cursor); e.preventDefault(); return; }
    const low = key.toLowerCase();
    const idx = ITEMS.findIndex((it) => it.key === low);
    if (idx >= 0) { this.cursor = idx; this.render(); this.pick(idx); }
  }

  private render(): void {
    this.root.replaceChildren(
      this.renderHeader(),
      this.renderBody(),
      this.renderFooter()
    );
  }

  private renderHeader(): HTMLElement {
    const header = el("div");
    header.id = "header";
    const title = el("div", "menu-brand");
    title.append(
      el("span", "accent bold", "tone-drill"),
      el("span", "dim small", "  Mandarin tone perception")
    );
    header.append(title);
    return header;
  }

  private renderBody(): HTMLElement {
    const body = el("div");
    body.id = "body";
    const panel = el("div", "panel b-accent");
    panel.append(el("div", "panel-title", "choose a mode"));
    const inner = el("div", "panel-body menu-body");

    ITEMS.forEach((item, i) => {
      const disabled = !item.choice;
      const row = el("button", "menu-item");
      if (i === this.cursor) row.classList.add("sel");
      if (disabled) row.classList.add("disabled");
      row.append(el("span", "key", ` ${item.key} `));
      const text = el("div", "menu-text");
      text.append(
        el("div", "menu-title", item.title),
        el("div", "menu-hint dim small", item.hint)
      );
      row.append(text);
      if (!disabled) {
        row.onclick = () => this.pick(i);
      }
      inner.append(row);
    });

    panel.append(inner);
    body.append(panel);
    return body;
  }

  private renderFooter(): HTMLElement {
    const footer = el("div");
    footer.id = "footer";
    const items: [string, string, () => void][] = [
      ["↑↓", "move", () => this.move(1)],
      ["↵", "select", () => this.pick(this.cursor)],
      ["a", "classic", () => this.pick(0)],
      ["s", "lucia", () => this.pick(1)],
    ];
    for (const [key, desc, fn] of items) {
      const b = el("button", "fbtn");
      b.append(el("span", "key", ` ${key} `), el("span", "fdesc", ` ${desc} `));
      b.onclick = fn;
      footer.append(b);
    }
    return footer;
  }
}
