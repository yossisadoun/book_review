'use client';

import { useState, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Download, Edit3, Smartphone, RefreshCw, Camera, Copy, ExternalLink, Check, Loader2 } from 'lucide-react';

// Device specifications for App Store
const DEVICES = [
  { id: '6.7-inch', name: 'iPhone 15 Pro Max', width: 1290, height: 2796, points: { w: 430, h: 932 }, required: true },
  { id: '6.5-inch', name: 'iPhone 11 Pro Max', width: 1242, height: 2688, points: { w: 414, h: 896 }, required: false },
  { id: '6.1-inch', name: 'iPhone 15 Pro', width: 1179, height: 2556, points: { w: 393, h: 852 }, required: false },
  { id: '5.5-inch', name: 'iPhone 8 Plus', width: 1242, height: 2208, points: { w: 414, h: 736 }, required: false },
];

// Preview heights for side-by-side view
const PREVIEW_HEIGHT = 500;

export default function ScreenshotsPage() {
  const [overlayText, setOverlayText] = useState('Discover the world around your books');
  const [isEditingText, setIsEditingText] = useState(false);
  const [screenshotName, setScreenshotName] = useState('bookshelf');
  const [showOverlay, setShowOverlay] = useState(true);
  const [iframeKeys, setIframeKeys] = useState<{ [key: string]: number }>({});
  const [copiedDevice, setCopiedDevice] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  // Refs for each device container and overlay
  const deviceRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const overlayRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const getPreviewScale = (device: typeof DEVICES[0]) => {
    return PREVIEW_HEIGHT / device.points.h;
  };

  const refreshAllIframes = () => {
    const newKeys: { [key: string]: number } = {};
    DEVICES.forEach(d => {
      newKeys[d.id] = (iframeKeys[d.id] || 0) + 1;
    });
    setIframeKeys(newKeys);
  };

  const refreshIframe = (deviceId: string) => {
    setIframeKeys(prev => ({
      ...prev,
      [deviceId]: (prev[deviceId] || 0) + 1,
    }));
  };

  const copyDimensions = (device: typeof DEVICES[0]) => {
    navigator.clipboard.writeText(`${device.width}x${device.height}`);
    setCopiedDevice(device.id);
    setTimeout(() => setCopiedDevice(null), 2000);
  };

  const openInNewTab = (device: typeof DEVICES[0]) => {
    const url = `/?screenshot=1&device=${device.id}`;
    window.open(
      url,
      `screenshot_${device.id}`,
      `width=${device.points.w},height=${device.points.h},menubar=no,toolbar=no,location=no,status=no`
    );
  };

  // Export a single device screenshot
  const exportDevice = useCallback(async (device: typeof DEVICES[0]) => {
    const container = deviceRefs.current[device.id];
    const overlay = overlayRefs.current[device.id];
    if (!container) return;

    setExporting(device.id);

    try {
      const scale = getPreviewScale(device);
      const pixelRatio = device.width / (device.points.w * scale);

      // Try to capture iframe content first
      const iframe = container.querySelector('iframe') as HTMLIFrameElement | null;
      let iframeDataUrl: string | null = null;

      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc && iframeDoc.body) {
            await new Promise(resolve => setTimeout(resolve, 200));

            iframeDataUrl = await toPng(iframeDoc.body, {
              width: device.points.w,
              height: device.points.h,
              pixelRatio: device.width / device.points.w,
              backgroundColor: '#ffffff',
            });
          }
        } catch (iframeError) {
          console.log('Could not capture iframe:', iframeError);
        }
      }

      // Capture just the overlay element with transparent background
      let overlayDataUrl: string | null = null;
      if (overlay && showOverlay) {
        try {
          overlayDataUrl = await toPng(overlay, {
            pixelRatio,
            backgroundColor: 'transparent',
          });
        } catch (overlayError) {
          console.log('Could not capture overlay:', overlayError);
        }
      }

      // Combine images on canvas
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = device.width;
      finalCanvas.height = device.height;
      const ctx = finalCanvas.getContext('2d');

      if (ctx) {
        // Draw iframe content or placeholder
        if (iframeDataUrl) {
          const iframeImg = new Image();
          await new Promise((resolve, reject) => {
            iframeImg.onload = resolve;
            iframeImg.onerror = reject;
            iframeImg.src = iframeDataUrl!;
          });
          ctx.drawImage(iframeImg, 0, 0, device.width, device.height);
        } else {
          // Draw nice placeholder background
          const gradient = ctx.createLinearGradient(0, 0, 0, device.height);
          gradient.addColorStop(0, '#f8fafc');
          gradient.addColorStop(1, '#e2e8f0');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, device.width, device.height);

          // Draw placeholder text
          ctx.fillStyle = '#94a3b8';
          ctx.font = `bold ${36 * (device.width / 430)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.fillText('App Screenshot', device.width / 2, device.height / 2 - 20);
          ctx.font = `${20 * (device.width / 430)}px system-ui`;
          ctx.fillText('Use DevTools for actual content', device.width / 2, device.height / 2 + 30);
        }

        // Draw overlay on top if captured
        if (overlayDataUrl) {
          const overlayImg = new Image();
          await new Promise((resolve, reject) => {
            overlayImg.onload = resolve;
            overlayImg.onerror = reject;
            overlayImg.src = overlayDataUrl;
          });
          // Position overlay at bottom of canvas
          const overlayHeight = overlay!.offsetHeight * pixelRatio;
          const overlayWidth = overlay!.offsetWidth * pixelRatio;
          const overlayX = (device.width - overlayWidth) / 2;
          const overlayY = device.height - overlayHeight - (32 * scale * pixelRatio);
          ctx.drawImage(overlayImg, overlayX, overlayY, overlayWidth, overlayHeight);
        }

        // Download
        const link = document.createElement('a');
        link.download = `${screenshotName}_${device.id}_${device.width}x${device.height}.png`;
        link.href = finalCanvas.toDataURL('image/png', 1.0);
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed for ${device.name}. Check console for details.`);
    } finally {
      setExporting(null);
    }
  }, [screenshotName, showOverlay]);

  // Export all devices
  const exportAllDevices = useCallback(async () => {
    setExportingAll(true);
    setExportProgress({ current: 0, total: DEVICES.length });

    for (let i = 0; i < DEVICES.length; i++) {
      const device = DEVICES[i];
      setExportProgress({ current: i + 1, total: DEVICES.length });
      await exportDevice(device);
      // Small delay between exports
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setExportingAll(false);
    setExportProgress({ current: 0, total: 0 });
  }, [exportDevice]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-4 z-50">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Camera size={24} className="text-blue-400" />
              App Store Screenshots
            </h1>

            <div className="h-6 w-px bg-slate-700" />

            {/* Filename */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Name:</span>
              <input
                type="text"
                value={screenshotName}
                onChange={(e) => setScreenshotName(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm w-28"
              />
            </div>

            {/* Overlay toggle */}
            <button
              onClick={() => setShowOverlay(!showOverlay)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                showOverlay ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showOverlay ? 'bg-green-400' : 'bg-slate-500'}`} />
              Overlay
            </button>

            {/* Refresh all */}
            <button
              onClick={refreshAllIframes}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              <RefreshCw size={14} />
              Refresh All
            </button>

            <div className="flex-1" />

            {/* Export All Button */}
            <button
              onClick={exportAllDevices}
              disabled={exportingAll}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors"
            >
              {exportingAll ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Exporting {exportProgress.current}/{exportProgress.total}...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Export All PNGs
                </>
              )}
            </button>

            {/* Overlay text editor */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Text:</span>
              {isEditingText ? (
                <input
                  type="text"
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  onBlur={() => setIsEditingText(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingText(false)}
                  className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm w-64"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setIsEditingText(true)}
                  className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm hover:bg-slate-700 max-w-xs truncate"
                >
                  <span className="truncate">{overlayText}</span>
                  <Edit3 size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Quick text presets */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {[
              'Discover the world around your books',
              'Your personal bookshelf',
              'Deep dive into every book',
              'Podcasts, videos & more',
              'Join the conversation',
              'Stay connected with readers',
            ].map((text) => (
              <button
                key={text}
                onClick={() => setOverlayText(text)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  overlayText === text
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Device previews - side by side */}
      <div className="p-6 pb-32">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex gap-6 overflow-x-auto pb-4">
            {DEVICES.map((device) => {
              const scale = getPreviewScale(device);
              const previewWidth = device.points.w * scale;

              return (
                <div key={device.id} className="flex-shrink-0">
                  {/* Device header */}
                  <div className="mb-3 flex items-center justify-between" style={{ width: previewWidth }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <Smartphone size={14} className="text-slate-400" />
                        <span className="font-medium text-sm">{device.name}</span>
                        {device.required && (
                          <span className="text-[10px] bg-red-500/80 px-1.5 py-0.5 rounded font-medium">
                            REQUIRED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {device.id} • {device.width}×{device.height}px
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Export single device */}
                      <button
                        onClick={() => exportDevice(device)}
                        disabled={exporting === device.id || exportingAll}
                        className="p-1.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 rounded"
                        title="Export PNG"
                      >
                        {exporting === device.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Download size={12} />
                        )}
                      </button>
                      <button
                        onClick={() => copyDimensions(device)}
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                        title="Copy dimensions"
                      >
                        {copiedDevice === device.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      </button>
                      <button
                        onClick={() => refreshIframe(device.id)}
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded"
                        title="Refresh"
                      >
                        <RefreshCw size={12} />
                      </button>
                      <button
                        onClick={() => openInNewTab(device)}
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded"
                        title="Open in new window"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Device frame */}
                  <div
                    ref={(el) => { deviceRefs.current[device.id] = el; }}
                    className="relative bg-black overflow-hidden"
                    style={{
                      width: previewWidth,
                      height: PREVIEW_HEIGHT,
                      borderRadius: 32 * scale,
                    }}
                  >
                    {/* App content via iframe */}
                    <iframe
                      key={iframeKeys[device.id] || 0}
                      src="/"
                      className="border-0 bg-white pointer-events-auto"
                      style={{
                        width: device.points.w,
                        height: device.points.h,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                      }}
                    />

                    {/* Promotional overlay - glassmorphic notification style */}
                    {showOverlay && (
                      <div
                        className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none"
                        style={{
                          padding: `${20 * scale}px`,
                          paddingBottom: `${32 * scale}px`,
                        }}
                      >
                        <div
                          ref={(el) => { overlayRefs.current[device.id] = el; }}
                          style={{
                            padding: `${16 * scale}px ${24 * scale}px`,
                            background: 'rgba(255, 255, 255, 0.85)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                            borderRadius: 16 * scale,
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                            maxWidth: '90%',
                          }}
                        >
                          <p
                            className="text-slate-900 font-bold text-center leading-tight"
                            style={{
                              fontSize: Math.max(12, 22 * scale),
                            }}
                          >
                            {overlayText}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Dynamic Island */}
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 bg-black rounded-b-2xl pointer-events-none"
                      style={{
                        width: 120 * scale,
                        height: 34 * scale,
                        marginTop: 8 * scale,
                      }}
                    />
                  </div>

                  {/* Export info */}
                  <div className="mt-3 text-center">
                    <div className="text-xs text-slate-500">
                      Export: {device.width} × {device.height}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1">
                      {screenshotName}_{device.id}.png
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom panel */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-slate-400">Ready to export:</span>
                <span className="ml-2 font-medium">{DEVICES.length} screenshots</span>
              </div>
              <div className="text-xs text-slate-500">
                {DEVICES.map(d => `${d.id}: ${d.width}×${d.height}`).join(' • ')}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <p className="text-xs text-slate-500">
                Note: If export quality is poor, use the <ExternalLink size={10} className="inline mx-1" /> button and Chrome DevTools for pixel-perfect capture.
              </p>
              <button
                onClick={exportAllDevices}
                disabled={exportingAll}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
              >
                {exportingAll ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Exporting {exportProgress.current}/{exportProgress.total}...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Export All PNGs
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
