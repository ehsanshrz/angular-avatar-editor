import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AngularAvatarEditor } from 'angular-avatar-editor';
import { SliderModule } from '@openng/optimus-ui/slider';
import { ButtonModule } from '@openng/optimus-ui/button';
import { ToastModule } from '@openng/optimus-ui/toast';
import { MessageService } from '@openng/optimus-ui/api';
import { CardModule } from '@openng/optimus-ui/card';
import { ToolbarModule } from '@openng/optimus-ui/toolbar';
import { ToggleButtonModule } from '@openng/optimus-ui/togglebutton';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { SplitButtonModule } from '@openng/optimus-ui/splitbutton';
import { MenuItem } from '@openng/optimus-ui/api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AngularAvatarEditor,
    SliderModule,
    ButtonModule,
    ToastModule,
    CardModule,
    ToolbarModule,
    ToggleButtonModule,
    TooltipModule,
    SplitButtonModule
  ],
  providers: [MessageService],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  @ViewChild('editor') editor!: AngularAvatarEditor;

  image: string | File | null = null;
  scale = 1;
  rotate = 0;
  borderRadius = 0;
  showGrid = false;
  width = 250;
  height = 250;
  border = 40;

  saveOptions: MenuItem[] = [
    { label: 'Save as JPEG', icon: 'pi pi-image', command: () => this.onSave('image/jpeg', 'avatar.jpg') },
    { label: 'Save as WebP', icon: 'pi pi-image', command: () => this.onSave('image/webp', 'avatar.webp') }
  ];

  constructor(private messageService: MessageService) {}

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.image = input.files[0];
      this.scale = 1;
      this.rotate = 0;
    }
  }

  onRotateLeft(): void {
    this.rotate = this.rotate - 90;
  }

  onRotateRight(): void {
    this.rotate = this.rotate + 90;
  }

  onToggleGrid(): void {
    this.showGrid = !this.showGrid;
  }

  onToggleCircle(): void {
    this.borderRadius = this.borderRadius === 0 ? this.width / 2 : 0;
  }

  onSave(mimeType = 'image/png', filename = 'avatar.png'): void {
    if (!this.editor || !this.image) {
      this.messageService.add({ severity: 'warn', summary: 'No image', detail: 'Please select an image first.' });
      return;
    }
    const canvas = this.editor.getImageScaledToCanvas();
    canvas.toBlob((blob: Blob | null) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, mimeType);
    this.messageService.add({ severity: 'success', summary: 'Saved', detail: `Avatar downloaded as ${filename}.` });
  }

  onLoadSuccess(): void {
    this.messageService.add({ severity: 'info', summary: 'Image loaded', detail: 'You can now crop and adjust.' });
  }

  onLoadFailure(): void {
    this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load image.' });
  }

  onScaleChange(value: number): void {
    this.scale = value;
  }

  zoomIn(): void {
    this.scale = Math.min(4, this.scale + 0.1);
  }

  zoomOut(): void {
    this.scale = Math.max(0.1, this.scale - 0.1);
  }
}
