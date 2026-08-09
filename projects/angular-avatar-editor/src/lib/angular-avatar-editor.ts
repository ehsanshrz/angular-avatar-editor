import {
  Component,
  ElementRef,
  ViewChild,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  HostListener,
  NgZone,
} from '@angular/core';
import { CroppingRect, ImageState, Position } from './avatar-editor.types';

const PIXEL_RATIO = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

@Component({
  selector: 'lib-avatar-editor',
  standalone: true,
  imports: [],
  template: `<canvas #editorCanvas
    [style.cursor]="isDragging ? 'grabbing' : 'grab'"
    (mousedown)="onMouseDown($event)"
    (touchstart)="onTouchStart($event)"
    (wheel)="onWheel($event)"
    tabindex="0"
    (keydown)="onKeyDown($event)"
  ></canvas>`,
  styles: [`
    canvas {
      display: block;
      outline: none;
    }
  `],
})
export class AngularAvatarEditor implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('editorCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  /** URL or File/Blob of the image to crop */
  @Input() image: string | File | null = null;
  /** Crop area width in px */
  @Input() width = 200;
  /** Crop area height in px */
  @Input() height = 200;
  /** Border size around the crop area (px) */
  @Input() border: number | [number, number] = 25;
  /** Corner radius of the crop area (set to width/2 for a circle) */
  @Input() borderRadius = 0;
  /** Overlay colour as [r, g, b, a] */
  @Input() color: [number, number, number, number] = [0, 0, 0, 0.5];
  /** Scale / zoom level */
  @Input() scale = 1;
  /** Rotation in degrees */
  @Input() rotate = 0;
  /** Controlled position {x, y} in 0–1 normalised space */
  @Input() position: Position | null = null;
  /** Show rule-of-thirds grid overlay */
  @Input() showGrid = false;
  /** Disable HiDPI canvas scaling */
  @Input() disableHiDPIScaling = false;
  /** Allow panning beyond image bounds */
  @Input() disableBoundaryChecks = false;
  /** Enable mouse-wheel zoom */
  @Input() enableWheelZoom = false;
  /** Background colour for transparent images */
  @Input() backgroundColor: string | null = null;
  /** crossOrigin attribute for the image element */
  @Input() crossOrigin: '' | 'anonymous' | 'use-credentials' | null = null;

  @Output() loadStart = new EventEmitter<void>();
  @Output() loadSuccess = new EventEmitter<ImageState>();
  @Output() loadFailure = new EventEmitter<void>();
  @Output() imageReady = new EventEmitter<void>();
  @Output() imageChange = new EventEmitter<void>();
  @Output() positionChange = new EventEmitter<Position>();
  @Output() mouseUp = new EventEmitter<void>();
  @Output() requestScaleChange = new EventEmitter<number>();

  private ctx: CanvasRenderingContext2D | null = null;
  private imageState: ImageState | null = null;
  private pos: Position = { x: 0.5, y: 0.5 };
  isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private animationFrame: number | null = null;

  private boundMouseMove = this.onMouseMove.bind(this);
  private boundMouseUp = this.onMouseUpDoc.bind(this);
  private boundTouchMove = this.onTouchMove.bind(this);
  private boundTouchEnd = this.onTouchEnd.bind(this);

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    this.setupCanvas();
    if (this.image) {
      this.loadImage(this.image);
    }
    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
    document.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    document.addEventListener('touchend', this.boundTouchEnd);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.canvasRef) return;

    if (changes['width'] || changes['height'] || changes['border'] || changes['disableHiDPIScaling']) {
      this.setupCanvas();
    }
    if (changes['image'] && this.image) {
      this.loadImage(this.image);
      return;
    }
    if (changes['position'] && this.position) {
      this.pos = { ...this.position };
    }
    this.redraw();
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('touchmove', this.boundTouchMove);
    document.removeEventListener('touchend', this.boundTouchEnd);
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Returns an off-screen canvas at the original source resolution with the cropped area. */
  getImage(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    if (!this.imageState) return canvas;
    const cropRect = this.getCroppingRect();
    const img = this.imageState;
    const srcX = cropRect.x * img.width;
    const srcY = cropRect.y * img.height;
    const srcW = cropRect.width * img.width;
    const srcH = cropRect.height * img.height;

    canvas.width = srcW;
    canvas.height = srcH;
    const ctx = canvas.getContext('2d')!;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(toRad(this.rotate));
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.drawImage(img.resource, -srcX, -srcY, img.width, img.height);
    ctx.restore();

    return canvas;
  }

  /** Returns a canvas scaled to the editor's configured width × height. */
  getImageScaledToCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    if (!this.imageState) return canvas;

    const ctx = canvas.getContext('2d')!;
    const { x, y, width: cw, height: ch } = this.getCroppingRect();
    const img = this.imageState;

    const srcX = x * img.width;
    const srcY = y * img.height;
    const srcW = cw * img.width;
    const srcH = ch * img.height;

    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.rotate(toRad(this.rotate));
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.drawImage(img.resource, srcX, srcY, srcW, srcH, 0, 0, this.width, this.height);
    ctx.restore();

    return canvas;
  }

  /** Returns the current crop rectangle in 0–1 normalised coordinates. */
  getCroppingRect(): CroppingRect {
    if (!this.imageState) return { x: 0, y: 0, width: 1, height: 1 };
    const [bx, by] = this.getBorderPixels();
    const canvasW = this.width + bx * 2;
    const canvasH = this.height + by * 2;
    const scale = this.scale;
    const imgW = this.imageState.width * scale;
    const imgH = this.imageState.height * scale;

    const imageX = this.pos.x * canvasW - imgW / 2;
    const imageY = this.pos.y * canvasH - imgH / 2;

    const cropX = (bx - imageX) / imgW;
    const cropY = (by - imageY) / imgH;
    const cropW = this.width / imgW;
    const cropH = this.height / imgH;

    if (this.disableBoundaryChecks) {
      return { x: cropX, y: cropY, width: cropW, height: cropH };
    }
    return {
      x: Math.max(0, Math.min(1 - cropW, cropX)),
      y: Math.max(0, Math.min(1 - cropH, cropY)),
      width: cropW,
      height: cropH,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private getBorderPixels(): [number, number] {
    if (Array.isArray(this.border)) {
      return [this.border[0], this.border[1]];
    }
    return [this.border, this.border];
  }

  private setupCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const [bx, by] = this.getBorderPixels();
    const ratio = this.disableHiDPIScaling ? 1 : PIXEL_RATIO;
    const totalW = (this.width + bx * 2) * ratio;
    const totalH = (this.height + by * 2) * ratio;
    canvas.width = totalW;
    canvas.height = totalH;
    canvas.style.width = `${this.width + bx * 2}px`;
    canvas.style.height = `${this.height + by * 2}px`;
    this.ctx = canvas.getContext('2d');
    if (this.ctx && ratio !== 1) {
      this.ctx.scale(ratio, ratio);
    }
    this.redraw();
  }

  private loadImage(source: string | File): void {
    this.loadStart.emit();
    const img = new Image();
    if (this.crossOrigin !== null) {
      img.crossOrigin = this.crossOrigin;
    }
    img.onload = () => {
      this.imageState = { width: img.naturalWidth, height: img.naturalHeight, resource: img };
      this.pos = this.position ? { ...this.position } : { x: 0.5, y: 0.5 };
      this.loadSuccess.emit(this.imageState);
      this.redraw();
      this.imageReady.emit();
    };
    img.onerror = () => this.loadFailure.emit();
    if (typeof source === 'string') {
      img.src = source;
    } else {
      const objectUrl = URL.createObjectURL(source);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        this.imageState = { width: img.naturalWidth, height: img.naturalHeight, resource: img };
        this.pos = this.position ? { ...this.position } : { x: 0.5, y: 0.5 };
        this.loadSuccess.emit(this.imageState);
        this.redraw();
        this.imageReady.emit();
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        this.loadFailure.emit();
      };
      img.src = objectUrl;
    }
  }

  private redraw(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.ngZone.runOutsideAngular(() => {
      this.animationFrame = requestAnimationFrame(() => this.paint());
    });
  }

  private paint(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const [bx, by] = this.getBorderPixels();
    const totalW = this.width + bx * 2;
    const totalH = this.height + by * 2;

    ctx.clearRect(0, 0, totalW, totalH);

    if (this.backgroundColor) {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(bx, by, this.width, this.height);
    }

    if (this.imageState) {
      this.paintImage(ctx, bx, by, totalW, totalH);
    }

    this.paintOverlay(ctx, bx, by, totalW, totalH);

    if (this.showGrid) {
      this.paintGrid(ctx, bx, by);
    }
  }

  private paintImage(ctx: CanvasRenderingContext2D, bx: number, by: number, totalW: number, totalH: number): void {
    const img = this.imageState!;
    const scale = this.scale;
    const imgW = img.width * scale;
    const imgH = img.height * scale;
    const cx = this.pos.x * totalW;
    const cy = this.pos.y * totalH;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(toRad(this.rotate));
    ctx.drawImage(img.resource, -imgW / 2, -imgH / 2, imgW, imgH);
    ctx.restore();
  }

  private paintOverlay(ctx: CanvasRenderingContext2D, bx: number, by: number, totalW: number, totalH: number): void {
    const [r, g, b, a] = this.color;
    ctx.save();
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;

    if (this.borderRadius > 0) {
      // Draw overlay with circular/rounded hole using even-odd winding rule
      ctx.beginPath();
      ctx.rect(0, 0, totalW, totalH);
      this.roundedRect(ctx, bx, by, this.width, this.height, this.borderRadius);
      ctx.fill('evenodd');
    } else {
      // Top
      ctx.fillRect(0, 0, totalW, by);
      // Bottom
      ctx.fillRect(0, by + this.height, totalW, by);
      // Left
      ctx.fillRect(0, by, bx, this.height);
      // Right
      ctx.fillRect(bx + this.width, by, bx, this.height);
    }
    ctx.restore();
  }

  private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  private paintGrid(ctx: CanvasRenderingContext2D, bx: number, by: number): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    const w3 = this.width / 3;
    const h3 = this.height / 3;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(bx + w3 * i, by);
      ctx.lineTo(bx + w3 * i, by + this.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx, by + h3 * i);
      ctx.lineTo(bx + this.width, by + h3 * i);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ─── Drag / Pan ────────────────────────────────────────────────────────────

  onMouseDown(e: MouseEvent): void {
    e.preventDefault();
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDragging || !this.imageState) return;
    this.applyDrag(e.clientX - this.lastX, e.clientY - this.lastY);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  onMouseUpDoc(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.mouseUp.emit();
    }
  }

  onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    }
  }

  onTouchMove(e: TouchEvent): void {
    if (!this.isDragging || !this.imageState || e.touches.length !== 1) return;
    e.preventDefault();
    this.applyDrag(e.touches[0].clientX - this.lastX, e.touches[0].clientY - this.lastY);
    this.lastX = e.touches[0].clientX;
    this.lastY = e.touches[0].clientY;
  }

  onTouchEnd(): void {
    this.isDragging = false;
    this.mouseUp.emit();
  }

  private applyDrag(dx: number, dy: number): void {
    if (!this.imageState) return;
    const [bx, by] = this.getBorderPixels();
    const totalW = this.width + bx * 2;
    const totalH = this.height + by * 2;
    const imgW = this.imageState.width * this.scale;
    const imgH = this.imageState.height * this.scale;

    const rad = toRad(this.rotate);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = cos * dx + sin * dy;
    const ry = -sin * dx + cos * dy;

    let newX = this.pos.x + rx / totalW;
    let newY = this.pos.y + ry / totalH;

    if (!this.disableBoundaryChecks) {
      const minX = (imgW / 2 - bx) / totalW;
      const maxX = 1 - (imgW / 2 - bx) / totalW;
      const minY = (imgH / 2 - by) / totalH;
      const maxY = 1 - (imgH / 2 - by) / totalH;

      if (imgW >= this.width) {
        newX = Math.max(minX, Math.min(maxX, newX));
      } else {
        newX = 0.5;
      }
      if (imgH >= this.height) {
        newY = Math.max(minY, Math.min(maxY, newY));
      } else {
        newY = 0.5;
      }
    }

    this.pos = { x: newX, y: newY };
    this.positionChange.emit({ ...this.pos });
    this.imageChange.emit();
    this.redraw();
  }

  onWheel(e: WheelEvent): void {
    if (!this.enableWheelZoom) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.requestScaleChange.emit(Math.max(0.1, this.scale + delta));
  }

  onKeyDown(e: KeyboardEvent): void {
    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case 'ArrowLeft': this.applyDrag(step, 0); e.preventDefault(); break;
      case 'ArrowRight': this.applyDrag(-step, 0); e.preventDefault(); break;
      case 'ArrowUp': this.applyDrag(0, step); e.preventDefault(); break;
      case 'ArrowDown': this.applyDrag(0, -step); e.preventDefault(); break;
      case '+': this.requestScaleChange.emit(this.scale + 0.1); e.preventDefault(); break;
      case '-': this.requestScaleChange.emit(Math.max(0.1, this.scale - 0.1)); e.preventDefault(); break;
    }
  }
}
