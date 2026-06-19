<script lang="ts">
  import Icon from '@iconify/svelte';

  type Aspect = 'video' | 'process' | 'flow' | 'auto';

  type Point = {
    x: number;
    y: number;
  };

  type Props = {
    src: string;
    darkSrc?: string;
    alt: string;
    caption?: string;
    figureClass?: string;
    imageClass?: string;
    triggerClass?: string;
    loading?: 'eager' | 'lazy';
    aspect?: Aspect;
  };

  const MAX_ZOOM = 4;
  const MIN_ZOOM = 1;
  const TAP_MOVE_TOLERANCE = 6;
  const ZOOM_BUTTON_STEP = 0.35;
  const ZOOM_WHEEL_STEP = 1.16;

  const {
    src,
    darkSrc,
    alt,
    caption,
    figureClass = '',
    imageClass = 'w-full',
    triggerClass = '',
    loading = 'lazy',
    aspect = 'auto',
  }: Props = $props();

  let isOpen = $state(false);
  let isPanning = $state(false);
  let modalImage = $state<HTMLImageElement>();
  let modalViewport = $state<HTMLDivElement>();
  let offsetX = $state(0);
  let offsetY = $state(0);
  let panPointerId: number | null = null;
  let panStartOffsetX = 0;
  let panStartOffsetY = 0;
  let panStartX = 0;
  let panStartY = 0;
  let pinchStartDistance = 0;
  let pinchStartZoom = MIN_ZOOM;
  let tapMoved = false;
  let tapPointerId: number | null = null;
  let tapStartX = 0;
  let tapStartY = 0;
  let zoom = $state(MIN_ZOOM);

  const activePointers = new Map<number, Point>();

  const modalImageClass = $derived(
    {
      flow: 'h-auto w-[calc(100vw-24px)] max-h-[calc(100svh-24px)] max-w-[calc(100vw-24px)] sm:w-[1100px] sm:max-h-[calc(100svh-48px)] sm:max-w-[calc(100vw-48px)]',
      process:
        'h-auto w-auto max-h-[calc(100svh-24px)] max-w-[calc(100vw-24px)] sm:w-[960px] sm:max-h-[calc(100svh-48px)] sm:max-w-[calc(100vw-48px)]',
      video:
        'h-auto w-auto max-h-[calc(100svh-24px)] max-w-[calc(100vw-24px)] sm:max-h-[calc(100svh-48px)] sm:max-w-[calc(100vw-48px)]',
      auto: 'h-auto w-auto max-h-[calc(100svh-24px)] max-w-[calc(100vw-24px)] sm:max-h-[calc(100svh-48px)] sm:max-w-[calc(100vw-48px)]',
    }[aspect],
  );
  const zoomPercent = $derived(`${Math.round(zoom * 100)}%`);
  const zoomTransform = $derived(
    `transform: translate3d(${offsetX}px, ${offsetY}px, 0) scale(${zoom});`,
  );

  $effect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  });

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function getClampedOffset(x: number, y: number, scale = zoom) {
    if (!(modalImage && modalViewport)) {
      return { x: 0, y: 0 };
    }

    const maxX = Math.max(0, (modalImage.offsetWidth * scale - modalViewport.clientWidth) / 2);
    const maxY = Math.max(0, (modalImage.offsetHeight * scale - modalViewport.clientHeight) / 2);

    return {
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY),
    };
  }

  function resetZoom() {
    zoom = MIN_ZOOM;
    offsetX = 0;
    offsetY = 0;
    isPanning = false;
    panPointerId = null;
    pinchStartDistance = 0;
    tapMoved = false;
    tapPointerId = null;
    activePointers.clear();
  }

  function applyZoom(nextZoom: number, origin?: { clientX: number; clientY: number }) {
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    let nextOffsetX = offsetX;
    let nextOffsetY = offsetY;

    if (origin && modalViewport) {
      const viewport = modalViewport.getBoundingClientRect();
      const originX = origin.clientX - viewport.left - viewport.width / 2;
      const originY = origin.clientY - viewport.top - viewport.height / 2;

      nextOffsetX = originX - ((originX - offsetX) / zoom) * clampedZoom;
      nextOffsetY = originY - ((originY - offsetY) / zoom) * clampedZoom;
    }

    const nextOffset = getClampedOffset(nextOffsetX, nextOffsetY, clampedZoom);

    zoom = clampedZoom;
    offsetX = clampedZoom === MIN_ZOOM ? 0 : nextOffset.x;
    offsetY = clampedZoom === MIN_ZOOM ? 0 : nextOffset.y;
  }

  function zoomIn() {
    applyZoom(zoom + ZOOM_BUTTON_STEP);
  }

  function zoomOut() {
    applyZoom(zoom - ZOOM_BUTTON_STEP);
  }

  function open() {
    resetZoom();
    isOpen = true;
  }

  function close() {
    resetZoom();
    isOpen = false;
  }

  function getPointerDistance(points: Point[]) {
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function startPinch() {
    const points = Array.from(activePointers.values());

    if (points.length < 2) return;

    isPanning = false;
    panPointerId = null;
    pinchStartDistance = getPointerDistance(points);
    pinchStartZoom = zoom;
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();

    applyZoom(zoom * (event.deltaY < 0 ? ZOOM_WHEEL_STEP : 1 / ZOOM_WHEEL_STEP), {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function handlePointerDown(event: PointerEvent) {
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    tapMoved = false;
    tapPointerId = event.pointerId;
    tapStartX = event.clientX;
    tapStartY = event.clientY;

    if (activePointers.size >= 2) {
      tapPointerId = null;
      startPinch();
      return;
    }

    if (zoom <= MIN_ZOOM) return;

    isPanning = true;
    panPointerId = event.pointerId;
    panStartX = event.clientX;
    panStartY = event.clientY;
    panStartOffsetX = offsetX;
    panStartOffsetY = offsetY;
  }

  function handlePointerMove(event: PointerEvent) {
    if (!activePointers.has(event.pointerId)) return;

    event.preventDefault();
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (
      event.pointerId === tapPointerId &&
      Math.hypot(event.clientX - tapStartX, event.clientY - tapStartY) > TAP_MOVE_TOLERANCE
    ) {
      tapMoved = true;
    }

    if (activePointers.size >= 2 && pinchStartDistance > 0) {
      const points = Array.from(activePointers.values());
      const center = {
        clientX: (points[0].x + points[1].x) / 2,
        clientY: (points[0].y + points[1].y) / 2,
      };

      applyZoom(pinchStartZoom * (getPointerDistance(points) / pinchStartDistance), center);
      return;
    }

    if (!isPanning || event.pointerId !== panPointerId) return;

    const nextOffset = getClampedOffset(
      panStartOffsetX + event.clientX - panStartX,
      panStartOffsetY + event.clientY - panStartY,
    );

    offsetX = nextOffset.x;
    offsetY = nextOffset.y;
  }

  function handlePointerUp(event: PointerEvent) {
    const shouldZoomFromTap =
      event.type === 'pointerup' &&
      zoom <= MIN_ZOOM &&
      event.pointerId === tapPointerId &&
      !tapMoved &&
      activePointers.size === 1 &&
      pinchStartDistance === 0;

    activePointers.delete(event.pointerId);

    if (event.pointerId === panPointerId) {
      isPanning = false;
      panPointerId = null;
    }

    if (activePointers.size < 2) {
      pinchStartDistance = 0;
    }

    if (event.pointerId === tapPointerId) {
      tapPointerId = null;
      tapMoved = false;
    }

    if (shouldZoomFromTap) {
      applyZoom(2, { clientX: event.clientX, clientY: event.clientY });
    }
  }

  function handleDoubleClick(event: MouseEvent) {
    event.preventDefault();

    if (zoom > MIN_ZOOM) {
      resetZoom();
      return;
    }

    applyZoom(2, { clientX: event.clientX, clientY: event.clientY });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      close();
      return;
    }

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomIn();
      return;
    }

    if (event.key === '-') {
      event.preventDefault();
      zoomOut();
      return;
    }

    if (event.key === '0') {
      event.preventDefault();
      resetZoom();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<figure class={figureClass}>
  <button
    type="button"
    class="group relative block w-full cursor-zoom-in overflow-hidden text-left {triggerClass}"
    onclick={open}
    aria-label={`Open image: ${alt}`}
  >
    <picture>
      {#if darkSrc}
        <source srcset={darkSrc} media="(prefers-color-scheme: dark)" />
      {/if}
      <img {src} {alt} class={imageClass} {loading} />
    </picture>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/70 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      <Icon icon="mdi:magnify-plus-outline" height="18" width="18" />
    </span>
  </button>
  {#if caption}
    <figcaption class="mt-2 text-xs text-identifier/75">{caption}</figcaption>
  {/if}
</figure>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
    role="dialog"
    aria-modal="true"
    aria-label={alt}
  >
    <button
      type="button"
      class="absolute inset-0 cursor-zoom-out"
      onclick={close}
      aria-label="Close overlay"
    ></button>
    <div
      bind:this={modalViewport}
      class="pointer-events-none relative z-10 grid h-full w-full place-items-center overflow-hidden rounded-lg"
    >
      <div
        class="pointer-events-auto origin-center touch-none select-none transition-transform duration-100 ease-out"
        class:cursor-grab={zoom > MIN_ZOOM && !isPanning}
        class:cursor-grabbing={zoom > MIN_ZOOM && isPanning}
        class:cursor-zoom-in={zoom <= MIN_ZOOM}
        style={zoomTransform}
        role="button"
        tabindex="0"
        aria-label="Zoom image"
        onwheel={handleWheel}
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerUp}
        ondblclick={handleDoubleClick}
      >
        <picture>
          {#if darkSrc}
            <source srcset={darkSrc} media="(prefers-color-scheme: dark)" />
          {/if}
          <img
            bind:this={modalImage}
            {src}
            {alt}
            draggable="false"
            class="block rounded-lg border border-white/15 bg-base-100 object-contain shadow-2xl {modalImageClass}"
          />
        </picture>
      </div>
    </div>
    <div
      class="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center overflow-hidden rounded-full border border-white/15 bg-black/75 text-sm text-white shadow-lg backdrop-blur"
      aria-label="Image zoom controls"
    >
      <button
        type="button"
        class="flex h-10 w-11 items-center justify-center border-r border-white/15 text-xl leading-none transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        onclick={zoomOut}
        disabled={zoom <= MIN_ZOOM}
        aria-label="Zoom out"
      >
        -
      </button>
      <button
        type="button"
        class="flex h-10 min-w-16 items-center justify-center border-r border-white/15 px-3 text-xs font-medium tabular-nums transition-colors hover:bg-white/10"
        onclick={resetZoom}
        aria-label="Reset zoom"
      >
        {zoomPercent}
      </button>
      <button
        type="button"
        class="flex h-10 w-11 items-center justify-center text-xl leading-none transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        onclick={zoomIn}
        disabled={zoom >= MAX_ZOOM}
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
    <button
      type="button"
      class="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/70 text-xl leading-none text-white transition-colors hover:bg-black"
      onclick={close}
      aria-label="Close image"
    >
      <Icon icon="mdi:close" height="22" width="22" />
    </button>
  </div>
{/if}
