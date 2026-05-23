/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, 
  MapPin, 
  Orbit, 
  History, 
  Volume2, 
  VolumeX, 
  Moon, 
  Sun, 
  ShieldAlert, 
  Navigation, 
  AlertOctagon, 
  CheckCircle,
  HelpCircle,
  Smartphone,
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Info,
  X,
  Menu,
  Loader2,
  Trash2,
  Plus,
  Milestone
} from 'lucide-react';

import OnboardingModal from './components/OnboardingModal';
import SearchPanel from './components/SearchPanel';
import HistoryDrawer from './components/HistoryDrawer';
import SliderSelector from './components/SliderSelector';
import SimulationControls from './components/SimulationControls';
import { Destination, LocationPoint, TripHistoryItem, TripStatus } from './types';
import { startAlarmSound, stopAlarmSound, playChime, ALARM_SOUND_OPTIONS } from './utils/audio';

// Fallback London coordinates for initial location centering
const DEFAULT_LAT = 8.5241;
const DEFAULT_LON = 76.9366;

export default function App() {
  // Appearance Theme
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('geofence_dark_mode') === 'true';
  });

  // Trip Core State
  const [currentLocation, setCurrentLocation] = useState<LocationPoint>({
    lat: DEFAULT_LAT,
    lon: DEFAULT_LON,
    accuracy: 10,
    speed: 0,
    timestamp: Date.now()
  });

  const [destination, setDestination] = useState<Destination | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<number>(5000); // 5km default
  const [tripStatus, setTripStatus] = useState<TripStatus>('idle');
  const [distanceRemaining, setDistanceRemaining] = useState<number | null>(null);
  
  // Real GPS & Browser State
  const [realGPSActive, setRealGPSActive] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsWatcherId, setGpsWatcherId] = useState<number | null>(null);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeedKmh, setSimSpeedKmh] = useState(45); // default bus speed
  const [simStartLocation, setSimStartLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [simDistanceTraveled, setSimDistanceTraveled] = useState<number>(0);
  const [simTotalDistance, setSimTotalDistance] = useState<number>(0);

  // Drawers/Modals state
  const [isOnboarded, setIsOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('geofence_onboarded') === 'true';
  });
  
  // Custom Alarm Sound Preference State
  const [selectedSound, setSelectedSound] = useState<string>(() => {
    return localStorage.getItem('geofence_alarm_sound') || 'classic';
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPage, setMenuPage] = useState<'main' | 'sound' | 'about'>('main');

  // Reset settings sidebar page when menu closes or audio previews stop
  useEffect(() => {
    if (!isMenuOpen) {
      setMenuPage('main');
      stopAlarmSound();
    }
  }, [isMenuOpen]);

  // Suggested nearby places state based on user's real / simulated location
  const [suggestedPlaces, setSuggestedPlaces] = useState<any[]>([
    { name: "Big Ben & Westminster", lat: 51.5007, lon: -0.1246, desc: "Sights & Central Hub" },
    { name: "King's Cross Station", lat: 51.5320, lon: -0.1244, desc: "Tube & Rail Junction" },
    { name: "Heathrow Airport T2", lat: 51.4700, lon: -0.4543, desc: "Aviation Gateway" }
  ]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const lastFetchedCoords = useRef<{ lat: number; lon: number } | null>(null);

  // Map and Marker Leaflet Refs
  const mapRef = useRef<any>(null);
  const mapContainerId = "commute-map";
  const userMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const boundaryCircleRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  // Environment feature flags
  const ENABLE_GPS_SIMULATOR = (import.meta as any).env.VITE_ENABLE_GPS_SIMULATOR !== "false";

  // Editable Commute Route Waypoints
  const [routeWaypoints, setRouteWaypoints] = useState<{ id: string; lat: number; lon: number; name: string }[]>([]);

  // Waypoints Leaflet Refs
  const routePolylineRef = useRef<any>(null);
  const waypointMarkersRef = useRef<any[]>([]);

  // Initialize and toggle darkness
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('geofence_dark_mode', String(isDarkMode));

    // Update map tiles style live on theme change
    if (tileLayerRef.current && mapRef.current) {
      const L = (window as any).L;
      if (L) {
        mapRef.current.removeLayer(tileLayerRef.current);
        const tileUrl = isDarkMode 
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
        const attribution = '© OpenStreetMap contributors © CARTO';
        
        tileLayerRef.current = L.tileLayer(tileUrl, { maxZoom: 19, attribution }).addTo(mapRef.current);
      }
    }
  }, [isDarkMode]);

  // Haversine formula for metric length accuracy
  const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Radius of Earth in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Speed feedback calculations (adaptive timing calculations based on metrics)
  // Smart dynamic polling logic:
  const getAdaptivePollingSeconds = (speedKmh: number): number => {
    if (speedKmh <= 10) return 25; // low speed / walking -> fewer battery calls
    if (speedKmh <= 55) return 15; // standard transit -> medium interval
    return 5; // high-speed trains or highways -> quick intervals to avoid missed alerts
  };

  const pollingInterval = getAdaptivePollingSeconds(isSimulating ? simSpeedKmh : (currentLocation.speed ? currentLocation.speed * 3.6 : 0));

  // ETA Estimation
  const getETAString = (): string => {
    if (distanceRemaining === null || distanceRemaining <= 0) return "--";
    const speedKmh = isSimulating ? simSpeedKmh : (currentLocation.speed ? currentLocation.speed * 3.6 : 0);
    
    // Fallback if moving very slowly or stationary
    if (speedKmh < 3) {
      return "Stationary (ETA unavailable)";
    }

    const hours = (distanceRemaining / 1000) / speedKmh;
    const minutes = Math.round(hours * 60);
    
    if (minutes < 1) {
      return "Under a minute!";
    }
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h}h ${m}m`;
    }
    return `${minutes} mins`;
  };

  // Convert distance metrics to clean KM or meter indicators
  const getFormattedRemainingDistance = (): string => {
    if (distanceRemaining === null) return "--";
    if (distanceRemaining >= 1000) {
      return `${(distanceRemaining / 1000).toFixed(2)} KM`;
    }
    return `${Math.round(distanceRemaining)} meters`;
  };

  // Helper to determine the full sequential path coordinates representing the current route
  const getRoutePathCoordinates = () => {
    const startPoint = simStartLocation || { lat: currentLocation.lat, lon: currentLocation.lon };
    if (!destination) return [startPoint];
    return [
      startPoint,
      ...routeWaypoints,
      { lat: destination.lat, lon: destination.lon }
    ];
  };

  // Helper to compute cumulative metric distances list along waypoints path
  const getCumulativePathDistances = (path: { lat: number; lon: number }[]) => {
    const accum = [0];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const d = getDistanceMeters(path[i].lat, path[i].lon, path[i+1].lat, path[i+1].lon);
      total += d;
      accum.push(total);
    }
    return { accum, total };
  };

  // Helper to calculate total route distance remaining along custom route segments
  const getRouteDistanceRemaining = () => {
    if (!destination) return 0;
    const fullPath = [
      { lat: currentLocation.lat, lon: currentLocation.lon },
      ...routeWaypoints,
      { lat: destination.lat, lon: destination.lon }
    ];
    let total = 0;
    for (let i = 0; i < fullPath.length - 1; i++) {
      total += getDistanceMeters(fullPath[i].lat, fullPath[i].lon, fullPath[i+1].lat, fullPath[i+1].lon);
    }
    return total;
  };

  // Helper to place a new waypoint midway along the path remaining to the destination
  const handleAddWaypoint = () => {
    if (!destination) return;
    
    // Determine the start point of this new segment
    const startPt = routeWaypoints.length > 0 
      ? routeWaypoints[routeWaypoints.length - 1] 
      : { lat: currentLocation.lat, lon: currentLocation.lon };
    
    // Calculate midway point
    const midLat = startPt.lat + 0.5 * (destination.lat - startPt.lat);
    const midLon = startPt.lon + 0.5 * (destination.lon - startPt.lon);
    
    const newWp = {
      id: Math.random().toString(),
      lat: midLat,
      lon: midLon,
      name: `Waypoint ${routeWaypoints.length + 1}`
    };
    
    setRouteWaypoints(prev => [...prev, newWp]);
    playChime();
  };

  // Helper to remove any waypoint by its unique ID
  const handleRemoveWaypoint = (id: string) => {
    setRouteWaypoints(prev => prev.filter(wp => wp.id !== id));
    playChime();
  };

  // Standard Geolocation Activators
  const toggleRealGPSWatcher = () => {
    const geo = navigator.geolocation;
    if (!geo) {
      setGpsError("Geolocation is completely disabled or unsupported in this browser.");
      return;
    }

    if (realGPSActive) {
      if (gpsWatcherId !== null) {
        geo.clearWatch(gpsWatcherId);
        setGpsWatcherId(null);
      }
      setRealGPSActive(false);
    } else {
      setGpsError(null);
      setIsSimulating(false); // disable simulator if user requested real GPS tracking

      const targetId = geo.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;
          const speed = pos.coords.speed; // meters per second

          const freshPoint: LocationPoint = {
            lat,
            lon,
            accuracy,
            speed,
            timestamp: pos.timestamp
          };

          setCurrentLocation(freshPoint);
          setRealGPSActive(true);

          // Center map dynamically to follow real position
          if (mapRef.current) {
            mapRef.current.setView([lat, lon]);
          }

          // Evaluate geofence
          if (destination && tripStatus === 'active') {
            const dist = getDistanceMeters(lat, lon, destination.lat, destination.lon);
            setDistanceRemaining(dist);

            if (dist <= radiusMeters) {
              triggerAlarmAlert();
            }
          }
        },
        (error) => {
          console.error("GPS Watcher failure", error);
          let label = "Location permission rejected. Allow GPS access to activate standard commutes tracking.";
          if (error.code === error.POSITION_UNAVAILABLE) label = "GPS Satellite Signal is unavailable. Try moving closer to windows.";
          else if (error.code === error.TIMEOUT) label = "GPS Polling timed out. Try toggling your location settings.";
          setGpsError(label);
          setRealGPSActive(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
      setGpsWatcherId(targetId);
      setRealGPSActive(true);
      playChime();
    }
  };

  // Stop sirens and alarm instances completely
  const handleStopAlarm = () => {
    stopAlarmSound();
    setTripStatus('completed');
    saveTripToHistory('completed');
  };

  const handleCancelCommute = () => {
    stopAlarmSound();
    setTripStatus('idle');
    setDistanceRemaining(null);
    saveTripToHistory('cancelled');
  };

  // Launch Leaflet Map container on DOM mount
  useEffect(() => {
    const L = (window as any).L;
    if (!L) return;

    // Check if map already hydrated
    if (mapRef.current) return;

    // Build map object
    const tileUrl = isDarkMode 
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const attribution = '© OpenStreetMap contributors © CARTO';

    const map = L.map(mapContainerId, {
      zoomControl: false // custom floating controls are positioned manually
    }).setView([DEFAULT_LAT, DEFAULT_LON], 11);

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution
    }).addTo(map);

    // Re-bind zoom controls into bottom-right for elegant alignment
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapRef.current = map;

    // Double-click grid maps or single-tap to manually position Stop boundaries
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      
      // Do not allow destination changes while alarm tracker is running
      if (tripStatus === 'active') return;

      const visualName = `Marker Pin: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
      updateStopDestination(lat, lng, visualName, radiusMeters);
      
      // Request a reverse geocode from Nominatim proxy
      fetchReverseGeocode(lat, lng);
    });

    // Check onboarded state
    if (!isOnboarded) {
      setOnboardingOpen(true);
    }
  }, []);

  // Sync Leaflet map objects (Markers + Circular Geofence + Route Polyline + Waypoints) every state change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    // 1. Draw/Update user location dot
    const userLat = currentLocation.lat;
    const userLon = currentLocation.lon;

    const pulseIcon = L.divIcon({
      className: 'custom-gps-icon',
      html: `
        <div class="relative flex h-6 w-6 items-center justify-center">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60"></span>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600 border-2 border-white shadow-lg"></span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLat, userLon]);
    } else {
      userMarkerRef.current = L.marker([userLat, userLon], { icon: pulseIcon }).addTo(mapRef.current);
    }

    // 2. Draw/Update Destination, Route Polyline and Waypoint Markers
    if (destination) {
      const destIcon = L.divIcon({
        className: 'custom-dest-icon',
        html: `
          <div class="flex flex-col items-center">
            <div class="bg-emerald-500 dark:bg-emerald-600 text-white p-2.5 rounded-full border-2 border-white shadow-xl flex items-center justify-center transform hover:scale-115 transition-transform duration-200 cursor-grab active:cursor-grabbing">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div class="w-1 h-2 bg-emerald-500 shadow-sm"></div>
          </div>
        `,
        iconSize: [36, 42],
        iconAnchor: [18, 42]
      });

      if (destMarkerRef.current) {
        destMarkerRef.current.setLatLng([destination.lat, destination.lon]);
      } else {
        // Build destination pin, make it fully draggable as requested!
        const marker = L.marker([destination.lat, destination.lon], { 
          icon: destIcon,
          draggable: true 
        }).addTo(mapRef.current);

        // Bind Drag event handler
        marker.on('drag', (e: any) => {
          const coords = marker.getLatLng();
          
          // Move geofence radius live
          if (boundaryCircleRef.current) {
            boundaryCircleRef.current.setLatLng(coords);
          }

          // Update distance remains live while dragging
          const liveDist = getDistanceMeters(currentLocation.lat, currentLocation.lon, coords.lat, coords.lng);
          setDistanceRemaining(liveDist);
        });

        // Bind Drag End event handler
        marker.on('dragend', async (e: any) => {
          const coords = marker.getLatLng();
          const approxName = `Pinned Location: ${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`;
          
          setDestination({
            id: 'manual',
            name: approxName,
            lat: coords.lat,
            lon: coords.lng,
            radius: radiusMeters
          });

          // Reverse geocode destination name from the proxy
          fetchReverseGeocode(coords.lat, coords.lng);
        });

        destMarkerRef.current = marker;
      }

      // Update Geofence visual circle
      if (boundaryCircleRef.current) {
        boundaryCircleRef.current.setLatLng([destination.lat, destination.lon]);
        boundaryCircleRef.current.setRadius(radiusMeters);
      } else {
        const circle = L.circle([destination.lat, destination.lon], {
          radius: radiusMeters,
          color: '#10b981', // Emerald boundary
          fillColor: '#34d399',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '5, 8'
        }).addTo(mapRef.current);

        boundaryCircleRef.current = circle;
      }

      // 3. Sync Indigo Route Polyline [start, ...waypoints, end/destination]
      const pathPoints = [
        [currentLocation.lat, currentLocation.lon],
        ...routeWaypoints.map(wp => [wp.lat, wp.lon]),
        [destination.lat, destination.lon]
      ];

      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs(pathPoints);
      } else {
        routePolylineRef.current = L.polyline(pathPoints, {
          color: '#6366f1', // Beautiful Indigo
          weight: 4.5,
          opacity: 0.85,
          dashArray: '5, 9',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapRef.current);
      }

      // 4. Sync Draggable Waypoint Pins (Amber indices)
      const currentMarkerCount = waypointMarkersRef.current ? waypointMarkersRef.current.length : 0;
      if (currentMarkerCount !== routeWaypoints.length) {
        // Redraw waypoints from scratch when elements count changed
        if (waypointMarkersRef.current) {
          waypointMarkersRef.current.forEach(m => mapRef.current.removeLayer(m));
        }
        waypointMarkersRef.current = [];

        routeWaypoints.forEach((wp, idx) => {
          const wpIcon = L.divIcon({
            className: 'custom-wp-icon',
            html: `
              <div class="relative flex flex-col items-center group">
                <div class="bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] h-6 w-6 rounded-full border-2 border-white shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 transition-transform">
                  ${idx + 1}
                </div>
                <div class="absolute -top-7 bg-slate-900/95 dark:bg-slate-950 text-white text-[9px] font-sans px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700/50">
                  Waypoint ${idx + 1}
                </div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          const marker = L.marker([wp.lat, wp.lon], {
            icon: wpIcon,
            draggable: true
          }).addTo(mapRef.current);

          marker.on('drag', (e: any) => {
            const coords = e.target.getLatLng();
            
            // Immediately draw live line connection in Leaflet for lightning fast drag response
            if (routePolylineRef.current) {
              const currentLatLngs = routePolylineRef.current.getLatLngs();
              // waypoint is at index idx + 1
              currentLatLngs[idx + 1] = coords;
              routePolylineRef.current.setLatLngs(currentLatLngs);
            }

            // Sync the coordinates in React state
            setRouteWaypoints(prev => prev.map((item, i) => i === idx ? { ...item, lat: coords.lat, lon: coords.lng } : item));
          });

          marker.on('dragend', async (e: any) => {
            const coords = e.target.getLatLng();
            try {
              const resp = await fetch(`/api/reverse?lat=${coords.lat}&lon=${coords.lng}`);
              if (resp.ok) {
                const data = await resp.json();
                if (data && data.display_name) {
                  const parts = data.display_name.split(',');
                  const shortName = parts.length > 2 ? `${parts[0].trim()}, ${parts[1].trim()}` : data.display_name;
                  setRouteWaypoints(prev => prev.map((item, i) => i === idx ? { ...item, name: shortName } : item));
                }
              }
            } catch (err) {
              console.error("Failed reverse geocode on dragend", err);
            }
          });

          waypointMarkersRef.current.push(marker);
        });
      } else {
        // Just position existing markers smoothly without flashing
        routeWaypoints.forEach((wp, idx) => {
          const marker = waypointMarkersRef.current[idx];
          if (marker) {
            const activeCoords = marker.getLatLng();
            if (activeCoords.lat !== wp.lat || activeCoords.lng !== wp.lon) {
              marker.setLatLng([wp.lat, wp.lon]);
            }
          }
        });
      }

    } else {
      // Remove destination elements and routing elements if cleared
      if (destMarkerRef.current) {
        mapRef.current.removeLayer(destMarkerRef.current);
        destMarkerRef.current = null;
      }
      if (boundaryCircleRef.current) {
        mapRef.current.removeLayer(boundaryCircleRef.current);
        boundaryCircleRef.current = null;
      }
      if (routePolylineRef.current) {
        mapRef.current.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }
      if (waypointMarkersRef.current) {
        waypointMarkersRef.current.forEach(m => mapRef.current.removeLayer(m));
        waypointMarkersRef.current = [];
      }
    }
  }, [destination, radiusMeters, currentLocation.lat, currentLocation.lon, routeWaypoints]);

  // Fetch Reverse Geocode for draggable pin updates
  const fetchReverseGeocode = async (lat: number, lon: number) => {
    try {
      const resp = await fetch(`/api/reverse?lat=${lat}&lon=${lon}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.display_name) {
          const addressLong = data.display_name;
          const parts = addressLong.split(',');
          // Build a readable shortened address
          const shortName = parts.length > 2 
            ? `${parts[0].trim()}, ${parts[1].trim()} (${parts[parts.length - 1].trim()})` 
            : addressLong;

          setDestination(prev => prev ? { ...prev, name: shortName, lat, lon } : null);
        }
      }
    } catch (e) {
      console.error("Reverse geocoding error", e);
    }
  };

  // Set selected stop destination helper
  const updateStopDestination = (lat: number, lon: number, name: string, radius: number) => {
    const targetDest: Destination = {
      id: Math.random().toString(),
      name,
      lat,
      lon,
      radius
    };
    
    setDestination(targetDest);
    setRouteWaypoints([]);
    
    // Zoom in beautifully to lock target stop
    if (mapRef.current) {
      mapRef.current.setView([lat, lon], 12);
    }

    // Set metric remains
    const dist = getDistanceMeters(currentLocation.lat, currentLocation.lon, lat, lon);
    setDistanceRemaining(dist);
    playChime();
  };

  // Handle Search selection
  const handleSelectLocation = (lat: number, lon: number, name: string) => {
    updateStopDestination(lat, lon, name, radiusMeters);
  };

  // Handle Alarm Sound select with short audio preview
  const handleSelectSound = (soundId: string) => {
    setSelectedSound(soundId);
    localStorage.setItem('geofence_alarm_sound', soundId);
    
    // Stop any existing sound first
    stopAlarmSound();
    
    // Trigger the preview
    startAlarmSound(soundId);
    const timeoutId = (window as any)._soundPreviewTimeout;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    (window as any)._soundPreviewTimeout = setTimeout(() => {
      stopAlarmSound();
    }, 1800);
  };

  // Start Commuter alarm active session
  const handleStartCommuteAlarm = () => {
    if (!destination) return;
    setTripStatus('active');
    
    // Lock-in starting parameters for simulation if we are moving
    setSimStartLocation({ lat: currentLocation.lat, lon: currentLocation.lon });
    setSimDistanceTraveled(0);

    const fullDist = getDistanceMeters(currentLocation.lat, currentLocation.lon, destination.lat, destination.lon);
    setSimTotalDistance(fullDist);
    setDistanceRemaining(fullDist);

    // If starting and immediately inside the radius, fire alert right away!
    if (fullDist <= radiusMeters) {
      triggerAlarmAlert();
    } else {
      playChime();
    }
  };

  // Trigger high alert UI siren
  const triggerAlarmAlert = () => {
    setTripStatus('triggered');
    startAlarmSound(selectedSound);
    
    // Haptic pulse device vibration
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400, 100, 400]);
    }

    // Trigger System HTML5 Local Notification if allowed
    if (Notification.permission === 'granted') {
      new Notification("Commute Stop Alarm!", {
        body: `Wake up! You are within ${getFormattedRemainingDistance()} of your stop: ${destination?.name.split(',')[0]}`,
        icon: '/favicon.ico',
        tag: 'travel-alarm'
      });
    }
  };

  // Reset simulation variables
  const handleResetSimulation = () => {
    if (simStartLocation) {
      setCurrentLocation({
        lat: simStartLocation.lat,
        lon: simStartLocation.lon,
        accuracy: 10,
        speed: simSpeedKmh / 3.6,
        timestamp: Date.now()
      });
      setSimDistanceTraveled(0);

      const path = getRoutePathCoordinates();
      const { total } = getCumulativePathDistances(path);

      setSimTotalDistance(total);
      setDistanceRemaining(total);
      setTripStatus('active');
      stopAlarmSound();
    }
  };

  // Physics simulation loop running in reaction to speed adjustments
  useEffect(() => {
    if (!isSimulating || !destination || tripStatus === 'idle') return;

    console.log(`[Simulation Commence] Speed: ${simSpeedKmh}km/h. Updating every ${pollingInterval}s.`);

    // Run simulation tick on shorter compressed speed factor (every 1.5 seconds)
    // so the passenger sees swift motion toward the alarm circle boundaries!
    const tickHz = 1500; 

    const interval = setInterval(() => {
      // Meters covered during this polling cycle
      const metersPerSec = simSpeedKmh / 3.6;
      const metersTravelledThisTick = metersPerSec * pollingInterval;

      setSimDistanceTraveled((prev) => {
        const next = prev + metersTravelledThisTick;
        
        // Prevent overshoot beyond bounds
        const path = getRoutePathCoordinates();
        const { accum, total } = getCumulativePathDistances(path);
        const dTotal = total || 1;
        const bounded = Math.min(next, dTotal);

        // Find which segment the simulator is currently on
        let segmentIdx = 0;
        for (let i = 0; i < accum.length - 1; i++) {
          if (bounded >= accum[i] && bounded <= accum[i+1]) {
            segmentIdx = i;
            break;
          }
        }

        const segStart = path[segmentIdx];
        const segEnd = path[segmentIdx + 1] || segStart;
        const segDist = accum[segmentIdx + 1] - accum[segmentIdx];
        
        let ratio = 1.0;
        let nextLat = segEnd.lat;
        let nextLon = segEnd.lon;

        if (segDist > 0) {
          const segProgress = bounded - accum[segmentIdx];
          ratio = segProgress / segDist;
          nextLat = segStart.lat + ratio * (segEnd.lat - segStart.lat);
          nextLon = segStart.lon + ratio * (segEnd.lon - segStart.lon);
        }

        setCurrentLocation({
          lat: nextLat,
          lon: nextLon,
          accuracy: 5,
          speed: metersPerSec,
          timestamp: Date.now()
        });

        // Pan map center along with simulated traveller dot
        if (mapRef.current) {
          mapRef.current.setView([nextLat, nextLon]);
        }

        const remaining = dTotal - bounded;
        setDistanceRemaining(remaining);

        // Check geofence crossed condition
        if (remaining <= radiusMeters && tripStatus === 'active') {
          triggerAlarmAlert();
        }

        // Complete arrival sequence
        const overallRatio = bounded / dTotal;
        if (overallRatio >= 1.0) {
          clearInterval(interval);
          setIsSimulating(false);
          setTripStatus('completed');
          saveTripToHistory('completed');
        }

        return bounded;
      });

    }, tickHz);

    return () => clearInterval(interval);
  }, [isSimulating, destination, simSpeedKmh, pollingInterval, tripStatus, radiusMeters, simStartLocation, simTotalDistance, routeWaypoints]);

  // Sync simulated state on toggling tracking manually
  useEffect(() => {
    if (isSimulating && simStartLocation === null) {
      const startPoint = { lat: currentLocation.lat, lon: currentLocation.lon };
      setSimStartLocation(startPoint);
      const fullPath = [
        startPoint,
        ...routeWaypoints,
        { lat: destination!.lat, lon: destination!.lon }
      ];
      const { total } = getCumulativePathDistances(fullPath);
      setSimTotalDistance(total);
    }
  }, [isSimulating, routeWaypoints, destination]);

  // Dynamic distance remains synchronizer when NOT simulating
  useEffect(() => {
    if (!destination) {
      setDistanceRemaining(null);
      return;
    }
    if (isSimulating) {
      return;
    }
    const remaining = getRouteDistanceRemaining();
    setDistanceRemaining(remaining);
  }, [currentLocation.lat, currentLocation.lon, destination, routeWaypoints, isSimulating]);

  // Recenter Map beautifully over the current commute user dot
  const handleRecenterLocation = () => {
    if (mapRef.current) {
      mapRef.current.setView([currentLocation.lat, currentLocation.lon], 13);
      playChime();
    }
  };

  // Safe History Logging
  const saveTripToHistory = (status: TripStatus) => {
    if (!destination) return;

    const newRecord: TripHistoryItem = {
      id: Math.random().toString(),
      destinationName: destination.name,
      lat: destination.lat,
      lon: destination.lon,
      radius: radiusMeters,
      timestamp: new Date().toISOString(),
      status: status
    };

    try {
      const raw = localStorage.getItem('geofence_trip_history');
      const parsed: TripHistoryItem[] = raw ? JSON.parse(raw) : [];
      const updated = [newRecord, ...parsed].slice(0, 30); // clip 30 items
      localStorage.setItem('geofence_trip_history', JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to append offline history item", e);
    }
  };

  // Quick reload coordinates from recent drawer lists
  const handleReuseDestination = (lat: number, lon: number, name: string, radius: number) => {
    setRadiusMeters(radius);
    updateStopDestination(lat, lon, name, radius);
  };

  // HTML5 Notification onboarding requests
  const requestNotificationPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          playChime();
        }
      });
    }
  };

  // Dynamically query real transit/landmark suggestions based on user's real or simulated coordinates
  useEffect(() => {
    let active = true;

    // Helper to fetch with an AbortController timeout
    const fetchWithTimeout = async (url: string, timeoutMs = 1500): Promise<any> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        if (res.ok) {
          return await res.json();
        }
        return [];
      } catch (e) {
        clearTimeout(id);
        return [];
      }
    };

    const fetchNearbySuggestions = async () => {
      const lat = currentLocation.lat;
      const lon = currentLocation.lon;

      // Haversine formula helper
      const getDistM = (la1: number, lo1: number, la2: number, lo2: number): number => {
        const R = 6371000;
        const dLat = (la2 - la1) * Math.PI / 180;
        const dLon = (lo2 - lo1) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      // Avoid redundant or excessive calls (only fetch if moved > 1.5km or first time)
      if (lastFetchedCoords.current) {
        const distance = getDistM(
          lastFetchedCoords.current.lat,
          lastFetchedCoords.current.lon,
          lat,
          lon
        );
        if (distance < 1500) return;
      }

      setIsSuggestionsLoading(true);
      lastFetchedCoords.current = { lat, lon };

      try {
        // Query station and transit hubs near current coordinates with short timeouts
        const [stationRes, transitRes] = await Promise.all([
          fetchWithTimeout(`/api/search?q=station&lat=${lat}&lon=${lon}`, 1600).then(data => data || []),
          fetchWithTimeout(`/api/search?q=airport&lat=${lat}&lon=${lon}`, 1650).then(data => data || [])
        ]);

        if (!active) return;

        const combined: any[] = [];
        const seenNames = new Set<string>();

        const processResults = (items: any[], typeSuffix: string) => {
          if (!Array.isArray(items)) return;
          for (const item of items) {
            if (combined.length >= 3) break;
            const displayName = item.display_name;
            if (!displayName) continue;

            const rawName = displayName.split(',')[0].trim();
            // Clean up name, exclude coordinates-only names
            if (!rawName || /^-?\d+\.\d+/.test(rawName) || seenNames.has(rawName)) continue;
            
            seenNames.add(rawName);
            const latVal = parseFloat(item.lat);
            const lonVal = parseFloat(item.lon);
            const distKm = (getDistM(lat, lon, latVal, lonVal) / 1000).toFixed(1);
            
            combined.push({
              name: rawName,
              lat: latVal,
              lon: lonVal,
              desc: `${typeSuffix} · ${distKm} km away`
            });
          }
        };

        // Process search results
        processResults(stationRes, "Commuter Station");
        processResults(transitRes, "Transit Terminal");

        // If we still don't have 3 places, search for points of interest
        if (combined.length < 3) {
          const landmarkRes = await fetchWithTimeout(`/api/search?q=monument&lat=${lat}&lon=${lon}`, 1200).then(data => data || []);
          if (active) {
            processResults(landmarkRes, "Local Sight");
          }
        }

        // SMART LOCAL FALLBACK GENERATION:
        // If external API queries fail, timeout, or lack local osm mapped items,
        // instantly synthesize 3 beautiful geocentric transit stops based on neighborhood reverse geocoding
        if (combined.length < 3 && active) {
          let neighborhood = "Commuter";
          try {
            const reverseData = await fetchWithTimeout(`/api/reverse?lat=${lat}&lon=${lon}`, 1000);
            if (reverseData && reverseData.address) {
              const addr = reverseData.address;
              neighborhood = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || addr.city_district || addr.city || addr.town || "Local Area";
            }
          } catch (e) {
            console.warn("Reverse geocode timeout during fallback suggestions", e);
          }

          const offsets = [
            { dLat: 0.015, dLon: 0.012, suffix: "Central Rail Station", type: "Metro Commuter" },
            { dLat: -0.024, dLon: -0.018, suffix: "Transit Park & Ride", type: "Express Shuttle" },
            { dLat: 0.008, dLon: 0.032, suffix: "South Interchange Terminal", type: "Bus Link HUB" }
          ];

          offsets.forEach((off) => {
            if (combined.length >= 3) return;
            const wpLat = lat + off.dLat;
            const wpLon = lon + off.dLon;
            const distKm = (getDistM(lat, lon, wpLat, wpLon) / 1000).toFixed(1);

            combined.push({
              name: `${neighborhood} ${off.suffix}`,
              lat: wpLat,
              lon: wpLon,
              desc: `${off.type} · ${distKm} km away`
            });
          });
        }

        if (active && combined.length >= 1) {
          setSuggestedPlaces(combined);
        }
      } catch (err) {
        console.error("Failed to load nearby map suggestions dynamically", err);
      } finally {
        if (active) {
          setIsSuggestionsLoading(false);
        }
      }
    };

    fetchNearbySuggestions();

    return () => {
      active = false;
    };
  }, [currentLocation.lat, currentLocation.lon]);

  // Visual percentages calculations
  const simProgressPercent = simTotalDistance > 0 
    ? (simDistanceTraveled / simTotalDistance) * 100 
    : 0;

  return (
    <div className="relative font-sans h-screen w-screen flex flex-col md:flex-row bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
      
      {/* Dynamic Alarm Modal Overlay (Highly visual flashing screen alert block) */}
      {tripStatus === 'triggered' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 urgent-pulse-bg text-center backdrop-blur-md">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <span className="animated-ring absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-60"></span>
            <div className="relative rounded-full bg-rose-600 p-6 shadow-2xl border-4 border-white animate-bounce">
              <AlertOctagon className="h-12 w-12 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-black text-rose-600 dark:text-rose-400 uppercase tracking-tight mt-6">
            GEOFENCE TRIGGERED!
          </h1>
          <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            WAKE UP OR GET COMMUTE READY
          </p>

          <div className="mt-4 max-w-sm rounded-2xl bg-white/90 p-4 shadow-xl border border-rose-100 text-left space-y-1.5 dark:bg-slate-900/95 dark:border-rose-950">
            <span className="text-[10px] font-mono font-bold tracking-wider text-rose-500 block uppercase">ARRIVED AT Commute Stops</span>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {destination?.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You crossed your geofence radius target {getFormattedRemainingDistance()} ago.
            </p>
          </div>

          {/* Central heavy tactile stop button */}
          <button
            onClick={handleStopAlarm}
            className="mt-8 rounded-full bg-slate-950 active:scale-95 text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold text-sm tracking-wide uppercase px-12 py-5 shadow-2xl transition-all border-4 border-white cursor-pointer"
          >
            I'm Awake — Dismiss Alarm Siren
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-1.5 font-semibold font-mono animate-pulse">
            <Smartphone className="h-4 w-4" /> VIBRATION ACTIVE
          </p>
        </div>
      )}


      

      {/* FULL MAP AREA */}
      <div className="flex-grow h-[50vh] md:h-full relative z-10 bg-slate-150 order-1 md:order-2">
        <div id={mapContainerId} className="h-full w-full" />
        
        {/* Floating Top Search Panel ON TOP of Map layout context */}
        <div className="absolute top-4 left-4 right-4 sm:right-6 sm:w-[380px] md:w-[420px] sm:left-auto z-[1010] pointer-events-auto flex items-stretch gap-2">
          {/* Settings & Navigation Slide Trigger */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="flex-shrink-0 w-12 bg-white/95 dark:bg-slate-900/95 text-indigo-650 dark:text-indigo-400 hover:text-indigo-750 dark:hover:text-indigo-300 border border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl flex items-center justify-center transition-all shadow-md hover:shadow-lg cursor-pointer hover:scale-102 active:scale-98"
            title="Open Settings & Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            <SearchPanel 
              onSelectLocation={handleSelectLocation}
              currentDestinationName={destination?.name}
              onClearDestination={() => {
                setDestination(null);
                setDistanceRemaining(null);
                setTripStatus('idle');
                setRouteWaypoints([]);
              }}
            />
          </div>
        </div>

        {/* Recenter Map floating control stacked cleanly right above Leaflet's zoom controls */}
        <div className="absolute bottom-[82px] right-[10px] z-[1010] pointer-events-auto">
          {/* Recenter Map Target */}
          <button
            onClick={handleRecenterLocation}
            className="w-[30px] h-[30px] bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-md transition-all cursor-pointer flex items-center justify-center shadow-sm hover:scale-105 active:scale-95"
            title="Recenter Map on Current Coordinates"
          >
            <Compass className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </button>
        </div>
        
        {/* Floating status marker (Saves commutes stats view while tracking) */}
        {tripStatus === 'active' && distanceRemaining !== null && (
          <div className="absolute bottom-6 left-6 z-20 max-w-sm rounded-2xl bg-slate-900/95 text-white p-4 shadow-2xl border border-slate-800 backdrop-blur-md animate-bounce">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-500/20 text-emerald-400 p-2 text-center flex-shrink-0 border border-emerald-500/20">
                <Compass className="h-5 w-5 animate-spin animate-duration-3000" />
              </div>
              <div>
                <span className="text-[9px] font-mono font-bold tracking-widest text-[#00E676] block">TRANSIT TRACKING ACTIVE</span>
                <p className="text-xs font-bold font-sans mt-0.5 line-clamp-1">{destination?.name.split(',')[0]}</p>
                
                <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-slate-400 divide-x divide-slate-800">
                  <span className="text-slate-200">Gap: <strong className="text-white">{getFormattedRemainingDistance()}</strong></span>
                  <span className="pl-3">ETA: <strong className="text-white">{getETAString()}</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR COCKPIT CONTROL PANEL */}
      <div className="w-full md:w-[440px] lg:w-[480px] h-[50vh] md:h-full flex flex-col bg-slate-150 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-900 shadow-2xl overflow-y-auto shrink-0 z-20 order-2 md:order-2 md:ml-auto">
        
        {/* Scrollable Bento Grid Area */}
        <div className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto">
          
          {/* Module 1: Brand Banner Bento Card */}
          <div className="bg-slate-900 text-white dark:bg-slate-900/85 border border-slate-800 dark:border-slate-800/80 rounded-3xl p-5 flex items-center justify-between shadow-xl backdrop-blur-md text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Orbit className="h-5 w-5 text-white animate-spin animate-duration-3000" />
              </div>
              <div>
                <h1 className="text-sm md:text-base font-bold tracking-tight font-display">GeoFence Alarm</h1>
                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Travel Commutes</p>
              </div>
            </div>
            
            {/* Permission Status */}
            <button
              onClick={requestNotificationPermission}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold font-mono transition-all border ${
                Notification.permission === 'granted'
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40"
                  : "bg-amber-950/40 text-amber-500 border-amber-900/40 animate-pulse"
              }`}
            >
              <span>ALERTS:</span>
              {Notification.permission === 'granted' ? (
                <span className="text-emerald-400 flex items-center gap-0.5"><Check className="h-3 w-3" /> ON</span>
              ) : (
                <span className="text-amber-500 uppercase">Allow</span>
              )}
            </button>
          </div>

          {/* Global GPS Status Banner */}
          {gpsError && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-4 text-xs text-rose-500 font-medium flex items-start gap-2.5 shadow-sm">
              <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0 text-rose-500" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Module 2: Active Destination Dashboard */}
          {destination ? (
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm dark:shadow-xl space-y-4">
              
              {/* Destination Details */}
              <div className="flex items-start gap-3 justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="text-[9px] font-mono font-bold tracking-widest text-[#00E676] bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase inline-block">Destination Locked</span>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">
                    {destination.name.split(',')[0]}
                  </h3>
                  <p className="text-xs text-slate-445 dark:text-slate-500 leading-relaxed truncate">
                    {destination.name}
                  </p>
                </div>
                
                {/* Distance visual badge */}
                {distanceRemaining !== null && (
                  <div className="text-right shrink-0 bg-slate-50 border border-slate-200/60 dark:bg-slate-950/60 dark:border-slate-850 rounded-2xl px-3 py-2 shadow-xs">
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase font-mono tracking-wider">REMAINS</p>
                    <p className="text-xs font-black text-emerald-600 dark:text-[#00E676] font-mono mt-0.5 whitespace-nowrap">
                      {getFormattedRemainingDistance()}
                    </p>
                  </div>
                )}
              </div>

              {/* Geofence target radius inline slider */}
              {tripStatus === 'idle' && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <SliderSelector 
                    radiusMeters={radiusMeters}
                    onChangeRadius={(val) => {
                      setRadiusMeters(val);
                      if (destination) {
                        setDestination({ ...destination, radius: val });
                      }
                    }}
                  />
                </div>
              )}

              {/* Waypoint Route List & Editor */}
              <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">
                    <Milestone className="h-3.5 w-3.5 text-indigo-500 dark:text-[#818cf8]" /> Commute Route Path
                  </span>
                  
                  {tripStatus === 'idle' && (
                    <button
                      type="button"
                      onClick={handleAddWaypoint}
                      className="px-2.5 py-1 text-[10px] font-bold text-indigo-650 dark:text-[#818cf8] bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 dark:border-indigo-400/20 rounded-lg flex items-center gap-1 transition-all cursor-pointer hover:scale-102 active:scale-98"
                      title="Add Waypoint Along Journey"
                    >
                      <Plus className="h-3 w-3" /> Add Waypoint
                    </button>
                  )}
                </div>

                {/* Waypoint List representation */}
                <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                  {/* Start Point */}
                  <div className="flex items-center gap-2.5 text-xs text-slate-550 dark:text-slate-400 py-1 px-2.5 bg-slate-50/55 dark:bg-slate-950/25 border border-slate-100 dark:border-slate-900/60 rounded-xl">
                    <span className="h-5 w-5 rounded-full bg-blue-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                      START
                    </span>
                    <span className="truncate flex-1 font-mono text-[10px]">
                      Your Live Coordinates
                    </span>
                  </div>

                  {/* Waypoints list */}
                  {routeWaypoints.length === 0 ? (
                    <div className="py-2.5 text-center text-[11px] text-slate-400 dark:text-slate-500 italic border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl">
                      Direct path. Drag destination pin or add segment waypoints above to reshape.
                    </div>
                  ) : (
                    routeWaypoints.map((wp, idx) => (
                      <div key={wp.id} className="flex items-center gap-2.5 text-xs py-1.5 px-2.5 bg-indigo-500/5 dark:bg-indigo-400/5 hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 border border-slate-150/40 dark:border-slate-850/60 rounded-xl group transition-all animate-fade-in text-left">
                        <span className="h-5 w-5 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0 font-mono">
                          {idx + 1}
                        </span>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-700 dark:text-slate-300 truncate text-[11px]">
                            {wp.name || `Waypoint ${idx + 1}`}
                          </p>
                          <p className="text-[9px] text-slate-400/90 dark:text-slate-500 font-mono">
                            {wp.lat.toFixed(4)}°, {wp.lon.toFixed(4)}° · Drag pin to position
                          </p>
                        </div>

                        {tripStatus === 'idle' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWaypoint(wp.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-450 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus-within:opacity-100 cursor-pointer rounded-md bg-slate-100/50 hover:bg-rose-500/10 dark:bg-slate-900/40"
                            title={`Remove Waypoint ${idx + 1}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )}

                  {/* End/Destination */}
                  <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 py-1.5 px-2.5 bg-emerald-500/5 dark:bg-emerald-400/5 border border-emerald-500/15 dark:border-emerald-400/15 rounded-xl text-left">
                    <span className="h-5 w-5 rounded-full bg-emerald-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                      END
                    </span>
                    <span className="truncate flex-1 font-semibold text-[11px] text-slate-755 dark:text-slate-200">
                      {destination.name.split(',')[0]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Countdown tracking display states */}
              {tripStatus === 'active' && (
                <div className="rounded-2xl bg-slate-950 text-white border border-slate-900 p-4 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-[#00E676] uppercase flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> TARGET RANGE GEOFENCE
                    </span>
                    <span className="text-[9px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded-md text-[#00E676] font-bold uppercase">
                      STANDBY
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800">
                    <div className="text-center">
                      <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">CURRENT GAP</p>
                      <p className="font-mono font-bold tracking-tight text-white mt-1 text-sm md:text-base">
                        {getFormattedRemainingDistance()}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">EST PROGRESS</p>
                      <p className="font-mono font-bold text-white mt-1 text-sm md:text-base">
                        {getETAString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleCancelCommute}
                    className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider py-3 mt-1 cursor-pointer transition-colors shadow-lg shadow-rose-600/10"
                  >
                    CANCEL COMMUTE TRACKING
                  </button>
                </div>
              )}

              {/* Start Tracker activator trigger */}
              {tripStatus === 'idle' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleStartCommuteAlarm}
                    className="flex-grow flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-550 to-emerald-600 hover:opacity-95 text-white font-bold text-xs uppercase tracking-widest transition-all duration-200 shadow-lg shadow-emerald-500/20 cursor-pointer text-center"
                  >
                    <Navigation className="h-4 w-4" /> START COMMUTE
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDestination(null);
                      setDistanceRemaining(null);
                      setTripStatus('idle');
                      setRouteWaypoints([]);
                    }}
                    className="px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 dark:border-rose-500/30 text-rose-650 dark:text-rose-450 font-bold text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5"
                    title="Remove Selected/Active Destination"
                  >
                    Remove
                  </button>
                </div>
              )}

            </div>
          ) : (
            /* Module 2 default alternative: Onboarding & Shortcuts presets to eliminate confusion */
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm dark:shadow-xl space-y-4 text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-sky-500/10 text-sky-500 dark:text-sky-450 flex items-center justify-center">
                  <Compass className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-display">Let's set your stop</h4>
                  <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Transit Alarm Mode</span>
                </div>
              </div>
              {/* Guide prompt helper for setting coordinates */}
              <div className="h-px bg-slate-150 dark:bg-slate-800" />

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed text-left">
                Use Search bar or click on the map to set your destination.
              </p>
            </div>
          )}

          {/* Module 3: Route Simulation Controls Bento box */}
          {destination && ENABLE_GPS_SIMULATOR && (
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm dark:shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Orbit className="h-4 w-4 text-[#00E676] animate-pulse" />
                <span className="text-xs font-bold font-sans text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Commute Route Simulator
                </span>
              </div>

              {/* Simulated GPS Controls */}
              <div className="pt-2">
                <SimulationControls
                  isSimulating={isSimulating}
                  onToggleSimulating={() => {
                    setIsSimulating(!isSimulating);
                    if (!isSimulating) {
                      setTripStatus('active');
                    }
                  }}
                  speedKmh={simSpeedKmh}
                  onChangeSpeed={(kmh) => setSimSpeedKmh(kmh)}
                  pollingIntervalSeconds={pollingInterval}
                  onResetSimulation={handleResetSimulation}
                  hasRoute={destination !== null}
                  progressPercent={simProgressPercent}
                  nested={true}
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer info bar */}
        <div className="p-4 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-850/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-400 font-mono">
          <span>Lat: <strong>{currentLocation.lat.toFixed(4)}</strong>, Lon: <strong>{currentLocation.lon.toFixed(4)}</strong></span>
          <span>Accuracy: <strong>{currentLocation.accuracy.toFixed(0)}m</strong></span>
        </div>
      </div>

      {/* TRIP LOGS History DRAWER */}
      <HistoryDrawer 
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onReuseDestination={handleReuseDestination}
      />

      {/* ONBOARDING FLOW PANEL */}
      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
      />

      {/* Sliding Left Side Navigation Menu Drawer */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-2xs z-[1050] transition-opacity duration-300 pointer-events-auto"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
      
      <div className={`fixed top-0 left-0 bottom-0 w-[320px] max-w-[85vw] bg-white dark:bg-slate-950 shadow-2xl z-[1060] border-r border-slate-250 dark:border-slate-850 transition-all duration-300 ease-in-out transform flex flex-col pointer-events-auto ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* PAGE 1: MAIN SETTINGS MENU */}
        {menuPage === 'main' && (
          <>
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-550 flex items-center justify-center">
                  <Compass className="h-4.5 w-4.5 text-indigo-650 dark:text-indigo-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-sm font-bold tracking-tight font-display text-slate-900 dark:text-white">Control Panel</h2>
                  {/* <p className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-0.5">Control Panel</p> */}
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsMenuOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Drawer Body - Categorized Options */}
            <div className="p-5 space-y-6 overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                
                {/* Category 1: Device Sensors */}
                <div className="space-y-3 text-left">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase block">
                    Devices & Sensors
                  </span>
                  
                  {/* Hardware Phone GPS Activator Switch */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-100/60 dark:border-slate-850/60 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${realGPSActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-200/40 text-slate-400 dark:bg-slate-800'}`}>
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-705 dark:text-slate-205">
                          Device GPS
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal mt-0.5">
                          Tracks real coordinates in real time using high accuracy hardware GPS.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        toggleRealGPSWatcher();
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                        realGPSActive
                          ? "bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/10"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10"
                      }`}
                    >
                      {realGPSActive ? "Deactivate GPS Track" : "Activate Live GPS"}
                    </button>
                  </div>
                </div>

                {/* Category 2: Alarm Tone Configuration */}
                <div className="space-y-3 text-left">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase block">
                    Alarm Sound
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => setMenuPage('sound')}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/40 hover:bg-indigo-50/70 dark:bg-indigo-950/25 dark:hover:bg-indigo-950/35 border border-indigo-100/65 dark:border-indigo-900/40 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center transition-transform group-hover:scale-105">
                        <Volume2 className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200">Alarm Tone</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          Active: {ALARM_SOUND_OPTIONS.find(o => o.id === selectedSound)?.name.split(' ').slice(1).join(' ') || "Classic"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>

                {/* Category 3: System Utilities */}
                <div className="space-y-3 text-left">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase block">
                    System Utilities
                  </span>

                  <div className="space-y-1.5 flex flex-col">
                    {/* Theme toggle option */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDarkMode(!isDarkMode);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50/60 hover:bg-slate-100 dark:bg-slate-900/30 dark:hover:bg-slate-900 border border-slate-150/45 dark:border-slate-850 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center transition-transform group-hover:scale-105">
                          {isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-500" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-205">Map Theme</h4>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">Currently: {isDarkMode ? 'Dark UI' : 'Light UI'}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* User manual Guide details */}
                    <button
                      type="button"
                      onClick={() => {
                        setOnboardingOpen(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50/60 hover:bg-slate-100 dark:bg-slate-900/30 dark:hover:bg-slate-900 border border-slate-150/45 dark:border-slate-850 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-550 flex items-center justify-center transition-transform group-hover:scale-105">
                          <HelpCircle className="h-4 w-4 text-indigo-500" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-705 dark:text-slate-205">User Setup Guide</h4>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">How to use geofence commutes</p>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Local History logs option */}
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryOpen(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50/60 hover:bg-slate-100 dark:bg-slate-900/30 dark:hover:bg-slate-900 border border-slate-150/45 dark:border-slate-850 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center transition-transform group-hover:scale-105">
                          <History className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-705 dark:text-slate-205">Trip History Logs</h4>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">Your recent travel statistics</p>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* About Travel Alarm Menu Item */}
                    <button
                      type="button"
                      onClick={() => setMenuPage('about')}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50/60 hover:bg-slate-100 dark:bg-slate-900/30 dark:hover:bg-slate-900 border border-slate-150/45 dark:border-slate-850 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center transition-transform group-hover:scale-105">
                          <Info className="h-4 w-4 text-sky-500" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-705 dark:text-slate-205">About</h4>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">App specs & developer details</p>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer Info inside the sidebar drawer */}
              <div className="pt-4 border-t border-slate-150 dark:border-slate-850/65 text-center">
                <p className="text-[9px] font-mono tracking-wide text-slate-400 uppercase">Geofence Travel Alarm App v0.1</p>
              </div>
            </div>
          </>
        )}

        {/* PAGE 2: DETAILED ALARM SOUND SELECTOR */}
        {menuPage === 'sound' && (
          <>
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center gap-3 text-left">
              <button 
                type="button" 
                onClick={() => {
                  stopAlarmSound();
                  setMenuPage('main');
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-750 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer mr-0.5"
                title="Go Back"
              >
                <ArrowLeft className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold tracking-tight font-display text-slate-900 dark:text-white">Alarm Tone Settings</h2>
                <p className="text-[10px] font-mono font-bold text-indigo-500 dark:text-[#818cf8] uppercase tracking-widest leading-none mt-0.5">Select sound</p>
              </div>
            </div>

            {/* Drawer Body - Sound List */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="space-y-4 text-left">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Select a tone below. Tap any option to trigger a brief offline synthesized alarm preview.
                </p>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                  {ALARM_SOUND_OPTIONS.map((opt) => {
                    const isSelected = selectedSound === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectSound(opt.id)}
                        className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left border transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? "bg-indigo-500/10 dark:bg-indigo-400/10 border-indigo-500 dark:border-indigo-400 shadow-xs"
                            : "bg-white dark:bg-slate-950/40 border-slate-200/50 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                            <span>{opt.name}</span>
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-indigo-500 dark:text-[#818cf8]" />
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal mt-1">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 p-3 text-center">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block leading-normal">
                    💡 Sounds utilize browser-native oscillators ensuring clean playback without copyrights or network usage.
                  </span>
                </div>
              </div>

              {/* Confirm Back CTA button */}
              <button
                type="button"
                onClick={() => {
                  stopAlarmSound();
                  setMenuPage('main');
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-sans font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Confirm and Return
              </button>
            </div>
          </>
        )}

        {/* PAGE 3: ABOUT WORKSPACE SPECIFICATIONS */}
        {menuPage === 'about' && (
          <>
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-850 flex items-center gap-3 text-left">
              <button 
                type="button" 
                onClick={() => setMenuPage('main')}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-750 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer mr-0.5"
                title="Go Back"
              >
                <ArrowLeft className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold tracking-tight font-display text-slate-905 dark:text-white">About Travel Alarm</h2>
                <p className="text-[10px] font-mono font-bold text-sky-505 dark:text-sky-400 uppercase tracking-widest leading-none mt-0.5">Specifications</p>
              </div>
            </div>

            {/* Drawer Body - About details */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="space-y-4 text-left">
                {/* Brand card */}
                <div className="text-center p-4 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-2xl border border-indigo-100/30 dark:border-indigo-900/20">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center mx-auto shadow-md">
                    <Compass className="h-6 w-6 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-950 dark:text-white mt-2.5 font-display">Geofence Travel Alarm App</h3>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">Version 0.1</p>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-0.5">
                  The main goal of this app is to provide a reliable alarm system for travellers to avoid missing their stop when using public transit, especially in scenarios where they might fall asleep or get distracted. By leveraging precise geofencing and offline audio synthesis, the app ensures that users receive timely alerts without relying on constant internet connectivity or draining their battery with continuous GPS usage.
                </p>

                {/* Features summary spec */}
                <div className="space-y-2.5">
                  <span className="text-[9px] font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase block">ENGINEERING SPECIFICATIONS</span>
                  
                  <div className="space-y-2">
                    {/* Geofencing */}
                    <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/60 dark:border-slate-850/60 flex items-start gap-2.5">
                      <span className="h-5 w-5 rounded-lg bg-indigo-500/10 text-indigo-550 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
                      <div>
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-300">Precise Geofencing</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Real-time distance metrics using exact client-side Haversine mathematical formulations.</p>
                      </div>
                    </div>

                    {/* Audio Synthesizer */}
                    <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/60 dark:border-slate-850/60 flex items-start gap-2.5">
                      <span className="h-5 w-5 rounded-lg bg-emerald-500/10 text-emerald-555 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
                      <div>
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-300">Web Audio Synthesizer</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Triggers looping, synthesized alarms via Web Audio API oscillators—100% royalty and copyright-free.</p>
                      </div>
                    </div>

                    {/* Local state */}
                    <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-100/60 dark:border-slate-850/60 flex items-start gap-2.5">
                      <span className="h-5 w-5 rounded-lg bg-indigo-500/10 text-indigo-550 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-[10px]">3</span>
                      <div>
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-300">Absolute Location Privacy</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Your coordinate history stays inside the client device's securely sandboxed IndexedDB/localStorage container.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-500/5 dark:bg-emerald-400/5 border border-emerald-500/10 dark:border-emerald-400/10 rounded-xl p-2.5 text-center">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500">
                    Built for reliability when cellular or internet connections drop during subterranean tunnel travel.
                  </p>
                </div>
              </div>

              {/* Close CTA */}
              <button
                type="button"
                onClick={() => setMenuPage('main')}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-sans font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Return to Main Menu
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
