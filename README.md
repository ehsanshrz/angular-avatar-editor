# Angular Avatar Editor

A compact avatar and profile picture component that lets users **resize, crop, rotate and pan** uploaded images through an intuitive canvas interface.

Built with **Angular 22** and **[Optimus UI](https://github.com/openng-org/optimus-ui)** (`@openng/optimus-ui`).

Inspired by [react-avatar-editor](https://github.com/mosch/react-avatar-editor).

---

## Features

- 🖼️ Canvas-based image editor (drag-to-pan, scroll-wheel zoom)
- 🔍 Configurable zoom / scale with slider
- 🔄 Rotate left / right
- ⭕ Circle or square crop area (configurable `borderRadius`)
- 📐 Rule-of-thirds grid overlay
- 🎨 Customisable overlay colour and border size
- 📱 Touch / mobile support
- ⌨️ Keyboard navigation (arrow keys, +/-)
- 🖼️ HiDPI / Retina canvas support
- 📤 Export cropped image via `getImage()` or `getImageScaledToCanvas()`

---

## Project structure

```
projects/
  angular-avatar-editor/   # Reusable Angular library
    src/lib/
      angular-avatar-editor.ts   # Main canvas component
      avatar-editor.types.ts     # TypeScript interfaces
  demo/                    # Demo application (Angular 22 + Optimus UI)
    src/app/
      app.ts               # Demo component
      app.html             # Demo template (Slider, Button, Toast)
      app.css              # Demo styles
```

---

## Installation

```bash
# Install the library dependencies
npm install

# Install Optimus UI
npm install @openng/optimus-ui --legacy-peer-deps
```

---

## Development

```bash
# Build the library
ng build angular-avatar-editor

# Build and serve the demo app
ng build demo
ng serve demo

# Run tests
ng test angular-avatar-editor --watch=false
```

---

## Library Usage

### Import

```typescript
import { AngularAvatarEditor } from 'angular-avatar-editor';

@Component({
  imports: [AngularAvatarEditor],
  // ...
})
```

### Template

```html
<lib-avatar-editor
  #editor
  [image]="imageFile"
  [width]="250"
  [height]="250"
  [border]="40"
  [scale]="scale"
  [rotate]="rotate"
  [borderRadius]="125"
  [showGrid]="true"
  [enableWheelZoom]="true"
  [color]="[0, 0, 0, 0.6]"
  (loadSuccess)="onLoad()"
  (imageChange)="onImageChange()"
  (requestScaleChange)="scale = $event"
></lib-avatar-editor>
```

### Imperative API (via `@ViewChild`)

```typescript
@ViewChild('editor') editor!: AngularAvatarEditor;

// Export cropped canvas at editor dimensions
const canvas = this.editor.getImageScaledToCanvas();
const dataUrl = canvas.toDataURL('image/png');

// Export full-resolution crop
const fullResCanvas = this.editor.getImage();

// Read normalised crop coordinates
const { x, y, width, height } = this.editor.getCroppingRect();
```

---

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `image` | `string \| File \| null` | `null` | Image URL or `File` |
| `width` | `number` | `200` | Crop area width (px) |
| `height` | `number` | `200` | Crop area height (px) |
| `border` | `number \| [number, number]` | `25` | Border around the crop area |
| `borderRadius` | `number` | `0` | Crop area corner radius; `width/2` for circle |
| `color` | `[r, g, b, a]` | `[0,0,0,0.5]` | Overlay mask colour |
| `scale` | `number` | `1` | Zoom level |
| `rotate` | `number` | `0` | Rotation in degrees |
| `position` | `{ x, y } \| null` | `null` | Controlled pan position (0–1) |
| `showGrid` | `boolean` | `false` | Rule-of-thirds grid overlay |
| `enableWheelZoom` | `boolean` | `false` | Mouse-wheel zoom |
| `disableBoundaryChecks` | `boolean` | `false` | Allow panning outside image |
| `disableHiDPIScaling` | `boolean` | `false` | Disable devicePixelRatio scaling |
| `backgroundColor` | `string \| null` | `null` | Background for transparent images |
| `crossOrigin` | `string \| null` | `null` | CORS attribute for the `<img>` |

---

## Outputs

| Output | Payload | Description |
|---|---|---|
| `loadStart` | `void` | Image load started |
| `loadSuccess` | `ImageState` | Image loaded successfully |
| `loadFailure` | `void` | Image failed to load |
| `imageReady` | `void` | First paint after load |
| `imageChange` | `void` | Any pan / scale / rotate change |
| `positionChange` | `{ x, y }` | Pan position changed |
| `mouseUp` | `void` | Pointer released |
| `requestScaleChange` | `number` | Wheel / key zoom request |

---

## License

MIT
