import { Color, Graphics, Label, Layers, Node, Sprite, SpriteFrame, UITransform } from "cc";

const colors = new Map<string, Color>();
export function ink(hex: string): Color {
  if (!colors.has(hex)) colors.set(hex, new Color().fromHEX(hex));
  return colors.get(hex)!;
}
export function child(name: string, parent: Node): Node {
  const n = new Node(name); n.layer = Layers.Enum.UI_2D; n.parent = parent;
  n.addComponent(UITransform); return n;
}

/** Retained pools; rendering never creates or destroys nodes during play. */
export class BattlePainter {
  readonly node: Node;
  readonly g: Graphics;
  private images: Sprite[] = [];
  private labels: Label[] = [];
  private si = 0;
  private li = 0;
  constructor(parent: Node, name: string, sprites = 100, labels = 90) {
    this.node = child(name, parent);
    this.g = child("Shapes", this.node).addComponent(Graphics);
    for (let i = 0; i < sprites; i++) {
      const s = child("Sprite", this.node).addComponent(Sprite);
      s.sizeMode = Sprite.SizeMode.CUSTOM; s.node.active = false; this.images.push(s);
    }
    for (let i = 0; i < labels; i++) {
      const l = child("Text", this.node).addComponent(Label);
      l.fontFamily = "Microsoft YaHei"; l.isBold = true;
      l.horizontalAlign = Label.HorizontalAlign.CENTER; l.verticalAlign = Label.VerticalAlign.CENTER;
      l.overflow = Label.Overflow.SHRINK; l.node.active = false; this.labels.push(l);
    }
  }
  begin(): void { this.si = 0; this.li = 0; this.g.clear(); }
  end(): void {
    for (let i = this.si; i < this.images.length; i++) this.images[i].node.active = false;
    for (let i = this.li; i < this.labels.length; i++) this.labels[i].node.active = false;
  }
  box(x: number, y: number, w: number, h: number, fill: string, stroke = "#402b27", radius = 16, line = 3): void {
    const g = this.g; g.fillColor = ink(fill); g.strokeColor = ink(stroke); g.lineWidth = line;
    g.roundRect(x - w / 2, y - h / 2, w, h, radius); g.fill(); if (line) g.stroke();
  }
  oval(x: number, y: number, rx: number, ry: number, fill: string, stroke = "#402b27", line = 3): void {
    const g = this.g; g.fillColor = ink(fill); g.strokeColor = ink(stroke); g.lineWidth = line;
    g.ellipse(x, y, rx, ry); g.fill(); if (line) g.stroke();
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, width = 2): void {
    this.g.strokeColor = ink(color); this.g.lineWidth = width;
    this.g.moveTo(x1, y1); this.g.lineTo(x2, y2); this.g.stroke();
  }
  text(text: string, x: number, y: number, size = 26, color = "#fff1d4", w = 650, h = 50): void {
    const label = this.labels[this.li++]; if (!label) return;
    label.node.active = true; label.node.setPosition(x, y);
    label.node.getComponent(UITransform)!.setContentSize(w, h);
    if (label.string !== text) label.string = text;
    label.fontSize = size; label.lineHeight = size * 1.35; label.color = ink(color);
  }
  sprite(frame: SpriteFrame, x: number, y: number, w: number, h = w, angle = 0, tint = "#ffffff", opacity = 1): void {
    const s = this.images[this.si++]; if (!s || !frame) return;
    s.node.active = true; s.node.setPosition(x, y); s.node.angle = angle;
    s.node.getComponent(UITransform)!.setContentSize(w, h);
    if (s.spriteFrame !== frame) s.spriteFrame = frame;
    const base = ink(tint);
    const color = s.color;
    color.set(base.r, base.g, base.b, Math.round(base.a * Math.max(0, Math.min(1, opacity))));
    s.color = color;
  }
}
