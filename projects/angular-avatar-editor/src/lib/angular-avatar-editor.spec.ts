import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AngularAvatarEditor } from './angular-avatar-editor';

describe('AngularAvatarEditor', () => {
  let component: AngularAvatarEditor;
  let fixture: ComponentFixture<AngularAvatarEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AngularAvatarEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(AngularAvatarEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default inputs', () => {
    expect(component.width).toBe(200);
    expect(component.height).toBe(200);
    expect(component.scale).toBe(1);
    expect(component.rotate).toBe(0);
    expect(component.borderRadius).toBe(0);
  });

  it('getCroppingRect returns full rect when no image loaded', () => {
    const rect = component.getCroppingRect();
    expect(rect).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('getImage returns an HTMLCanvasElement', () => {
    const canvas = component.getImage();
    expect(canvas instanceof HTMLCanvasElement).toBe(true);
  });

  it('getImageScaledToCanvas returns canvas at configured dimensions', () => {
    component.width = 150;
    component.height = 150;
    fixture.detectChanges();
    const canvas = component.getImageScaledToCanvas();
    expect(canvas.width).toBe(150);
    expect(canvas.height).toBe(150);
  });

  it('requestScaleChange emits on wheel when enableWheelZoom is true', () => {
    component.enableWheelZoom = true;
    let emitted: number | null = null;
    component.requestScaleChange.subscribe((v) => (emitted = v));
    const event = new WheelEvent('wheel', { deltaY: -1 });
    vi.spyOn(event, 'preventDefault');
    component.onWheel(event);
    expect(emitted).toBe(1.1);
  });

  it('requestScaleChange does not emit when enableWheelZoom is false', () => {
    component.enableWheelZoom = false;
    let emitted = false;
    component.requestScaleChange.subscribe(() => (emitted = true));
    const event = new WheelEvent('wheel', { deltaY: -1 });
    component.onWheel(event);
    expect(emitted).toBe(false);
  });
});
