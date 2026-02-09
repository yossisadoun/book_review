'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { Download, Edit3, Smartphone, RefreshCw, Camera, Copy, ExternalLink, Check, Loader2 } from 'lucide-react';

// Device specifications for App Store
const DEVICES = [
  { id: '6.7-inch', name: 'iPhone 15 Pro Max', width: 1290, height: 2796, required: true },
  { id: '6.5-inch', name: 'iPhone 11 Pro Max', width: 1242, height: 2688, required: false },
  { id: '6.1-inch', name: 'iPhone 15 Pro', width: 1179, height: 2556, required: false },
  { id: '5.5-inch', name: 'iPhone 8 Plus', width: 1242, height: 2208, required: false },
];

// Preview scale to fit on screen
const PREVIEW_HEIGHT = 550;

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
  const [selectedDevice, setSelectedDevice] = useState(DEVICES[0]);

  const iframeRefs = useRef<{ [key: string]: HTMLIFrameElement | null }>({});

  const getPreviewScale = (device: typeof DEVICES[0]) => {
    return PREVIEW_HEIGHT / device.height;
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

  // Export by capturing from inside the iframe at 1:1 scale
  const exportDevice = useCallback(async (device: typeof DEVICES[0]) => {
    const iframe = iframeRefs.current[device.id];
    if (!iframe) return;

    setExporting(device.id);

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc || !iframeDoc.body) {
        throw new Error('Cannot access iframe document');
      }

      // Wait for any animations to settle
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture the iframe body at 1:1 scale (it's already at export resolution)
      const dataUrl = await toPng(iframeDoc.body, {
        width: device.width,
        height: device.height,
        pixelRatio: 1, // 1:1 since iframe is at full resolution
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      // If overlay is enabled, composite it on top
      if (showOverlay && overlayText) {
        const canvas = document.createElement('canvas');
        canvas.width = device.width;
        canvas.height = device.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Draw the captured app content
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = dataUrl;
          });
          ctx.drawImage(img, 0, 0);

          // Draw glassmorphic overlay at bottom
          const overlayPadding = 60;
          const overlayHeight = 100;
          const overlayWidth = Math.min(device.width - 80, 800);
          const overlayX = (device.width - overlayWidth) / 2;
          const overlayY = device.height - overlayHeight - overlayPadding;
          const borderRadius = 24;

          // Draw rounded rectangle with semi-transparent white
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.beginPath();
          ctx.roundRect(overlayX, overlayY, overlayWidth, overlayHeight, borderRadius);
          ctx.fill();

          // Draw border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw text
          ctx.fillStyle = '#1e293b';
          ctx.font = `bold ${Math.round(device.width / 18)}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(overlayText, device.width / 2, overlayY + overlayHeight / 2);

          // Download
          const link = document.createElement('a');
          link.download = `${screenshotName}_${device.id}_${device.width}x${device.height}.png`;
          link.href = canvas.toDataURL('image/png', 1.0);
          link.click();
        }
      } else {
        // Download without overlay
        const link = document.createElement('a');
        link.download = `${screenshotName}_${device.id}_${device.width}x${device.height}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed for ${device.name}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
  }, [screenshotName, showOverlay, overlayText]);

  // Export all devices
  const exportAllDevices = useCallback(async () => {
    setExportingAll(true);
    setExportProgress({ current: 0, total: DEVICES.length });

    for (let i = 0; i < DEVICES.length; i++) {
      const device = DEVICES[i];
      setExportProgress({ current: i + 1, total: DEVICES.length });
      setSelectedDevice(device);

      // Wait for iframe to update
      await new Promise(resolve => setTimeout(resolve, 500));

      await exportDevice(device);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setExportingAll(false);
    setExportProgress({ current: 0, total: 0 });
  }, [exportDevice]);

  const scale = getPreviewScale(selectedDevice);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-4 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Camera size={24} className="text-blue-400" />
              App Store Screenshots
            </h1>

            <div className="h-6 w-px bg-slate-700" />

            {/* Device selector */}
            <select
              value={selectedDevice.id}
              onChange={(e) => setSelectedDevice(DEVICES.find(d => d.id === e.target.value) || DEVICES[0])}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm"
            >
              {DEVICES.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.width}×{device.height}) {device.required ? '★' : ''}
                </option>
              ))}
            </select>

            {/* Filename */}
            <input
              type="text"
              value={screenshotName}
              onChange={(e) => setScreenshotName(e.target.value)}
              placeholder="filename"
              className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm w-28"
            />

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

            {/* Refresh */}
            <button
              onClick={() => refreshIframe(selectedDevice.id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              <RefreshCw size={14} />
              Refresh
            </button>

            <div className="flex-1" />

            {/* Export buttons */}
            <button
              onClick={() => exportDevice(selectedDevice)}
              disabled={!!exporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 rounded text-sm font-semibold"
            >
              {exporting === selectedDevice.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export {selectedDevice.id}
            </button>

            <button
              onClick={exportAllDevices}
              disabled={exportingAll}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 rounded text-sm font-semibold"
            >
              {exportingAll ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {exportProgress.current}/{exportProgress.total}
                </>
              ) : (
                <>
                  <Download size={16} />
                  Export All
                </>
              )}
            </button>
          </div>

          {/* Overlay text editor */}
          {showOverlay && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-slate-400">Overlay text:</span>
              <input
                type="text"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                className="flex-1 max-w-md bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm"
              />
              <div className="flex gap-1">
                {[
                  'Discover the world around your books',
                  'Your personal bookshelf',
                  'Podcasts, videos & more',
                ].map((text) => (
                  <button
                    key={text}
                    onClick={() => setOverlayText(text)}
                    className={`text-xs px-2 py-1 rounded ${
                      overlayText === text ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {text.slice(0, 15)}...
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main preview area */}
      <div className="flex justify-center p-6 pb-24">
        <div className="flex gap-8 items-start">
          {/* Device preview - iframe at FULL resolution, scaled down visually */}
          <div className="flex flex-col items-center">
            <div className="mb-3 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-slate-400" />
                <span className="font-semibold">{selectedDevice.name}</span>
                {selectedDevice.required && (
                  <span className="text-xs bg-red-500 px-2 py-0.5 rounded">REQUIRED</span>
                )}
              </div>
              <span className="text-sm text-slate-400">
                {selectedDevice.width} × {selectedDevice.height}
              </span>
              <button
                onClick={() => copyDimensions(selectedDevice)}
                className="p-1 bg-slate-700 hover:bg-slate-600 rounded"
              >
                {copiedDevice === selectedDevice.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Device frame container */}
            <div
              className="relative bg-black rounded-[40px] overflow-hidden"
              style={{
                width: selectedDevice.width * scale,
                height: selectedDevice.height * scale,
                boxShadow: '0 0 0 4px #333, 0 25px 50px rgba(0,0,0,0.5)',
              }}
            >
              {/* Iframe at FULL export resolution, scaled down with transform */}
              <iframe
                key={`${selectedDevice.id}-${iframeKeys[selectedDevice.id] || 0}`}
                ref={(el) => { iframeRefs.current[selectedDevice.id] = el; }}
                src="/"
                className="border-0 bg-white"
                style={{
                  width: selectedDevice.width,
                  height: selectedDevice.height,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              />

              {/* Preview overlay (visual only - actual overlay drawn on export) */}
              {showOverlay && (
                <div
                  className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none"
                  style={{ padding: 60 * scale, paddingTop: 0 }}
                >
                  <div
                    className="px-6 py-4 text-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      borderRadius: 24 * scale,
                      border: '2px solid rgba(255, 255, 255, 0.6)',
                      maxWidth: Math.min(selectedDevice.width - 80, 800) * scale,
                    }}
                  >
                    <p
                      className="font-bold text-slate-800"
                      style={{ fontSize: Math.round(selectedDevice.width / 18) * scale }}
                    >
                      {overlayText}
                    </p>
                  </div>
                </div>
              )}

              {/* Dynamic Island */}
              <div
                className="absolute top-2 left-1/2 -translate-x-1/2 bg-black rounded-full"
                style={{
                  width: 120 * scale,
                  height: 36 * scale,
                }}
              />
            </div>
          </div>

          {/* Device selector panel */}
          <div className="w-64 bg-slate-800/50 rounded-xl p-4">
            <h3 className="font-semibold mb-3 text-sm">All Devices</h3>
            <div className="space-y-2">
              {DEVICES.map(device => (
                <button
                  key={device.id}
                  onClick={() => setSelectedDevice(device)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedDevice.id === device.id
                      ? 'bg-blue-600'
                      : 'bg-slate-700/50 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{device.name}</span>
                    {device.required && (
                      <span className="text-[10px] bg-red-500 px-1.5 py-0.5 rounded">REQ</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {device.width} × {device.height}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700 text-xs text-slate-500">
              <p className="mb-2 font-medium text-slate-400">How it works:</p>
              <ul className="space-y-1">
                <li>• Iframe renders at full resolution</li>
                <li>• Scaled down for preview</li>
                <li>• Export captures at 1:1 scale</li>
                <li>• Overlay composited on top</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Preview scale: {(scale * 100).toFixed(0)}% • Export: {selectedDevice.width}×{selectedDevice.height}px
          </div>
          <button
            onClick={() => exportDevice(selectedDevice)}
            disabled={!!exporting}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 rounded-lg font-semibold"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Export PNG
          </button>
        </div>
      </div>
    </div>
  );
}
