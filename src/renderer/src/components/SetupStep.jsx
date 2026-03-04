import { useState, useEffect, useRef } from "react";
import { Play, MapPin, AlertTriangle, ExternalLink, Check } from "lucide-react";
import { config } from "../config";

// Shot count options — filter to those ≥ selectCount
const ALL_SHOT_OPTIONS = [2, 4, 6, 8];

export default function SetupStep({ defaultSettings, onStart, winLocStatus: preloadedWinLocStatus = null, onSettingsChange }) {
  const [settings, setSettings] = useState(defaultSettings);
  // App.jsx 초기 로딩에서 pre-cache된 값을 초기값으로 사용
  const [winLocStatus, setWinLocStatus] = useState(preloadedWinLocStatus);
  // 이미 preload된 경우 IPC 재호출 방지
  const checkedRef = useRef(preloadedWinLocStatus !== null);

  // 위치 토글이 ON으로 바뀌었을 때만 — 아직 캐시된 값이 없는 경우에 한해 확인
  useEffect(() => {
    if (!settings.enableLocation) return;
    if (checkedRef.current) return;
    checkedRef.current = true;
    window.electronAPI.checkWindowsLocation()
      .then(r => setWinLocStatus(r.enabled))
      .catch(() => {});
  }, [settings.enableLocation]);

  const handleLayoutChange = (layout) => {
    const newSelectCount = layout.cols * layout.rows;
    const validOptions = ALL_SHOT_OPTIONS.filter((n) => n >= newSelectCount);
    const totalShots = validOptions.includes(settings.totalShots)
      ? settings.totalShots
      : validOptions[0];

    setSettings((s) => ({
      ...s,
      layout,
      selectCount: newSelectCount,
      totalShots,
    }));
  };

  const shotOptions = ALL_SHOT_OPTIONS.filter((n) => n >= settings.selectCount);
  const totalTimeSec = settings.totalShots * settings.intervalSeconds;
  const minutes = Math.floor(totalTimeSec / 60);
  const seconds = totalTimeSec % 60;

  return (
    <div className="flex items-center justify-center h-full py-3 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-4xl font-black tracking-tight mb-1">
            PhotoBooth
          </h1>
          <p className="text-gray-400 text-sm">
            설정을 확인하고 촬영을 시작하세요.
          </p>
        </div>

        {/* Config card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">
          {/* ── 레이아웃 (visual preview cards) ────────────────────────── */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              프레임 레이아웃
            </label>
            <div className="grid grid-cols-4 gap-3">
              {config.layouts.map((layout) => (
                <FramePreviewCard
                  key={layout.id}
                  layout={layout}
                  active={settings.layout.id === layout.id}
                  onClick={() => handleLayoutChange(layout)}
                />
              ))}
            </div>
          </div>

          {/* ── 배경 효과 + 색상 ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-300">
              배경 효과
            </label>

            {/* Effect type selector */}
            <div className="grid grid-cols-3 gap-2">
              {config.bgEffects.map(effect => (
                <button
                  key={effect.id}
                  onClick={() => setSettings(s => ({ ...s, bgEffect: effect.id }))}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all ${
                    settings.bgEffect === effect.id
                      ? 'border-pink-500 bg-pink-950/40'
                      : 'border-gray-700 bg-gray-800/30 hover:border-gray-500'
                  }`}
                >
                  <BgEffectPreview id={effect.id} active={settings.bgEffect === effect.id} />
                  <span className={`text-sm font-semibold ${settings.bgEffect === effect.id ? 'text-pink-400' : 'text-gray-300'}`}>
                    {effect.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Color picker — 단색 모드에서만 표시 */}
            {settings.bgEffect === 'solid' && (
              <div className="bg-gray-800/40 rounded-xl px-3 py-2.5 flex items-center gap-3">
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  배경 색상
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {config.frameColors.map(color => (
                    <button
                      key={color.id}
                      onClick={() => setSettings(s => ({ ...s, frameColor: color }))}
                      title={color.label}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        settings.frameColor?.id === color.id
                          ? 'border-pink-500 scale-110 shadow-md shadow-pink-500/30'
                          : 'border-gray-600 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color.value }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── 총 촬영 횟수 ─────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              총 촬영 횟수{" "}
              <span className="text-gray-500 font-normal text-xs">
                ({settings.selectCount}컷 중 {settings.selectCount}장 선택)
              </span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {shotOptions.map((n) => (
                <button
                  key={n}
                  onClick={() => setSettings((s) => ({ ...s, totalShots: n }))}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    settings.totalShots === n
                      ? "bg-pink-500 text-white shadow-lg shadow-pink-500/25"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {n}장
                </button>
              ))}
            </div>
          </div>

          {/* ── 촬영 간격 + 카운트다운 (2-column) ─────────────────────── */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-semibold text-gray-300">
                  촬영 간격
                </label>
                <span className="text-pink-400 font-bold text-sm">
                  {settings.intervalSeconds}초
                </span>
              </div>
              <input
                type="range"
                min={4}
                max={15}
                step={1}
                value={settings.intervalSeconds}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    intervalSeconds: Number(e.target.value),
                  }))
                }
                className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-pink-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>4초</span>
                <span>15초</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-sm font-semibold text-gray-300">
                  카운트다운
                </label>
                <span className="text-pink-400 font-bold text-sm">
                  {settings.countdownSeconds}초
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={settings.countdownSeconds}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    countdownSeconds: Number(e.target.value),
                  }))
                }
                className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-pink-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>1초</span>
                <span>5초</span>
              </div>
            </div>
          </div>

          {/* ── 위치 정보 저장 ──────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-gray-400" />
                <span className="text-sm font-semibold text-gray-300">위치 정보 저장</span>
                <span className="text-xs text-gray-600">사진 EXIF에 GPS 기록</span>
              </div>
              {/* 토글 스위치 */}
              <button
                onClick={() => {
                  const newVal = !settings.enableLocation;
                  setSettings(s => ({ ...s, enableLocation: newVal }));
                  onSettingsChange?.({ enableLocation: newVal });
                }}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  settings.enableLocation ? 'bg-pink-500' : 'bg-gray-700'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  settings.enableLocation ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Windows 위치 서비스 상태 */}
            {settings.enableLocation && (
              <div className="mt-2">
                {winLocStatus === null && (
                  <p className="text-xs text-gray-500 pl-1">Windows 위치 서비스 확인 중...</p>
                )}
                {winLocStatus === true && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <Check size={13} />
                    Windows 위치 서비스 켜짐 — Wi-Fi 기반 위치를 사용합니다
                  </div>
                )}
                {winLocStatus === false && (
                  <div className="flex items-center justify-between bg-amber-950/40 border border-amber-800/60 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <AlertTriangle size={13} className="flex-shrink-0" />
                      Windows 위치 서비스가 꺼져 있습니다. IP 기반 위치(도시 수준)로 저장됩니다.
                    </div>
                    <button
                      onClick={() => window.electronAPI.openLocationSettings()}
                      className="flex items-center gap-1 text-xs text-amber-300 hover:text-white whitespace-nowrap ml-3 underline underline-offset-2"
                    >
                      설정 열기
                      <ExternalLink size={11} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Summary ─────────────────────────────────────────────────── */}
          <div className="bg-gray-800/60 rounded-xl p-3 text-xs text-gray-400 flex items-center justify-between">
            <span>예상 촬영 시간</span>
            <span className="text-white font-semibold">
              약 {minutes > 0 ? `${minutes}분 ` : ""}
              {seconds}초
            </span>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={() => onStart(settings)}
          className="w-full mt-3 py-4 bg-pink-500 hover:bg-pink-400 active:scale-95 text-white font-bold text-lg rounded-2xl transition-all shadow-xl shadow-pink-500/20 flex items-center justify-center gap-3"
        >
          <Play size={20} fill="currentColor" />
          촬영 시작
        </button>
      </div>
    </div>
  );
}

// ─── BgEffectPreview ──────────────────────────────────────────────────────────
// 배경 효과 버튼 안에 들어가는 미니 시각 예시

function BgEffectPreview({ id, active }) {
  const slot = active ? '#ec4899' : '#374151'

  if (id === 'none') {
    // Plain camera icon — no background processing
    return (
      <svg width="36" height="24" viewBox="0 0 36 24" style={{ borderRadius: 4, flexShrink: 0 }}>
        <rect width="36" height="24" fill={active ? '#2d0a1a' : '#111827'} rx="3" />
        {/* Camera body */}
        <rect x="6" y="8" width="24" height="10" rx="2" fill={slot} opacity={active ? 0.8 : 0.7} />
        {/* Lens */}
        <circle cx="18" cy="13" r="3.5" fill={active ? '#2d0a1a' : '#111827'} opacity="0.9" />
        <circle cx="18" cy="13" r="2" fill={slot} opacity={active ? 0.5 : 0.4} />
        {/* Flash bump */}
        <rect x="12" y="5.5" width="5" height="3" rx="1" fill={slot} opacity={active ? 0.7 : 0.5} />
      </svg>
    )
  }

  if (id === 'solid') {
    return (
      <svg width="36" height="24" viewBox="0 0 36 24" style={{ borderRadius: 4, flexShrink: 0 }}>
        <rect width="36" height="24" fill={active ? '#2d0a1a' : '#111827'} rx="3" />
        <rect x="4" y="4" width="28" height="12" rx="2" fill={slot} opacity={active ? 0.8 : 0.7} />
        <rect x="4" y="19" width="28" height="2" rx="1" fill={active ? '#9d174d' : '#1f2937'} />
      </svg>
    )
  }

  // blur
  return (
    <svg width="36" height="24" viewBox="0 0 36 24" style={{ borderRadius: 4, flexShrink: 0 }}>
      <defs>
        <filter id="bg-blur">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      {/* 블러된 배경 */}
      <rect width="36" height="24" fill="#1e3a5f" rx="3" />
      <rect x="0" y="0" width="20" height="24" fill="#7c3aed" filter="url(#bg-blur)" opacity="0.6" />
      <rect x="16" y="0" width="20" height="24" fill="#ec4899" filter="url(#bg-blur)" opacity="0.5" />
      {/* 슬롯 */}
      <rect x="4" y="4" width="28" height="12" rx="2" fill="white" opacity="0.2" />
      <rect x="4" y="19" width="28" height="2" rx="1" fill="white" opacity="0.3" />
    </svg>
  )
}

// ─── FramePreviewCard ─────────────────────────────────────────────────────────
// Renders a miniature of the actual output frame proportions,
// with photo slots placed exactly as compositePhotos() would draw them.

function FramePreviewCard({ layout, active, onClick }) {
  const { cols, rows } = layout;
  const dims = config.frameDimensions[layout.id] || {
    width: 640,
    height: 1280,
  };

  // ── Scale SVG to fit in a 106 × 80 px bounding box ───────────────────────
  const PREVIEW_H = 106;
  const MAX_W = 80;
  const aspectRatio = dims.height / dims.width; // H/W (>1 means portrait)

  let svgH = PREVIEW_H;
  let svgW = PREVIEW_H / aspectRatio;
  if (svgW > MAX_W) {
    svgW = MAX_W;
    svgH = MAX_W * aspectRatio;
  }

  // ── Photo slot positions in the actual canvas coordinate space ────────────
  const { photoMargin: m, footerHeight: fh } = config;
  const W = dims.width;
  const H = dims.height;
  const photoW = (W - m * (cols + 1)) / cols;
  const photoH = (H - fh - m * (rows + 1)) / rows;
  const footerY = H - fh;

  // ── Colours ───────────────────────────────────────────────────────────────
  const frameBg = active ? "#2d0a1a" : "#111827";
  const slotFill = active ? "#ec4899" : "#374151";
  const slotOpacity = active ? 0.75 : 1;
  const dividerClr = active ? "#9d174d" : "#1f2937";
  const borderClr = active ? "#ec4899" : "#374151";

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 py-3 px-2 rounded-2xl border-2 transition-all focus:outline-none ${
        active
          ? "border-pink-500 bg-pink-950/40 shadow-lg shadow-pink-500/15"
          : "border-gray-700 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-800/50"
      }`}
    >
      {/* ── Miniature frame ── */}
      <div
        className="flex items-center justify-center"
        style={{ height: PREVIEW_H, width: MAX_W }}
      >
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${W} ${H}`}
          style={{ borderRadius: 6, overflow: "hidden" }}
        >
          {/* Frame background */}
          <rect x="0" y="0" width={W} height={H} fill={frameBg} />

          {/* Photo slots */}
          {Array.from({ length: rows }).flatMap((_, r) =>
            Array.from({ length: cols }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={m + c * (photoW + m)}
                y={m + r * (photoH + m)}
                width={photoW}
                height={photoH}
                rx={20}
                fill={slotFill}
                opacity={slotOpacity}
              />
            )),
          )}

          {/* Footer divider */}
          <rect
            x={m * 2}
            y={footerY + 8}
            width={W - m * 4}
            height={6}
            rx={3}
            fill={dividerClr}
          />

          {/* Frame border overlay */}
          <rect
            x="1"
            y="1"
            width={W - 2}
            height={H - 2}
            rx="4"
            fill="none"
            stroke={borderClr}
            strokeWidth="6"
          />
        </svg>
      </div>

      {/* ── Label ── */}
      <div className="text-center leading-tight">
        <div
          className={`text-sm font-bold ${active ? "text-pink-400" : "text-gray-300"}`}
        >
          {layout.label}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{cols * rows}장 선택</div>
      </div>
    </button>
  );
}
