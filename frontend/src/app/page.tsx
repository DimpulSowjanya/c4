'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Mic, Send, RefreshCw, Landmark, Shield, Sparkles, Navigation, AlertTriangle, Accessibility, Eye, HelpCircle } from 'lucide-react';
import { Zone, Edge, StadiumGraph } from '../services/StadiumGraph';
import { RoutingEngine, RouteResult } from '../services/RoutingEngine';
import Map from '../components/Map';
import Dashboard from '../components/Dashboard';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
}

export default function Home() {
  const [accessibilityProfile, setAccessibilityProfile] = useState<'standard' | 'step_free' | 'low_sensory' | 'visual_assist'>('standard');
  const [fontSizeClass, setFontSizeClass] = useState<'text-sm' | 'text-base' | 'text-lg'>('text-base');
  const [isStaffView, setIsStaffView] = useState(false);
  const [language, setLanguage] = useState('English');

  const [selectedStartId, setSelectedStartId] = useState('');
  const [selectedDestId, setSelectedDestId] = useState('');

  const [zones, setZones] = useState<Zone[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loadingStadium, setLoadingStadium] = useState(true);

  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'assistant', text: 'Welcome to FanCompass AI! I am your virtual stadium assistant for the FIFA World Cup 2026. How can I help you navigate the venue today? You can select gates directly on the map, choose your navigation profile (standard, wheelchair step-free, low-sensory quiet routing, or visual landmarks guide), or type your inquiry below.' }
  ]);
  const [sendingQuery, setSendingQuery] = useState(false);
  const [activeRoutePath, setActiveRoutePath] = useState<string[]>([]);
  const [alternateRoutePath, setAlternateRoutePath] = useState<string[]>([]);
  const [routeInfo, setRouteInfo] = useState<{
    distance: number;
    time: number;
    congestion: number;
    warnings: string[];
    landmarkCues?: string[];
  } | null>(null);
  const [altRouteInfo, setAltRouteInfo] = useState<{
    distance: number;
    time: number;
    congestion: number;
  } | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isDemoOfflineMode, setIsDemoOfflineMode] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronized graph copy for local client calculations
  const localGraphRef = useRef<StadiumGraph>(new StadiumGraph());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load Stadium data
  const fetchStadiumData = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/stadium');
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
        setEdges(data.edges || []);
        setIsDemoOfflineMode(false);
      } else {
        loadOfflineDefaultStadium();
      }
    } catch (err) {
      console.log('Backend offline. Loading offline client-side Stadium database.');
      loadOfflineDefaultStadium();
    } finally {
      setLoadingStadium(false);
    }
  };

  const handleUpdateZone = (zoneId: string, updates: Partial<Zone>) => {
    setZones(prev => prev.map(z => z.id === zoneId ? { ...z, ...updates } as Zone : z));
  };

  const loadOfflineDefaultStadium = () => {
    if (zones.length > 0) {
      setIsDemoOfflineMode(true);
      return;
    }
    const defaultGraph = new StadiumGraph();
    setZones(defaultGraph.getAllZones());
    
    // Build temporary edges array
    const edgesList: Edge[] = [];
    for (const z of defaultGraph.getAllZones()) {
      const neighbors = defaultGraph.getNeighbors(z.id);
      for (const e of neighbors) {
        if (!edgesList.some(edge => edge.id === e.id)) {
          edgesList.push(e);
        }
      }
    }
    setEdges(edgesList);
    setIsDemoOfflineMode(true);
  };

  useEffect(() => {
    fetchStadiumData();
  }, []);

  // Sync state zones back to local Graph reference for offline calculation accuracy
  useEffect(() => {
    const graph = localGraphRef.current;
    if (zones.length > 0) {
      zones.forEach(z => {
        graph.updateZoneStatus(z.id, z.status);
        graph.updateZoneOccupancy(z.id, z.currentOccupancy);
      });
    }
  }, [zones]);

  useEffect(() => {
    if (selectedStartId && selectedDestId) {
      const startZone = zones.find(z => z.id === selectedStartId);
      const destZone = zones.find(z => z.id === selectedDestId);
      if (startZone && destZone) {
        setQuery(`Route me from ${startZone.name} to ${destZone.name}`);
      }
    }
  }, [selectedStartId, selectedDestId]);

  // Web Speech input
  const startSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Safari.');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = language === 'Spanish' ? 'es-ES' : 
                       language === 'French' ? 'fr-FR' : 
                       language === 'Arabic' ? 'ar-SA' : 
                       language === 'Hindi' ? 'hi-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      setQuery(event.results[0][0].transcript);
    };
    recognition.start();
  };

  // Speak aloud
  const speakText = (text: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'Spanish' ? 'es-ES' : 
                     language === 'French' ? 'fr-FR' : 
                     language === 'Arabic' ? 'ar-SA' : 
                     language === 'Hindi' ? 'hi-IN' : 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // Ask FanCompass Handler
  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || sendingQuery) return;

    const userText = query.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setQuery('');
    setSendingQuery(true);

    try {
      const res = await fetch('http://localhost:8080/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          language: language,
          accessibilityProfile: accessibilityProfile
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { sender: 'assistant', text: data.answer }]);
        speakText(data.answer);

        if (data.routeResult && data.routeResult.path && data.routeResult.path.length > 0) {
          setActiveRoutePath(data.routeResult.path);
          setRouteInfo({
            distance: data.routeResult.totalDistance,
            time: data.routeResult.estimatedTimeMin,
            congestion: data.routeResult.averageCongestion,
            warnings: data.routeResult.warnings || [],
            landmarkCues: data.routeResult.landmarkCues || []
          });
          setSelectedStartId(data.routeResult.path[0]);
          setSelectedDestId(data.routeResult.path[data.routeResult.path.length - 1]);
        } else {
          setActiveRoutePath([]);
          setRouteInfo(null);
        }

        if (data.alternateRouteResult && data.alternateRouteResult.path && data.alternateRouteResult.path.length > 0) {
          setAlternateRoutePath(data.alternateRouteResult.path);
          setAltRouteInfo({
            distance: data.alternateRouteResult.totalDistance,
            time: data.alternateRouteResult.estimatedTimeMin,
            congestion: data.alternateRouteResult.averageCongestion
          });
        } else {
          setAlternateRoutePath([]);
          setAltRouteInfo(null);
        }
      } else {
        runClientFallback(userText);
      }
    } catch (err) {
      runClientFallback(userText);
    } finally {
      setSendingQuery(false);
    }
  };

  // Client-Side Routing Fallback
  const runClientFallback = (userText: string) => {
    setIsDemoOfflineMode(true);
    const queryLower = userText.toLowerCase();
    let fromId = 'gate_1';
    let toId = 'block_a2';
    let isAmenitySearch = false;
    let amenityType = '';

    // Simple regex scanner
    const gateMatch = queryLower.match(/gate\s*([1-8])/);
    if (gateMatch) {
      fromId = `gate_${gateMatch[1]}`;
    } else if (queryLower.includes('concourse north')) {
      fromId = 'concourse_n';
    } else if (queryLower.includes('concourse east')) {
      fromId = 'concourse_e';
    } else if (queryLower.includes('concourse south')) {
      fromId = 'concourse_s';
    } else if (queryLower.includes('concourse west')) {
      fromId = 'concourse_w';
    }

    if (queryLower.includes('restroom') || queryLower.includes('toilet') || queryLower.includes('bathroom')) {
      isAmenitySearch = true;
      amenityType = 'restroom';
    } else if (queryLower.includes('medical') || queryLower.includes('first aid')) {
      isAmenitySearch = true;
      amenityType = 'medical';
    } else if (queryLower.includes('prayer')) {
      isAmenitySearch = true;
      amenityType = 'prayer';
    } else if (queryLower.includes('family') || queryLower.includes('sensory')) {
      isAmenitySearch = true;
      amenityType = 'family';
    } else if (queryLower.includes('food') || queryLower.includes('snack')) {
      isAmenitySearch = true;
      amenityType = 'food';
    } else {
      const blockMatch = queryLower.match(/block\s*([a-d])\s*([1-2])/);
      if (blockMatch) {
        toId = `block_${blockMatch[1]}${blockMatch[2]}`;
      }
    }

    console.log('[Offline Routing Diagnostic]', { fromId, toId, profile: accessibilityProfile });
    const engine = new RoutingEngine(localGraphRef.current);
    let route: RouteResult | null = null;
    let alternateRoute: RouteResult | null = null;
    let reply = '';

    if (isAmenitySearch) {
      route = engine.findNearestAmenity(fromId, amenityType, accessibilityProfile);
      console.log('Nearest amenity route:', route);
      if (route && route.path.length > 0) {
        const destName = localGraphRef.current.getZone(route.path[route.path.length - 1])?.name || amenityType;
        reply = `[Demo Mode: Offline Routing] Located nearest ${accessibilityProfile !== 'standard' ? `${accessibilityProfile} ` : ''}${amenityType} at ${destName}. Distance: ${route.totalDistance}m. Walk time: ${route.estimatedTimeMin} min.`;
      } else {
        const preflightWarn = route?.warnings?.[0];
        reply = preflightWarn 
          ? `[Demo Mode: Offline Routing] Warning: ${preflightWarn}` 
          : `[Demo Mode: Offline Routing] Sorry, no suitable ${accessibilityProfile !== 'standard' ? `${accessibilityProfile} ` : ''}${amenityType} found near you.`;
      }
    } else {
      route = engine.findRoute(fromId, toId, accessibilityProfile);
      console.log('Navigation route:', route);
      if (route && route.path.length > 0) {
        reply = `[Demo Mode: Offline Routing] Route calculated from ${localGraphRef.current.getZone(fromId)?.name} to ${localGraphRef.current.getZone(toId)?.name} using the ${accessibilityProfile} profile. Distance: ${route.totalDistance}m. Walk time: ${route.estimatedTimeMin} min.`;
        if (route.path.length > 2) {
          alternateRoute = engine.findAlternateRoute(fromId, toId, accessibilityProfile, route.path);
        }
      } else {
        const preflightWarn = route?.warnings?.[0];
        reply = preflightWarn 
          ? `[Demo Mode: Offline Routing] Routing Denied: ${preflightWarn}` 
          : `[Demo Mode: Offline Routing] Unable to find a valid route matching accessibility criteria between ${fromId} and ${toId}.`;
      }
    }

    setMessages(prev => [...prev, { sender: 'assistant', text: reply }]);
    speakText(reply);

    if (route && route.path.length > 0) {
      setActiveRoutePath(route.path);
      setRouteInfo({
        distance: route.totalDistance,
        time: route.estimatedTimeMin,
        congestion: route.averageCongestion,
        warnings: route.warnings || [],
        landmarkCues: route.landmarkCues || []
      });
      setSelectedStartId(route.path[0]);
      setSelectedDestId(route.path[route.path.length - 1]);
    } else {
      setActiveRoutePath([]);
      setRouteInfo(null);
    }

    if (alternateRoute && alternateRoute.path.length > 0) {
      setAlternateRoutePath(alternateRoute.path);
      setAltRouteInfo({
        distance: alternateRoute.totalDistance,
        time: alternateRoute.estimatedTimeMin,
        congestion: alternateRoute.averageCongestion
      });
    } else {
      setAlternateRoutePath([]);
      setAltRouteInfo(null);
    }
  };

  const handleClearSelections = () => {
    setSelectedStartId('');
    setSelectedDestId('');
    setActiveRoutePath([]);
    setAlternateRoutePath([]);
    setRouteInfo(null);
    setAltRouteInfo(null);
  };

  return (
    <div className={`min-h-screen pb-12 transition-all duration-300 bg-slate-950 text-slate-100 ${fontSizeClass}`}>
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur border-b border-slate-800 shadow-lg px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-slate-950 p-2.5 rounded-xl shadow-lg">
              <Navigation className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 Outfit">
                FanCompass AI
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-normal">
                  Enterprise Route Upgrade
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-semibold">FIFA World Cup 2026 Smart Navigation Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isDemoOfflineMode && (
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg font-bold animate-pulse">
                Offline Client Fallback Engaged
              </span>
            )}
            
            {/* Font Control */}
            <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Font:</span>
              <button onClick={() => setFontSizeClass('text-sm')} className={`px-2 py-0.5 text-xs rounded ${fontSizeClass === 'text-sm' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-700'}`}>A-</button>
              <button onClick={() => setFontSizeClass('text-base')} className={`px-2 py-0.5 text-xs rounded ${fontSizeClass === 'text-base' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-700'}`}>A</button>
              <button onClick={() => setFontSizeClass('text-lg')} className={`px-2 py-0.5 text-xs rounded ${fontSizeClass === 'text-lg' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-700'}`}>A+</button>
            </div>

            {/* Accessibility Selector */}
            <select
              value={accessibilityProfile}
              onChange={(e) => setAccessibilityProfile(e.target.value as any)}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="standard">Standard Route</option>
              <option value="step_free">Wheelchair / Step-Free Access</option>
              <option value="low_sensory">Low Sensory (Avoid Loud Crowds)</option>
              <option value="visual_assist">Visual Audio Assist Landmarks</option>
            </select>

            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="English">English</option>
              <option value="Spanish">Español (Spanish)</option>
              <option value="French">Français (French)</option>
              <option value="Arabic">العربية (Arabic)</option>
              <option value="Hindi">हिन्दी (Hindi)</option>
            </select>

            {/* Admin Toggle */}
            <button
              onClick={() => setIsStaffView(!isStaffView)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                isStaffView ? 'bg-purple-900/50 text-purple-200 border-purple-800' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Shield className="w-4 h-4" />
              {isStaffView ? 'Hide Ops view' : 'Venue Ops Dashboard'}
            </button>
          </div>
        </div>
      </header>

      {/* Occupancy strip */}
      <div className="bg-slate-900 border-b border-slate-800 py-2.5 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            Stadium Gates Occupancy strip:
          </span>
          <div className="flex items-center gap-4 text-xs overflow-x-auto whitespace-nowrap scrollbar-none py-1">
            {zones.filter(z => z.type === 'gate').map(gate => {
              const density = Math.round((gate.currentOccupancy / gate.capacity) * 100);
              return (
                <div key={gate.id} className="flex items-center gap-1.5">
                  <span className="text-slate-300 font-semibold">{gate.name.split(' (')[0]}:</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    gate.status === 'closed' ? 'bg-red-950 text-red-400 border border-red-800' :
                    density < 30 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    density < 70 ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                    'bg-red-950 text-red-400 border border-red-800'
                  }`}>
                    {gate.status === 'closed' ? 'CLOSED' : `${density}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-8">
        
        {/* Workspace columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Chat */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
              
              <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Interactive AI Navigator</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {selectedStartId && (
                    <button
                      onClick={handleClearSelections}
                      className="text-[10px] bg-slate-950 border border-slate-800 text-slate-400 hover:text-white px-2 py-0.5 rounded transition"
                    >
                      Clear Map Pins
                    </button>
                  )}
                  <button
                    onClick={() => setTtsEnabled(!ttsEnabled)}
                    className={`p-1.5 rounded transition ${ttsEnabled ? 'text-emerald-400 bg-emerald-950/45' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {ttsEnabled ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                      msg.sender === 'user' ? 'bg-emerald-600 text-white font-medium shadow-md shadow-emerald-600/10' : 'bg-slate-950 border border-slate-800 text-slate-200'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {sendingQuery && (
                  <div className="flex justify-start">
                    <div className="bg-slate-950 border border-slate-800 text-slate-400 rounded-xl px-4 py-3 text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                      <span>Calculating route path...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <form onSubmit={handleAsk} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={startSpeechRecognition}
                  className={`p-2.5 rounded-lg border transition ${
                    isListening ? 'bg-red-950 border-red-500 text-red-500 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={isListening ? "Listening to voice input..." : "Type seating blocks or gate IDs..."}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  disabled={sendingQuery}
                />
                <button type="submit" disabled={sendingQuery || !query.trim()} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white p-2.5 rounded-lg transition">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>

            {/* Quick Suggestions */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Quick Navigation Guides:</span>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setAccessibilityProfile('standard'); runClientFallback("I am at Gate 1, route to seating block A2"); }} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition">
                  Standard Path (Gate 1 ➔ Block A2)
                </button>
                <button onClick={() => { setAccessibilityProfile('step_free'); runClientFallback("Route me from Gate 3 to Block C2 using step free paths"); }} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition">
                  Wheelchair Path (Gate 3 ➔ Block C2)
                </button>
                <button onClick={() => { setAccessibilityProfile('low_sensory'); runClientFallback("Help me find a quiet route from Gate 1 to Block A2"); }} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition">
                  Quiet Route Detour (Gate 1 ➔ Block A2)
                </button>
                <button onClick={() => { setAccessibilityProfile('visual_assist'); runClientFallback("Guide me from Gate 5 to block A2 landmarks"); }} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition">
                  Audio Landmark cues (Gate 5 ➔ Block A2)
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Map */}
          <div className="lg:col-span-5 space-y-6">
            <Map 
              zones={zones} 
              edges={edges} 
              activePath={activeRoutePath} 
              alternatePath={alternateRoutePath}
              onSelectStart={setSelectedStartId}
              onSelectDest={setSelectedDestId}
              selectedStartId={selectedStartId}
              selectedDestId={selectedDestId}
            />

            {/* Compare calculated alternate detour path metrics with the primary calculated route path metrics */}
            {routeInfo && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4" />
                    Interactive Routing comparisons
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-3 rounded-lg border border-emerald-900/50 space-y-1">
                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Primary route
                    </div>
                    <div className="text-xs text-slate-300 mt-1.5">Distance: <strong>{routeInfo.distance}m</strong></div>
                    <div className="text-xs text-slate-300">Time: <strong>{routeInfo.time} min</strong></div>
                    <div className="text-xs text-slate-300">Crowd: <strong>{Math.round(routeInfo.congestion * 100)}%</strong></div>
                  </div>

                  <div className={`p-3 rounded-lg border space-y-1 ${altRouteInfo ? 'bg-slate-950 border-amber-900/50' : 'bg-slate-950/20 border-slate-800 opacity-40'}`}>
                    <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wide flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Suggested Detour
                    </div>
                    {altRouteInfo ? (
                      <>
                        <div className="text-xs text-slate-300 mt-1.5">Distance: <strong>{altRouteInfo.distance}m</strong></div>
                        <div className="text-xs text-slate-300">Time: <strong>{altRouteInfo.time} min</strong></div>
                        <div className="text-xs text-slate-300">Crowd: <strong>{Math.round(altRouteInfo.congestion * 100)}%</strong></div>
                      </>
                    ) : (
                      <div className="text-[10px] text-slate-500 py-4 text-center">No detour options needed</div>
                    )}
                  </div>
                </div>

                {routeInfo.landmarkCues && routeInfo.landmarkCues.length > 0 && (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Landmark className="w-3.5 h-3.5 text-purple-400" />
                      Auditory Landmarks guidance:
                    </div>
                    <ul className="list-decimal pl-4 space-y-1">
                      {routeInfo.landmarkCues.map((cue, i) => (
                        <li key={i} className="text-[10px] text-slate-300 leading-relaxed">{cue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {routeInfo.warnings.length > 0 && (
                  <div className="bg-amber-950/30 border border-amber-850 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      Safety Alerts:
                    </div>
                    <ul className="list-disc pl-4 space-y-1">
                      {routeInfo.warnings.map((warn, i) => (
                        <li key={i} className="text-[10px] text-slate-300 leading-relaxed">{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isStaffView && (
          <div className="mt-8">
            <Dashboard zones={zones} edges={edges} onRefresh={fetchStadiumData} onUpdateZone={handleUpdateZone} />
          </div>
        )}
      </main>
    </div>
  );
}
