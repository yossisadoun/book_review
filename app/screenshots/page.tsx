'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Edit3, Smartphone, RefreshCw, Camera, Copy, ExternalLink, Check } from 'lucide-react';

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
  const [selectedForExport, setSelectedForExport] = useState<string[]>(DEVICES.filter(d => d.required).map(d => d.id));

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
    // Open a new window with specific dimensions for screenshot capture
    const url = `/?screenshot=1&device=${device.id}`;
    window.open(
      url,
      `screenshot_${device.id}`,
      `width=${device.points.w},height=${device.points.h},menubar=no,toolbar=no,location=no,status=no`
    );
  };

  const toggleExportSelection = (deviceId: string) => {
    setSelectedForExport(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

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
      <div className="p-6">
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
                    className="relative bg-black overflow-hidden"
                    style={{
                      width: previewWidth,
                      height: PREVIEW_HEIGHT,
                      borderRadius: 32 * scale,
                      boxShadow: '0 0 0 3px #333, 0 8px 32px rgba(0,0,0,0.4)',
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

                    {/* Promotional overlay */}
                    {showOverlay && (
                      <div
                        className="absolute bottom-0 left-0 right-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 30%, rgba(0,0,0,0.4) 60%, transparent 100%)',
                          padding: `${50 * scale}px ${20 * scale}px ${40 * scale}px`,
                        }}
                      >
                        <p
                          className="text-white font-bold text-center leading-tight"
                          style={{
                            fontSize: Math.max(12, 26 * scale),
                            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                          }}
                        >
                          {overlayText}
                        </p>
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

      {/* Instructions panel */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-start gap-8">
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Download size={14} className="text-blue-400" />
                How to Export Screenshots
              </h3>
              <ol className="text-xs text-slate-400 space-y-1">
                <li>1. Navigate each device preview to the desired app state</li>
                <li>2. Click <ExternalLink size={10} className="inline" /> to open in a new window at correct dimensions</li>
                <li>3. Use Chrome DevTools (Cmd+Shift+P → &quot;Capture screenshot&quot;) or take a screenshot</li>
                <li>4. For exact pixels, use DevTools device toolbar with custom dimensions</li>
              </ol>
            </div>

            <div className="text-xs text-slate-500 border-l border-slate-700 pl-8">
              <p className="font-medium text-slate-400 mb-1">Chrome DevTools Quick Guide:</p>
              <p>1. Open DevTools (Cmd+Option+I)</p>
              <p>2. Toggle device toolbar (Cmd+Shift+M)</p>
              <p>3. Set &quot;Responsive&quot; → &quot;Edit&quot; → Add custom device</p>
              <p>4. Enter exact pixel dimensions</p>
              <p>5. Cmd+Shift+P → &quot;Capture full size screenshot&quot;</p>
            </div>

            <div className="text-xs text-slate-500 border-l border-slate-700 pl-8">
              <p className="font-medium text-slate-400 mb-1">Required Dimensions:</p>
              {DEVICES.map(d => (
                <p key={d.id} className={d.required ? 'text-red-400' : ''}>
                  {d.id}: {d.width}×{d.height} {d.required ? '★' : ''}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
