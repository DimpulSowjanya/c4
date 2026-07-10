'use client';

import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Landmark, Sparkles } from 'lucide-react';
import { Zone, Edge } from '../services/StadiumGraph';

interface MapProps {
  zones: Zone[];
  edges: Edge[];
  activePath: string[];
  alternatePath?: string[];
  onSelectStart: (id: string) => void;
  onSelectDest: (id: string) => void;
  selectedStartId: string;
  selectedDestId: string;
}

export default function Map({
  zones,
  edges,
  activePath,
  alternatePath = [],
  onSelectStart,
  onSelectDest,
  selectedStartId,
  selectedDestId
}: MapProps) {
  // Zoom & Pan offset states
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [selectedSeatBlock, setSelectedSeatBlock] = useState<Zone | null>(null);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.75));
  const handleReset = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setSelectedSeatBlock(null);
  };

  const handleNodeClick = (zone: Zone) => {
    if (zone.type === 'seating') {
      setSelectedSeatBlock(zone);
    }

    if (!selectedStartId) {
      onSelectStart(zone.id);
    } else if (!selectedDestId && zone.id !== selectedStartId) {
      onSelectDest(zone.id);
    } else {
      // If both are filled or clicking start again, reset selection
      onSelectStart(zone.id);
      onSelectDest('');
    }
  };

  // Helper to determine active route line overlaps
  const isEdgeInPath = (fromId: string, toId: string, path: string[]) => {
    if (path.length < 2) return false;
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];
      if ((u === fromId && v === toId) || (u === toId && v === fromId)) {
        return true;
      }
    }
    return false;
  };

  const getZoneCoords = (id: string) => {
    const zone = zones.find(z => z.id === id);
    return zone ? { x: zone.x, y: zone.y } : { x: 500, y: 500 };
  };

  const getZoneColor = (zone: Zone) => {
    if (zone.status === 'closed') return '#ef4444';
    if (zone.id === selectedStartId) return '#10b981'; // Vibrant Green for Start
    if (zone.id === selectedDestId) return '#3b82f6'; // Bright Blue for Destination

    const density = zone.currentOccupancy / zone.capacity;
    if (zone.type === 'gate') {
      if (density < 0.3) return 'rgba(16, 185, 129, 0.8)';
      if (density < 0.7) return 'rgba(245, 158, 11, 0.8)';
      return 'rgba(239, 68, 68, 0.9)';
    }

    if (zone.type === 'concourse') {
      if (density < 0.4) return 'rgba(148, 163, 184, 0.3)'; // Slate transparent
      if (density < 0.7) return 'rgba(245, 158, 11, 0.4)';
      return 'rgba(239, 68, 68, 0.5)';
    }

    if (zone.type === 'seating') {
      if (density < 0.4) return 'rgba(16, 185, 129, 0.25)';
      if (density < 0.8) return 'rgba(245, 158, 11, 0.35)';
      return 'rgba(239, 68, 68, 0.45)';
    }

    return '#8b5cf6'; // Amenity purple
  };

  return (
    <div className="relative w-full h-[540px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-4 flex flex-col items-center justify-center">
      {/* Zoom Controls overlay */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={handleZoomIn}
          className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg text-slate-300 hover:text-white hover:border-slate-700 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg text-slate-300 hover:text-white hover:border-slate-700 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg text-slate-300 hover:text-white hover:border-slate-700 transition"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Legend & Instructions */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 p-3 rounded-lg text-xs space-y-2 max-w-[200px]">
        <div className="font-semibold text-slate-200">Interactive Map Settings</div>
        <p className="text-[10px] text-slate-400">Click any Gate or Block to set routing endpoints.</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-3 h-3 rounded bg-emerald-500 block"></span>
          <span className="text-[10px] text-slate-400">Start Selection</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-blue-500 block"></span>
          <span className="text-[10px] text-slate-400">Destination Selection</span>
        </div>
        {alternatePath.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-6 h-1 border-t-2 border-dotted border-amber-500 block"></span>
            <span className="text-[10px] text-slate-400">Alternate Detour Option</span>
          </div>
        )}
      </div>

      {/* SVG Container with Zoom & Pan Transforms */}
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <svg 
          viewBox="0 0 1000 1000" 
          className="w-full h-full max-w-[480px] max-h-[480px] transition-transform duration-200"
          style={{ transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)` }}
          aria-label="Zoomable 2D Stadium Map"
          role="img"
        >
          {/* Pitch field */}
          <rect x="360" y="400" width="280" height="200" rx="12" fill="#0f766e" stroke="#0d9488" strokeWidth="4" opacity="0.3" />
          <circle cx="500" cy="500" r="50" fill="none" stroke="#0d9488" strokeWidth="3" opacity="0.4" />

          {/* Render Paths (Edges) */}
          {edges.map((edge) => {
            const from = getZoneCoords(edge.fromZoneId);
            const to = getZoneCoords(edge.toZoneId);
            const inPrimary = isEdgeInPath(edge.fromZoneId, edge.toZoneId, activePath);
            const inAlternate = isEdgeInPath(edge.fromZoneId, edge.toZoneId, alternatePath);

            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={inPrimary ? '#10b981' : inAlternate ? '#f59e0b' : edge.stepFree ? '#334155' : '#1e293b'}
                strokeWidth={inPrimary ? 8 : inAlternate ? 6 : 3}
                strokeDasharray={inAlternate ? '5,5' : edge.stepFree ? '8,6' : '0'}
                opacity={inPrimary || inAlternate ? 1.0 : 0.4}
              />
            );
          })}

          {/* Render Nodes */}
          {zones.map((zone) => {
            const isStart = zone.id === selectedStartId;
            const isDest = zone.id === selectedDestId;
            const inRoute = activePath.includes(zone.id);
            const inAltRoute = alternatePath.includes(zone.id);
            const color = getZoneColor(zone);
            const radius = zone.type === 'gate' ? 32 : zone.type === 'concourse' ? 46 : zone.type === 'seating' ? 36 : 22;

            return (
              <g key={zone.id} className="cursor-pointer group" onClick={() => handleNodeClick(zone)}>
                {(isStart || isDest || inRoute) && (
                  <circle
                    cx={zone.x}
                    cy={zone.y}
                    r={radius + 8}
                    fill="none"
                    stroke={isStart ? '#10b981' : isDest ? '#3b82f6' : '#f59e0b'}
                    strokeWidth="3"
                    className="animate-ping"
                    style={{ animationDuration: isStart || isDest ? '2.5s' : '4s' }}
                  />
                )}
                <circle
                  cx={zone.x}
                  cy={zone.y}
                  r={radius}
                  fill={color}
                  stroke={isStart ? '#10b981' : isDest ? '#3b82f6' : inRoute ? '#10b981' : inAltRoute ? '#f59e0b' : '#475569'}
                  strokeWidth={isStart || isDest || inRoute ? 4 : 2}
                  className="transition-all duration-300 group-hover:scale-110"
                />
                <text
                  x={zone.x}
                  y={zone.y + 5}
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {zone.type === 'gate' && `G${zone.id.split('_')[1]}`}
                  {zone.type === 'concourse' && zone.id.split('_')[1].toUpperCase()}
                  {zone.type === 'seating' && zone.id.split('_')[1].toUpperCase()}
                  {zone.type === 'amenity' && (
                    zone.id.includes('restroom') ? 'WC' :
                    zone.id.includes('medical') ? 'MD' :
                    zone.id.includes('prayer') ? 'PR' :
                    zone.id.includes('family') ? 'FA' : 'FD'
                  )}
                </text>
                <title>{`${zone.name}\nClick to toggle navigation endpoint.`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Seating view visualizer panel */}
      {selectedSeatBlock && (
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl w-60 space-y-2 animate-[slide_0.3s_ease-out]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
              Field-View Angle Check
            </span>
            <button
              onClick={() => setSelectedSeatBlock(null)}
              className="text-[10px] text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="text-xs font-semibold text-slate-200">{selectedSeatBlock.name}</div>
          
          {/* Mock seat visual field backdrop */}
          <div className="h-24 w-full bg-gradient-to-t from-emerald-950 via-teal-900 to-slate-950 rounded-lg relative overflow-hidden flex items-end justify-center border border-slate-800">
            <div className="absolute top-2 w-32 h-16 border border-teal-500/20 rounded-full flex items-center justify-center">
              <span className="text-[8px] text-teal-300/40 uppercase tracking-widest">Pitch View</span>
            </div>
            
            {/* Net posts */}
            <div className="absolute bottom-0 w-20 h-8 border-t-2 border-x-2 border-white/10 rounded-t-md"></div>
            
            {/* Seat perspectives overlay */}
            <div className="w-full text-center pb-2 z-10 text-[9px] text-emerald-400 font-bold tracking-wider flex items-center justify-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Direct Pitch Perspective
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
