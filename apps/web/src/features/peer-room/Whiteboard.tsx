import { useRef, useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { getSocket } from '@/services/socket';

interface WhiteboardProps { 
  roomId: string; 
  initialState?: string;
}
interface Point { x: number; y: number; }
type HistoryEntry = string;
type Tool = 'select' | 'draw' | 'highlighter' | 'line' | 'arrow' | 'rectangle' | 'circle' | 'text' | 'eraser' | 'laser' | 'pan';

const COLORS = ['#000000','#333333','#00639B','#7C3AED','#10B981','#D32F2F','#E65100','#EC4899'];
const SIZES = [2, 4, 6, 10];
const BG_MODES = ['plain', 'grid', 'dots', 'lined'] as const;
type BgMode = typeof BG_MODES[number];

export default function Whiteboard({ roomId, initialState }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('draw');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(2);
  const [fillShape, setFillShape] = useState(false);
  const [bgMode, setBgMode] = useState<BgMode>('plain');
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [shapeStartPoint, setShapeStartPoint] = useState<Point | null>(null);

  // Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const panStart = useRef<Point | null>(null);
  const panOffsetStart = useRef<Point>({ x: 0, y: 0 });

  // Undo / Redo
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Text tool
  const [textMode, setTextMode] = useState(false);
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // Laser pointer
  const laserTrail = useRef<Point[]>([]);
  const laserTimer = useRef<ReturnType<typeof setTimeout>>();

  // Slide panel
  const [showSlides, setShowSlides] = useState(false);
  const [slideThumbs, setSlideThumbs] = useState<string[]>(['']);

  // Multi-page
  const [pages, setPages] = useState<string[]>(['']);
  const [currentPage, setCurrentPage] = useState(0);

  const initializedRef = useRef(false);
  const BG_COLOR = '#FFFFFF';

  // ─── CSS background pattern (reactive) ──────────────────
  const getBgStyle = useCallback((): React.CSSProperties => {
    const base: React.CSSProperties = { backgroundColor: BG_COLOR };
    if (bgMode === 'grid') {
      base.backgroundImage = 'linear-gradient(#e0e0e0 1px, transparent 1px), linear-gradient(90deg, #e0e0e0 1px, transparent 1px)';
      base.backgroundSize = '30px 30px';
    } else if (bgMode === 'dots') {
      base.backgroundImage = 'radial-gradient(circle, #ccc 1px, transparent 1px)';
      base.backgroundSize = '20px 20px';
    } else if (bgMode === 'lined') {
      base.backgroundImage = 'linear-gradient(#d0d8e8 1px, transparent 1px)';
      base.backgroundSize = '100% 30px';
    }
    return base;
  }, [bgMode]);

  // Keep a simple clearCanvas helper
  const clearCanvas = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h);
  }, []);

  // ─── Helpers ──────────────────────────────────────────────
  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL();
    undoStack.current.push(dataURL);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);

    try {
      getSocket().emit('whiteboard:save-state', { roomId, state: dataURL });
    } catch (err) {
      console.error('[Socket] Failed to save whiteboard state:', err);
    }
  }, [roomId]);

  const restoreImage = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }, []);

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStack.current.length === 0) return;
    redoStack.current.push(canvas.toDataURL());
    setCanRedo(true);
    const prev = undoStack.current.pop()!;
    setCanUndo(undoStack.current.length > 0);
    restoreImage(prev);
  }, [restoreImage]);

  const handleRedo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || redoStack.current.length === 0) return;
    undoStack.current.push(canvas.toDataURL());
    setCanUndo(true);
    const next = redoStack.current.pop()!;
    setCanRedo(redoStack.current.length > 0);
    restoreImage(next);
  }, [restoreImage]);

  // ─── Multi-page ──────────────────────────────────────────
  const saveCurrentPage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newPages = [...pages];
    newPages[currentPage] = canvas.toDataURL();
    setPages(newPages);
  }, [pages, currentPage]);

  const loadPage = useCallback((pageIdx: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const data = pages[pageIdx];
    if (data) {
      restoreImage(data);
    } else {
      clearCanvas(ctx, canvas.width, canvas.height);
    }
  }, [pages, restoreImage, clearCanvas]);

  const switchPage = useCallback((idx: number) => {
    saveCurrentPage();
    setCurrentPage(idx);
    loadPage(idx);
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [saveCurrentPage, loadPage]);

  const addPage = useCallback(() => {
    saveCurrentPage();
    updateThumbnail(currentPage);
    const newPages = [...pages, ''];
    setPages(newPages);
    const idx = newPages.length - 1;
    setCurrentPage(idx);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) clearCanvas(ctx, canvas.width, canvas.height);
    undoStack.current = []; redoStack.current = [];
    setCanUndo(false); setCanRedo(false);
    setSlideThumbs(prev => [...prev, '']);
  }, [pages, currentPage, saveCurrentPage, clearCanvas]);

  const deletePage = useCallback((idx: number) => {
    if (pages.length <= 1) return;
    const newPages = pages.filter((_, i) => i !== idx);
    const newThumbs = slideThumbs.filter((_, i) => i !== idx);
    setPages(newPages);
    setSlideThumbs(newThumbs);
    const newIdx = idx >= newPages.length ? newPages.length - 1 : idx;
    setCurrentPage(newIdx);
    loadPage(newIdx);
  }, [pages, slideThumbs, loadPage]);

  const duplicatePage = useCallback((idx: number) => {
    saveCurrentPage();
    updateThumbnail(currentPage);
    const dup = pages[idx] || '';
    const newPages = [...pages];
    newPages.splice(idx + 1, 0, dup);
    const newThumbs = [...slideThumbs];
    newThumbs.splice(idx + 1, 0, slideThumbs[idx] || '');
    setPages(newPages);
    setSlideThumbs(newThumbs);
    switchPage(idx + 1);
  }, [pages, slideThumbs, currentPage, saveCurrentPage, switchPage]);

  const updateThumbnail = useCallback((idx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Create small thumbnail
    const thumb = document.createElement('canvas');
    thumb.width = 160; thumb.height = 90;
    const tctx = thumb.getContext('2d');
    if (tctx) {
      tctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 160, 90);
      setSlideThumbs(prev => { const n = [...prev]; n[idx] = thumb.toDataURL(); return n; });
    }
  }, []);

  const prevSlide = useCallback(() => { if (currentPage > 0) { updateThumbnail(currentPage); switchPage(currentPage - 1); } }, [currentPage, switchPage, updateThumbnail]);
  const nextSlide = useCallback(() => { if (currentPage < pages.length - 1) { updateThumbnail(currentPage); switchPage(currentPage + 1); } }, [currentPage, pages.length, switchPage, updateThumbnail]);

  // ─── Keyboard shortcuts ────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  // ─── Canvas resize + socket ────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const resizeCanvas = () => {
      let w = canvas.offsetWidth, h = canvas.offsetHeight;
      if (w === 0 || h === 0) {
        w = window.innerWidth;
        h = window.innerHeight;
      }
      const ctx = canvas.getContext('2d');
      let imageData: ImageData | null = null;
      if (ctx && canvas.width > 0 && canvas.height > 0 && initializedRef.current)
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = w; canvas.height = h;
      overlay.width = w; overlay.height = h;
      if (ctx) {
        clearCanvas(ctx, w, h);
        if (imageData) {
          ctx.putImageData(imageData, 0, 0);
        } else if (initialState && !initializedRef.current) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
          };
          img.src = initialState;
        }
        initializedRef.current = true;
      }
    };
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();

    const socket = getSocket();
    socket.emit('whiteboard:join', { roomId });
    
    // Request state from existing peers
    socket.emit('whiteboard:request-state', { roomId });

    const handleRequestState = (data: { requesterId: string }) => {
      const c = canvasRef.current;
      if (c && initializedRef.current) {
        // Add a slight random delay to stagger responses if multiple users are in the room
        setTimeout(() => {
          const dataURL = c.toDataURL('image/png');
          getSocket().emit('whiteboard:send-state', { requesterId: data.requesterId, state: dataURL });
        }, Math.random() * 300);
      }
    };

    const handleState = (data: { state: string }) => {
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = data.state;
    };

    const handleUpdate = (data: { objects: any }) => {
      const c = canvasRef.current;
      const context = c?.getContext('2d');
      if (!context || !c) return;
      const act = data.objects;
      if (act.action === 'draw-segment') {
        context.beginPath();
        context.moveTo(act.start.x, act.start.y);
        context.lineTo(act.end.x, act.end.y);
        if (act.tool === 'highlighter') {
          context.globalAlpha = 0.3;
          context.strokeStyle = act.color;
          context.lineWidth = act.size * 6;
        } else {
          if (act.tool === 'eraser') {
            context.globalCompositeOperation = 'destination-out';
            context.strokeStyle = 'rgba(0,0,0,1)';
          } else {
            context.strokeStyle = act.color;
          }
          context.lineWidth = act.tool === 'eraser' ? act.size * 4 : act.size;
        }
        context.lineCap = 'round'; context.lineJoin = 'round'; context.stroke();
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'source-over';
      } else if (act.action === 'shape') {
        context.beginPath();
        if (act.tool === 'line') {
          context.moveTo(act.start.x, act.start.y); context.lineTo(act.end.x, act.end.y);
        } else if (act.tool === 'arrow') {
          context.moveTo(act.start.x, act.start.y); context.lineTo(act.end.x, act.end.y);
          const angle = Math.atan2(act.end.y - act.start.y, act.end.x - act.start.x);
          const headLen = 14;
          context.moveTo(act.end.x, act.end.y);
          context.lineTo(act.end.x - headLen * Math.cos(angle - Math.PI / 6), act.end.y - headLen * Math.sin(angle - Math.PI / 6));
          context.moveTo(act.end.x, act.end.y);
          context.lineTo(act.end.x - headLen * Math.cos(angle + Math.PI / 6), act.end.y - headLen * Math.sin(angle + Math.PI / 6));
        } else if (act.tool === 'rectangle') {
          context.rect(act.start.x, act.start.y, act.end.x - act.start.x, act.end.y - act.start.y);
        } else if (act.tool === 'circle') {
          const rx = Math.abs(act.end.x - act.start.x) / 2, ry = Math.abs(act.end.y - act.start.y) / 2;
          const cx = act.start.x + (act.end.x - act.start.x) / 2, cy = act.start.y + (act.end.y - act.start.y) / 2;
          context.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        }
        context.strokeStyle = act.color; context.lineWidth = act.size; context.stroke();
        if (act.fill) { context.fillStyle = act.color + '33'; context.fill(); }
      } else if (act.action === 'text') {
        context.fillStyle = act.color;
        context.font = `${act.size * 4}px 'JetBrains Mono', monospace`;
        context.fillText(act.text, act.point.x, act.point.y);
      } else if (act.action === 'clear') {
        clearCanvas(context, c.width, c.height);
      } else if (act.action === 'laser') {
        // Render remote laser as temporary dot
        const ov = overlayRef.current?.getContext('2d');
        if (ov && overlayRef.current) {
          ov.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
          ov.beginPath(); ov.arc(act.point.x, act.point.y, 6, 0, Math.PI * 2);
          ov.fillStyle = 'rgba(255,0,0,0.7)'; ov.fill();
          ov.beginPath(); ov.arc(act.point.x, act.point.y, 12, 0, Math.PI * 2);
          ov.strokeStyle = 'rgba(255,0,0,0.3)'; ov.lineWidth = 2; ov.stroke();
          setTimeout(() => { if (overlayRef.current) { const o2 = overlayRef.current.getContext('2d'); o2?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height); } }, 800);
        }
      }
    };
    socket.on('whiteboard:update', handleUpdate);
    socket.on('whiteboard:request-state', handleRequestState);
    socket.on('whiteboard:state', handleState);
    return () => { 
      observer.disconnect(); 
      socket.off('whiteboard:update', handleUpdate); 
      socket.off('whiteboard:request-state', handleRequestState);
      socket.off('whiteboard:state', handleState);
    };
  }, [roomId, clearCanvas]);

  // ─── Zoom with scroll ──────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(z => Math.min(5, Math.max(0.2, z - e.deltaY * 0.002)));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ─── Pointer helpers ──────────────────────────────────
  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ('touches' in e) {
      cx = e.touches[0]?.clientX ?? (e as any).changedTouches[0]?.clientX ?? 0;
      cy = e.touches[0]?.clientY ?? (e as any).changedTouches[0]?.clientY ?? 0;
    } else { cx = (e as React.MouseEvent).clientX; cy = (e as React.MouseEvent).clientY; }
    return { x: (cx - rect.left - panOffset.x) / zoom, y: (cy - rect.top - panOffset.y) / zoom };
  }, [zoom, panOffset]);

  const getRawPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ('touches' in e) {
      cx = e.touches[0]?.clientX ?? (e as any).changedTouches[0]?.clientX ?? 0;
      cy = e.touches[0]?.clientY ?? (e as any).changedTouches[0]?.clientY ?? 0;
    } else { cx = (e as React.MouseEvent).clientX; cy = (e as React.MouseEvent).clientY; }
    return { x: cx - rect.left, y: cy - rect.top };
  }, []);

  // ─── Shape preview ────────────────────────────────────
  const drawShapePreview = useCallback((start: Point, end: Point) => {
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext('2d');
    if (!ctx || !overlay) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = size; ctx.setLineDash([6, 3]);
    if (tool === 'line') { ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); }
    else if (tool === 'arrow') {
      ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const hl = 14;
      ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - hl * Math.cos(angle - Math.PI / 6), end.y - hl * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - hl * Math.cos(angle + Math.PI / 6), end.y - hl * Math.sin(angle + Math.PI / 6));
    }
    else if (tool === 'rectangle') { ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y); }
    else if (tool === 'circle') {
      const rx = Math.abs(end.x - start.x) / 2, ry = Math.abs(end.y - start.y) / 2;
      const cx2 = start.x + (end.x - start.x) / 2, cy2 = start.y + (end.y - start.y) / 2;
      ctx.ellipse(cx2, cy2, rx, ry, 0, 0, 2 * Math.PI);
    }
    ctx.stroke(); ctx.setLineDash([]);
    if (fillShape && (tool === 'rectangle' || tool === 'circle')) { ctx.fillStyle = color + '22'; ctx.fill(); }
  }, [color, size, tool, fillShape]);

  const clearOverlay = useCallback(() => {
    const o = overlayRef.current; const c = o?.getContext('2d');
    if (c && o) c.clearRect(0, 0, o.width, o.height);
  }, []);

  // ─── Laser pointer rendering ──────────────────────────
  const renderLaser = useCallback((point: Point) => {
    const overlay = overlayRef.current;
    const ctx = overlay?.getContext('2d');
    if (!ctx || !overlay) return;
    laserTrail.current.push(point);
    if (laserTrail.current.length > 20) laserTrail.current.shift();
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const trail = laserTrail.current;
    for (let i = 0; i < trail.length; i++) {
      const alpha = (i + 1) / trail.length;
      const r = 3 + alpha * 4;
      ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 50, 50, ${alpha * 0.8})`; ctx.fill();
    }
    // Outer glow
    ctx.beginPath(); ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,0,0,0.2)'; ctx.fill();
    // Emit to remote peers
    getSocket().emit('whiteboard:update', { roomId, objects: { action: 'laser', point } });
  }, [roomId]);

  // ─── Drawing handlers ──────────────────────────────────
  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (tool === 'pan') {
      const raw = getRawPoint(e);
      panStart.current = raw;
      panOffsetStart.current = { ...panOffset };
      setIsDrawing(true);
      return;
    }
    const point = getCanvasPoint(e);
    if (tool === 'text') {
      setTextPos(point); setTextValue(''); setTextMode(true);
      setTimeout(() => textInputRef.current?.focus(), 0);
      return;
    }
    if (tool === 'laser') { renderLaser(point); setIsDrawing(true); return; }
    setIsDrawing(true); setLastPoint(point); setShapeStartPoint(point);
  }, [tool, getCanvasPoint, getRawPoint, panOffset, renderLaser]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    if (tool === 'pan' && panStart.current) {
      const raw = getRawPoint(e);
      setPanOffset({ x: panOffsetStart.current.x + raw.x - panStart.current.x, y: panOffsetStart.current.y + raw.y - panStart.current.y });
      return;
    }
    if (tool === 'laser') { renderLaser(getCanvasPoint(e)); return; }
    if (!lastPoint || !shapeStartPoint) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const point = getCanvasPoint(e);
    if (tool === 'draw' || tool === 'eraser' || tool === 'highlighter') {
      ctx.beginPath(); ctx.moveTo(lastPoint.x, lastPoint.y); ctx.lineTo(point.x, point.y);
      if (tool === 'highlighter') {
        ctx.globalAlpha = 0.3; ctx.strokeStyle = color; ctx.lineWidth = size * 6;
      } else if (tool === 'eraser') {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = size * 4;
      } else {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      getSocket().emit('whiteboard:update', { roomId, objects: { action: 'draw-segment', start: lastPoint, end: point, color, size, tool } });
      setLastPoint(point);
    } else if (['line', 'arrow', 'rectangle', 'circle'].includes(tool)) {
      drawShapePreview(shapeStartPoint, point);
    }
  }, [isDrawing, lastPoint, shapeStartPoint, tool, color, size, roomId, getCanvasPoint, getRawPoint, drawShapePreview, renderLaser]);

  const endDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (tool === 'pan') { panStart.current = null; setIsDrawing(false); return; }
    if (tool === 'laser') {
      setIsDrawing(false);
      laserTrail.current = [];
      if (laserTimer.current) clearTimeout(laserTimer.current);
      laserTimer.current = setTimeout(clearOverlay, 600);
      return;
    }
    if (!isDrawing || !shapeStartPoint) { setIsDrawing(false); return; }
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) { setIsDrawing(false); return; }
    const point = getCanvasPoint(e);

    if ((tool === 'draw' || tool === 'eraser' || tool === 'highlighter') && isDrawing) saveSnapshot();

    if (['line', 'arrow', 'rectangle', 'circle'].includes(tool)) {
      clearOverlay(); saveSnapshot();
      ctx.beginPath();
      if (tool === 'line') { ctx.moveTo(shapeStartPoint.x, shapeStartPoint.y); ctx.lineTo(point.x, point.y); }
      else if (tool === 'arrow') {
        ctx.moveTo(shapeStartPoint.x, shapeStartPoint.y); ctx.lineTo(point.x, point.y);
        const angle = Math.atan2(point.y - shapeStartPoint.y, point.x - shapeStartPoint.x);
        const hl = 14;
        ctx.moveTo(point.x, point.y); ctx.lineTo(point.x - hl * Math.cos(angle - Math.PI / 6), point.y - hl * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(point.x, point.y); ctx.lineTo(point.x - hl * Math.cos(angle + Math.PI / 6), point.y - hl * Math.sin(angle + Math.PI / 6));
      }
      else if (tool === 'rectangle') { ctx.rect(shapeStartPoint.x, shapeStartPoint.y, point.x - shapeStartPoint.x, point.y - shapeStartPoint.y); }
      else if (tool === 'circle') {
        const rx = Math.abs(point.x - shapeStartPoint.x) / 2, ry = Math.abs(point.y - shapeStartPoint.y) / 2;
        const cx2 = shapeStartPoint.x + (point.x - shapeStartPoint.x) / 2, cy2 = shapeStartPoint.y + (point.y - shapeStartPoint.y) / 2;
        ctx.ellipse(cx2, cy2, rx, ry, 0, 0, 2 * Math.PI);
      }
      ctx.strokeStyle = color; ctx.lineWidth = size; ctx.stroke();
      if (fillShape && (tool === 'rectangle' || tool === 'circle')) { ctx.fillStyle = color + '33'; ctx.fill(); }
      getSocket().emit('whiteboard:update', { roomId, objects: { action: 'shape', start: shapeStartPoint, end: point, tool, color, size, fill: fillShape } });
    }
    setIsDrawing(false); setLastPoint(null); setShapeStartPoint(null);
  }, [isDrawing, shapeStartPoint, tool, color, size, roomId, fillShape, getCanvasPoint, clearOverlay, saveSnapshot]);

  // ─── Text commit ──────────────────────────────────────
  const commitText = useCallback(() => {
    if (!textPos || !textValue.trim()) { setTextMode(false); return; }
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      saveSnapshot();
      ctx.fillStyle = color; ctx.font = `${size * 4}px 'JetBrains Mono', monospace`;
      ctx.fillText(textValue, textPos.x, textPos.y);
      getSocket().emit('whiteboard:update', { roomId, objects: { action: 'text', point: textPos, text: textValue, color, size } });
    }
    setTextMode(false); setTextValue(''); setTextPos(null);
  }, [textPos, textValue, color, size, roomId, saveSnapshot]);

  // ─── Clear & Export ───────────────────────────────────
  const handleClear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    saveSnapshot();
    clearCanvas(ctx, canvas.width, canvas.height);
    getSocket().emit('whiteboard:update', { roomId, objects: { action: 'clear' } });
  };
  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a'); link.download = `whiteboard-p${currentPage + 1}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png'); link.click();
  };

  // ─── Zoom controls ───────────────────────────────────
  const zoomIn = () => setZoom(z => Math.min(5, z + 0.25));
  const zoomOut = () => setZoom(z => Math.max(0.2, z - 0.25));
  const resetView = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); };

  // ─── Tool definitions ─────────────────────────────────
  const toolList: { key: Tool; label: string; icon: string }[] = [
    { key: 'draw', label: 'Pen', icon: '✏️' },
    { key: 'highlighter', label: 'Highlighter', icon: '🖍️' },
    { key: 'line', label: 'Line', icon: '📏' },
    { key: 'arrow', label: 'Arrow', icon: '➡️' },
    { key: 'rectangle', label: 'Rectangle', icon: '⬜' },
    { key: 'circle', label: 'Circle', icon: '⭕' },
    { key: 'text', label: 'Text', icon: '🅣' },
    { key: 'eraser', label: 'Eraser', icon: '🧹' },
    { key: 'laser', label: 'Laser', icon: '🔴' },
    { key: 'pan', label: 'Pan', icon: '✋' },
  ];

  const cursor = tool === 'eraser' ? 'cursor-cell' : tool === 'text' ? 'cursor-text' : tool === 'pan' ? 'cursor-grab' : tool === 'laser' ? 'cursor-none' : 'cursor-crosshair';

  // ── Toolbar styles ──
  const ROW: React.CSSProperties = { background: '#1a1d24', borderBottom: '1px solid #2a3040', display: 'flex', alignItems: 'center', height: 36, padding: '0 8px', gap: 5, flexShrink: 0 };
  const SEP: React.CSSProperties = { width: 1, height: 18, backgroundColor: '#333', flexShrink: 0 };
  const tbBtn = (active: boolean): React.CSSProperties => ({
    width: 26, height: 26, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, border: 'none', cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
    background: active ? '#00b4d8' : 'transparent', color: active ? '#fff' : '#aab',
  });

  return (
    <div className="flex flex-col h-full" style={{ userSelect: 'none' }}>
      {/* ── Row 1: Tools + Colors + Sizes ── */}
      <div style={ROW}>
        {toolList.map(t => (
          <button key={t.key} onClick={() => setTool(t.key)} title={t.label} style={tbBtn(tool === t.key)}>{t.icon}</button>
        ))}
        <div style={SEP} />
        <button onClick={() => setFillShape(!fillShape)} title={fillShape ? 'Filled' : 'Outline'} style={tbBtn(fillShape)}>
          {fillShape ? '◼' : '◻'}
        </button>
        <div style={SEP} />
        {COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} title={c} style={{
            width: 16, height: 16, borderRadius: '50%', border: color === c ? '2px solid #00b4d8' : '2px solid transparent',
            backgroundColor: c, cursor: 'pointer', flexShrink: 0, padding: 0,
          }} />
        ))}
        <label title="Custom" style={{
          width: 16, height: 16, borderRadius: '50%', border: '1.5px dashed #555', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative',
          backgroundColor: COLORS.includes(color) ? 'transparent' : color,
        }}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
          {COLORS.includes(color) && <span style={{ fontSize: 9, color: '#888', lineHeight: 1 }}>+</span>}
        </label>
        <div style={SEP} />
        {SIZES.map(s => (
          <button key={s} onClick={() => setSize(s)} title={`${s}px`} style={{ ...tbBtn(size === s), width: 22, height: 22 }}>
            <span style={{ width: s + 1, height: s + 1, borderRadius: '50%', backgroundColor: size === s ? '#fff' : '#aab', display: 'block' }} />
          </button>
        ))}
      </div>

      {/* ── Row 2: Background + Slides + Zoom + Undo + Actions ── */}
      <div style={ROW}>
        {/* Background */}
        {BG_MODES.map(m => (
          <button key={m} onClick={() => setBgMode(m)} title={`Bg: ${m}`} style={{ ...tbBtn(bgMode === m), width: 22, fontSize: 12 }}>
            {m === 'plain' ? '▪' : m === 'grid' ? '⊞' : m === 'dots' ? '⠿' : '≡'}
          </button>
        ))}

        <div style={SEP} />

        {/* Slides */}
        <button onClick={prevSlide} title="Prev slide" style={{ ...tbBtn(false), width: 20, fontSize: 11, opacity: currentPage > 0 ? 1 : 0.3 }}>◀</button>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#aab', flexShrink: 0, minWidth: 36, textAlign: 'center' }}>
          {currentPage + 1}/{pages.length}
        </span>
        <button onClick={nextSlide} title="Next slide" style={{ ...tbBtn(false), width: 20, fontSize: 11, opacity: currentPage < pages.length - 1 ? 1 : 0.3 }}>▶</button>
        <button onClick={addPage} title="Add slide" style={{ ...tbBtn(false), width: 20, fontSize: 11 }}>+</button>
        <button onClick={() => setShowSlides(!showSlides)} title={showSlides ? 'Hide slides' : 'Show slides'}
          style={{ ...tbBtn(showSlides), width: 26, fontSize: 11 }}>🗂️</button>

        <div style={{ flex: 1 }} />

        {/* Zoom */}
        <button onClick={zoomOut} style={{ ...tbBtn(false), width: 20, fontSize: 14 }}>−</button>
        <span onClick={resetView} title="Reset zoom" style={{ fontSize: 10, fontFamily: 'monospace', color: '#888', cursor: 'pointer', flexShrink: 0, minWidth: 32, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} style={{ ...tbBtn(false), width: 20, fontSize: 14 }}>+</button>

        <div style={SEP} />

        {/* Undo / Redo */}
        <button onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ ...tbBtn(false), opacity: canUndo ? 1 : 0.3, fontSize: 13 }}>↩</button>
        <button onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{ ...tbBtn(false), opacity: canRedo ? 1 : 0.3, fontSize: 13 }}>↪</button>

        <div style={SEP} />

        {/* Clear / Export */}
        <button onClick={handleClear} title="Clear" style={{ ...tbBtn(false), color: '#ff6b6b', fontSize: 12 }}>🗑️</button>
        <button onClick={handleExport} title="Export" style={{ ...tbBtn(false), color: '#69b3f7', fontSize: 12 }}>💾</button>
      </div>

      {/* ── Canvas ── */}
      <div ref={containerRef} className={clsx('flex-1 min-h-0 relative overflow-hidden', cursor)} style={getBgStyle()}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block"
          style={{ transform: `translate(${panOffset.x}px,${panOffset.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full block pointer-events-none"
          style={{ transform: `translate(${panOffset.x}px,${panOffset.y}px) scale(${zoom})`, transformOrigin: '0 0' }} />

        {textMode && textPos && (
          <div className="absolute z-10" style={{ left: textPos.x * zoom + panOffset.x, top: (textPos.y - size * 4) * zoom + panOffset.y }}>
            <input ref={textInputRef} value={textValue} onChange={e => setTextValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') { setTextMode(false); setTextValue(''); setTextPos(null); } }}
              onBlur={commitText} placeholder="Type…"
              style={{ background: 'rgba(13,15,20,0.9)', border: `1px solid ${color}`, borderRadius: 4, color, fontFamily: "'JetBrains Mono', monospace",
                fontSize: size * 4, padding: '2px 6px', outline: 'none', minWidth: 120, backdropFilter: 'blur(4px)' }} />
          </div>
        )}
      </div>

      {/* ── Slide panel ── */}
      {showSlides && (
        <div style={{ height: 110, background: '#111318', borderTop: '1px solid #2a3040', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', overflowX: 'auto', flexShrink: 0 }}>
          {pages.map((_, i) => (
            <div key={i} onClick={() => { updateThumbnail(currentPage); switchPage(i); }}
              style={{
                flexShrink: 0, width: 140, height: 82, borderRadius: 6, cursor: 'pointer', position: 'relative',
                border: currentPage === i ? '2px solid #00b4d8' : '2px solid #2a3040',
                background: '#0D0F14', overflow: 'hidden', transition: 'border 0.15s',
              }}>
              {slideThumbs[i] ? (
                <img src={slideThumbs[i]} alt={`Slide ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, color: '#555' }}>Empty</span>
                </div>
              )}
              {/* Slide number badge */}
              <span style={{ position: 'absolute', top: 3, left: 5, fontSize: 9, fontFamily: 'monospace', color: '#888', background: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: 3 }}>{i + 1}</span>
              {/* Action buttons */}
              <div style={{ position: 'absolute', bottom: 2, right: 3, display: 'flex', gap: 2 }}>
                <button onClick={(e) => { e.stopPropagation(); duplicatePage(i); }} title="Duplicate"
                  style={{ width: 18, height: 18, borderRadius: 3, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#aab', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⧉</button>
                {pages.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); deletePage(i); }} title="Delete"
                    style={{ width: 18, height: 18, borderRadius: 3, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#ff6b6b', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                )}
              </div>
            </div>
          ))}
          {/* Add slide button */}
          <button onClick={addPage} style={{ flexShrink: 0, width: 140, height: 82, borderRadius: 6, border: '2px dashed #333', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 24, transition: 'border-color 0.15s' }}>
            +
          </button>
        </div>
      )}
    </div>
  );
}
