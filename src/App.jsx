import { Box, Heading, Text, Container, Button, HStack, VStack, Divider, useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input, Textarea, FormControl, FormLabel, List, ListItem, IconButton, Spinner, Badge, Flex, Alert, AlertIcon, Center } from '@chakra-ui/react'
import { StarIcon } from '@chakra-ui/icons'
import { useState, useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { supabase } from './supabaseClient'

const MAPTILER_KEY = 'Uu2plMpWPcX4fjAFpFNr'

// Helper function to calculate distance between two points in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

function App() {
  const [isTracking, setIsTracking] = useState(false)
  const [route, setRoute] = useState([])
  const [startTime, setStartTime] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [showSave, setShowSave] = useState(false)
  const [tripName, setTripName] = useState('')
  const [tripNotes, setTripNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [trips, setTrips] = useState([])
  const [loadingTrips, setLoadingTrips] = useState(true)
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [showTripModal, setShowTripModal] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [geoError, setGeoError] = useState(null)
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState(null)
  const timerRef = useRef(null)
  const geoRef = useRef(null)
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const routeLayerId = 'route-line'
  const toast = useToast()
  const [lastRecordedPoint, setLastRecordedPoint] = useState(null)
  const watchIdRef = useRef(null)
  const [currentLocation, setCurrentLocation] = useState(null)
  const currentLocationMarkerRef = useRef(null)
  const currentLocationLayerId = 'current-location'
  const [isTrackingInterrupted, setIsTrackingInterrupted] = useState(false)
  const lastUpdateTimeRef = useRef(null)

  // Add beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isTracking) {
        // Stop tracking when page is closed/refreshed
        if (watchIdRef.current) {
          navigator.geolocation.clearWatch(watchIdRef.current)
          watchIdRef.current = null
        }
        clearInterval(timerRef.current)
        // Mark tracking as interrupted
        localStorage.setItem('trackingInterrupted', 'true')
        localStorage.setItem('lastUpdateTime', new Date().toISOString())
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isTracking])

  // Check for interrupted tracking on load
  useEffect(() => {
    const wasInterrupted = localStorage.getItem('trackingInterrupted') === 'true'
    const lastUpdateTime = localStorage.getItem('lastUpdateTime')
    
    if (wasInterrupted) {
      setIsTrackingInterrupted(true)
      // Clear the interrupted state
      localStorage.removeItem('trackingInterrupted')
      localStorage.removeItem('lastUpdateTime')
      
      // Show a toast notification
      toast({
        title: 'Tracking Interrupted',
        description: 'Your previous tracking session was interrupted. Please start a new trip.',
        status: 'warning',
        duration: 5000,
        isClosable: true,
      })
    }
  }, [])

  // Restore trip state from localStorage on page load
  useEffect(() => {
    const savedTrip = localStorage.getItem('currentTrip')
    if (savedTrip) {
      const { 
        isTracking, 
        route, 
        startTime, 
        lastRecordedPoint: savedLastPoint, 
        currentLocation: savedLocation,
        lastUpdateTime: savedLastUpdateTime 
      } = JSON.parse(savedTrip)

      // Check if the tracking was interrupted
      const lastUpdate = savedLastUpdateTime ? new Date(savedLastUpdateTime) : null
      const now = new Date()
      const timeSinceLastUpdate = lastUpdate ? now - lastUpdate : 0

      // If it's been more than 30 seconds since the last update, consider it interrupted
      if (timeSinceLastUpdate > 30000) {
        setIsTrackingInterrupted(true)
        localStorage.removeItem('currentTrip')
        toast({
          title: 'Tracking Interrupted',
          description: 'Your previous tracking session was interrupted. Please start a new trip.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        })
        return
      }

      setIsTracking(isTracking)
      setRoute(route)
      setStartTime(startTime ? new Date(startTime) : null)
      setLastRecordedPoint(savedLastPoint)
      setCurrentLocation(savedLocation)
      lastUpdateTimeRef.current = savedLastUpdateTime ? new Date(savedLastUpdateTime) : null
      
      if (isTracking && startTime) {
        setElapsed(Math.floor((new Date() - new Date(startTime)) / 1000))
        // Restart the timer
        timerRef.current = setInterval(() => {
          setElapsed(Math.floor((new Date() - new Date(startTime)) / 1000))
        }, 1000)
        
        // Restart position watching
        if (navigator.geolocation) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              const newPoint = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                timestamp: new Date().toISOString()
              }

              // Update last update time
              lastUpdateTimeRef.current = new Date()

              // Always update current location marker
              setCurrentLocation(newPoint)

              if (!savedLastPoint || 
                  calculateDistance(
                    savedLastPoint.lat, 
                    savedLastPoint.lng, 
                    newPoint.lat, 
                    newPoint.lng
                  ) > 100) {
                setRoute(prevRoute => [...prevRoute, newPoint])
                setLastRecordedPoint(newPoint)
              }
            },
            (error) => {
              setGeoError(error.message)
            },
            {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 5000
            }
          )
        }
      }
    }
  }, [])

  // Save trip state to localStorage whenever it changes
  useEffect(() => {
    if (isTracking) {
      localStorage.setItem('currentTrip', JSON.stringify({
        isTracking,
        route,
        startTime: startTime ? startTime.toISOString() : null,
        lastRecordedPoint,
        currentLocation,
        lastUpdateTime: lastUpdateTimeRef.current ? lastUpdateTimeRef.current.toISOString() : null
      }))
    } else {
      localStorage.removeItem('currentTrip')
    }
  }, [isTracking, route, startTime, lastRecordedPoint, currentLocation])

  // Initialize map with error handling
  useEffect(() => {
    if (!mapContainer.current) return

    setMapLoading(true)
    setMapError(null)

    // Add a small delay to ensure the container is ready
    const timer = setTimeout(() => {
      try {
        const map = new maplibregl.Map({
          container: mapContainer.current,
          style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
          center: [78.6937, 10.7905], // Trichy coordinates
          zoom: 13
        })

        map.on('load', () => {
          setMapLoading(false)
          // Add current location marker source and layer
          map.addSource(currentLocationLayerId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [0, 0]
              }
            }
          })

          map.addLayer({
            id: currentLocationLayerId,
            type: 'symbol',
            source: currentLocationLayerId,
            layout: {
              'text-field': '🚶',
              'text-size': 24,
              'text-allow-overlap': true,
              'text-ignore-placement': true,
              'text-anchor': 'center'
            }
          })

          // Store map reference
          mapRef.current = map
        })

        map.on('error', (e) => {
          console.error('Map error:', e)
          setMapError('Failed to load map. Please try refreshing the page.')
          setMapLoading(false)
        })

        return () => {
          map.remove()
        }
      } catch (error) {
        console.error('Map initialization error:', error)
        setMapError('Failed to initialize map. Please try refreshing the page.')
        setMapLoading(false)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Update map with route and marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || route.length === 0) return
    const last = route[route.length - 1]
    // Move marker
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: '#2b6cb0' })
        .setLngLat([last.lng, last.lat])
        .addTo(map)
    } else {
      markerRef.current.setLngLat([last.lng, last.lat])
    }
    // Center map on latest point
    map.flyTo({ center: [last.lng, last.lat], zoom: 14 })
    // Draw route line
    if (map.getSource('route')) {
      map.getSource('route').setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: route.map(p => [p.lng, p.lat]),
        },
      })
    } else {
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: route.map(p => [p.lng, p.lat]),
          },
        },
      })
      map.addLayer({
        id: routeLayerId,
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#2b6cb0',
          'line-width': 4,
        },
      })
    }
  }, [route])

  // Update current location marker with improved error handling
  useEffect(() => {
    if (!mapRef.current || !currentLocation) return

    try {
      const source = mapRef.current.getSource(currentLocationLayerId)
      if (source) {
        source.setData({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [currentLocation.lng, currentLocation.lat]
          }
        })

        // Center map on current location if it's the first point
        if (route.length === 1) {
          mapRef.current.flyTo({
            center: [currentLocation.lng, currentLocation.lat],
            zoom: 15,
            duration: 2000
          })
        }
      }
    } catch (error) {
      console.error('Error updating location marker:', error)
    }
  }, [currentLocation, route.length])

  // Improved: Start trip recording
  const handleStart = () => {
    // Reset interrupted state
    setIsTrackingInterrupted(false)
    setIsTracking(true)
    setRoute([])
    setGeoError(null)
    setLastRecordedPoint(null)
    setCurrentLocation(null)
    const now = new Date()
    setStartTime(now)
    setElapsed(0)
    lastUpdateTimeRef.current = now
    
    // Timer for elapsed time
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((new Date() - now) / 1000))
    }, 1000)

    // Start watching position with improved error handling
    if (navigator.geolocation) {
      // First get a quick initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const initialPoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date().toISOString()
          }
          setCurrentLocation(initialPoint)
          setRoute([initialPoint])
          setLastRecordedPoint(initialPoint)
          lastUpdateTimeRef.current = new Date()

          // Then start continuous watching
          watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              const newPoint = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                timestamp: new Date().toISOString()
              }

              // Update last update time
              lastUpdateTimeRef.current = new Date()

              // Always update current location marker
              setCurrentLocation(newPoint)

              // If this is the first point or distance > 100m, record it
              if (!lastRecordedPoint || 
                  calculateDistance(
                    lastRecordedPoint.lat, 
                    lastRecordedPoint.lng, 
                    newPoint.lat, 
                    newPoint.lng
                  ) > 100) {
                setRoute(prevRoute => [...prevRoute, newPoint])
                setLastRecordedPoint(newPoint)
              }
            },
            (error) => {
              console.error('Geolocation error:', error)
              setGeoError(`Location error: ${error.message}. Please ensure location services are enabled.`)
            },
            {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 10000 // Increased timeout to 10 seconds
            }
          )
        },
        (error) => {
          console.error('Initial geolocation error:', error)
          setGeoError(`Initial location error: ${error.message}. Please ensure location services are enabled.`)
          setIsTracking(false)
          clearInterval(timerRef.current)
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000 // Increased timeout to 10 seconds
        }
      )
    } else {
      setGeoError('Geolocation is not supported by your browser.')
      setIsTracking(false)
      clearInterval(timerRef.current)
    }
  }

  // Stop trip recording
  const handleStop = () => {
    setIsTracking(false)
    setIsTrackingInterrupted(false)
    clearInterval(timerRef.current)
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setCurrentLocation(null)
    localStorage.removeItem('currentTrip')
    localStorage.removeItem('trackingInterrupted')
    localStorage.removeItem('lastUpdateTime')
    setShowSave(true)
  }

  // Save trip to Supabase
  const handleSaveTrip = async () => {
    setSaving(true)
    const trip = {
      name: tripName,
      date: startTime ? startTime.toISOString().slice(0, 10) : null,
      notes: tripNotes,
      route,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isFavorite: false,
    }
    const { error } = await supabase.from('trips').insert([trip])
    setSaving(false)
    if (error) {
      toast({ title: 'Error saving trip', description: error.message, status: 'error', duration: 5000, isClosable: true })
    } else {
      toast({ title: 'Trip saved!', status: 'success', duration: 3000, isClosable: true })
      setShowSave(false)
      setTripName('')
      setTripNotes('')
      setRoute([])
      setElapsed(0)
      setStartTime(null)
    }
  }

  // Fetch trips from Supabase
  useEffect(() => {
    const fetchTrips = async () => {
      setLoadingTrips(true)
      const { data, error } = await supabase.from('trips').select('*').order('createdAt', { ascending: false })
      if (error) {
        toast({ title: 'Error loading trips', description: error.message, status: 'error', duration: 5000, isClosable: true })
      } else {
        setTrips(data)
      }
      setLoadingTrips(false)
    }
    fetchTrips()
  }, [showSave]) // refetch after saving

  // Mark as favorite
  const handleFavorite = async (trip) => {
    setFavoriteLoading(true)
    const { error } = await supabase.from('trips').update({ isFavorite: !trip.isFavorite, updatedAt: new Date().toISOString() }).eq('id', trip.id)
    setFavoriteLoading(false)
    if (error) {
      toast({ title: 'Error updating favorite', description: error.message, status: 'error', duration: 5000, isClosable: true })
    } else {
      setTrips(trips => trips.map(t => t.id === trip.id ? { ...t, isFavorite: !trip.isFavorite } : t))
    }
  }

  // Show trip details
  const handleShowTrip = (trip) => {
    setSelectedTrip(trip)
    setShowTripModal(true)
  }

  // Render trip route on map in modal
  const tripMapRef = useRef(null)
  useEffect(() => {
    if (!showTripModal || !selectedTrip) return
    if (!tripMapRef.current) return
    const map = new maplibregl.Map({
      container: tripMapRef.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`,
      center: selectedTrip.route && selectedTrip.route.length > 0 ? [selectedTrip.route[0].lng, selectedTrip.route[0].lat] : [2.3522, 48.8566],
      zoom: 5,
    })
    if (selectedTrip.route && selectedTrip.route.length > 0) {
      map.on('load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: selectedTrip.route.map(p => [p.lng, p.lat]),
            },
          },
        })
        map.addLayer({
          id: 'route-line-modal',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#2b6cb0',
            'line-width': 4,
          },
        })
        // Add marker at start
        new maplibregl.Marker({ color: '#2b6cb0' })
          .setLngLat([selectedTrip.route[0].lng, selectedTrip.route[0].lat])
          .addTo(map)
      })
    }
    return () => map.remove()
  }, [showTripModal, selectedTrip])

  return (
    <Container maxW="container.md" py={10}>
      <Box textAlign="center" mb={8}>
        <Heading as="h1" size="2xl" mb={2} color="teal.400">
          Travel Tracker
        </Heading>
        <Text fontSize="lg" color="gray.500">
          Record, view, and relive your journeys.
        </Text>
      </Box>
      {geoError && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          Geolocation error: {geoError}
        </Alert>
      )}
      <Box p={2} mb={2} bg="gray.100" borderRadius="md">
        <Text fontSize="xs" color="gray.600">Debug: Route array ({route.length} points)</Text>
        <pre style={{ fontSize: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 100, overflowY: 'auto' }}>{JSON.stringify(route, null, 2)}</pre>
      </Box>
      <VStack spacing={6} align="stretch">
        <Box p={6} borderWidth={1} borderRadius="lg" bg="gray.50">
          <HStack justify="space-between">
            <Button colorScheme="teal" onClick={handleStart} isDisabled={isTracking}>
              Start Trip
            </Button>
            <Button colorScheme="red" onClick={handleStop} isDisabled={!isTracking}>
              Stop Trip
            </Button>
          </HStack>
          <Divider my={4} />
          {isTracking && (
            <Box textAlign="center">
              <Text fontSize="md" color="teal.600">Tracking in progress...</Text>
              <Text>Elapsed: {Math.floor(elapsed / 60)}m {elapsed % 60}s</Text>
              <Text>Points recorded: {route.length}</Text>
            </Box>
          )}
          {!isTracking && route.length > 0 && (
            <Box textAlign="center">
              <Text color="gray.600">Trip recorded with {route.length} points.</Text>
            </Box>
          )}
        </Box>
        <Box p={0} borderWidth={1} borderRadius="lg" bg="gray.50" minH="400px" height="400px" overflow="hidden" position="relative">
          {mapLoading && (
            <Center position="absolute" top={0} left={0} right={0} bottom={0} bg="gray.50">
              <Spinner size="xl" color="teal.500" />
            </Center>
          )}
          {mapError && (
            <Center position="absolute" top={0} left={0} right={0} bottom={0} bg="gray.50">
              <Alert status="error">
                <AlertIcon />
                {mapError}
              </Alert>
            </Center>
          )}
          <div ref={mapContainer} style={{ width: '100%', height: '100%', visibility: mapLoading ? 'hidden' : 'visible' }} />
          {!isTracking && route.length === 0 && !mapLoading && !mapError && (
            <Text color="gray.400" textAlign="center" mt={4}>No location points recorded yet. Start a trip to begin tracking.</Text>
          )}
        </Box>
        <Box p={6} borderWidth={1} borderRadius="lg" bg="gray.50">
          <Heading as="h2" size="md" mb={4} color="teal.600">Trip History</Heading>
          {loadingTrips ? (
            <Flex justify="center" align="center" minH="80px"><Spinner /></Flex>
          ) : trips.length === 0 ? (
            <Text color="gray.400">No trips recorded yet.</Text>
          ) : (
            <List spacing={3}>
              {trips.map(trip => (
                <ListItem key={trip.id} p={3} borderWidth={1} borderRadius="md" bg="white" _hover={{ bg: 'gray.50', cursor: 'pointer' }}>
                  <HStack justify="space-between">
                    <Box onClick={() => handleShowTrip(trip)}>
                      <Text fontWeight="bold">{trip.name} {trip.isFavorite && <StarIcon color="yellow.400" />}</Text>
                      <Text fontSize="sm" color="gray.500">{trip.date}</Text>
                    </Box>
                    <IconButton icon={<StarIcon />} aria-label="Favorite" colorScheme={trip.isFavorite ? 'yellow' : 'gray'} variant={trip.isFavorite ? 'solid' : 'outline'} isRound size="sm" isLoading={favoriteLoading} onClick={() => handleFavorite(trip)} />
                  </HStack>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </VStack>
      <Modal isOpen={showTripModal} onClose={() => setShowTripModal(false)} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selectedTrip?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.500" mb={2}>Date: {selectedTrip?.date}</Text>
            <Text mb={2}><b>Notes:</b> {selectedTrip?.notes || <span style={{ color: '#aaa' }}>No notes</span>}</Text>
            <Box mb={2}><b>Points:</b> {selectedTrip?.route?.length}</Box>
            <Box mb={2} height="300px" borderWidth={1} borderRadius="md" overflow="hidden">
              <div ref={tripMapRef} style={{ width: '100%', height: '100%' }} />
            </Box>
            <Box>
              <Heading as="h4" size="sm" mb={1}>Timestamps</Heading>
              <Box maxH="100px" overflowY="auto" bg="gray.50" p={2} borderRadius="md">
                {selectedTrip?.route?.map((p, i) => (
                  <Text key={i} fontSize="xs">{p.timestamp} ({p.lat.toFixed(4)}, {p.lng.toFixed(4)})</Text>
                ))}
              </Box>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setShowTripModal(false)} variant="ghost">Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={showSave} onClose={() => setShowSave(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Save Trip</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={3} isRequired>
              <FormLabel>Trip Name</FormLabel>
              <Input value={tripName} onChange={e => setTripName(e.target.value)} placeholder="e.g. France to Germany" />
            </FormControl>
            <FormControl mb={3}>
              <FormLabel>Notes</FormLabel>
              <Textarea value={tripNotes} onChange={e => setTripNotes(e.target.value)} placeholder="Trip notes (optional)" />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="teal" mr={3} onClick={handleSaveTrip} isLoading={saving} isDisabled={!tripName}>
              Save
            </Button>
            <Button onClick={() => setShowSave(false)} variant="ghost">Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  )
}

export default App
