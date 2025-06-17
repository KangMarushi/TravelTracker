import React, { useState, useEffect } from 'react';
import { ChakraProvider, Container, Heading, VStack, Alert, AlertIcon } from '@chakra-ui/react';
import { useTripTracker } from './hooks/useTripTracker';
import { loadSettings, getAddressFromCoordinates } from './utils/geolocation';
import MapContainer from './components/MapContainer';
import TripControls from './components/TripControls';
import TripSummaryModal from './components/TripSummaryModal';

function App() {
  // Load saved settings
  const savedSettings = loadSettings();
  
  // State management
  const [recordingMode, setRecordingMode] = useState(savedSettings.recordingMode);
  const [recordingInterval, setRecordingInterval] = useState(savedSettings.recordingInterval);
  const [recordingDistance, setRecordingDistance] = useState(savedSettings.recordingDistance);
  const [currentAddress, setCurrentAddress] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [mapError, setMapError] = useState(null);

  // Use the trip tracker hook
  const {
    isTracking,
    route,
    startTime,
    elapsed,
    currentLocation,
    tripStats,
    startTracking,
    stopTracking
  } = useTripTracker({
    recordingMode,
    recordingInterval,
    recordingDistance
  });

  // Update address when location changes
  useEffect(() => {
    if (currentLocation) {
      setIsLoadingAddress(true);
      getAddressFromCoordinates(currentLocation[0], currentLocation[1])
        .then(address => {
          setCurrentAddress(address);
          setIsLoadingAddress(false);
        })
        .catch(error => {
          console.error('Error getting address:', error);
          setIsLoadingAddress(false);
        });
    }
  }, [currentLocation]);

  // Handle trip completion
  const handleStop = () => {
    stopTracking();
    setShowSummary(true);
  };

  // Handle trip save
  const handleSaveTrip = async (tripData) => {
    // Implement your save logic here
    console.log('Saving trip:', tripData);
  };

  // Handle map errors
  const handleMapError = (error) => {
    console.error('Map error:', error);
    setMapError(error.message || 'Error loading map. Please check your internet connection and try again.');
  };

  return (
    <ChakraProvider>
      <div className="app-container">
        <Container maxW="container.xl" py={4}>
          <VStack spacing={4} align="stretch">
            <Heading size="lg" color="blue.600">Travel Tracker</Heading>

            {mapError && (
              <Alert status="error" variant="subtle" borderRadius="md">
                <AlertIcon />
                {mapError}
              </Alert>
            )}

            <TripControls
              isTracking={isTracking}
              recordingMode={recordingMode}
              recordingInterval={recordingInterval}
              recordingDistance={recordingDistance}
              currentAddress={currentAddress}
              isLoadingAddress={isLoadingAddress}
              geoError={geoError}
              route={route}
              elapsed={elapsed}
              onStart={startTracking}
              onStop={handleStop}
              onRecordingModeChange={setRecordingMode}
              onIntervalChange={setRecordingInterval}
              onDistanceChange={setRecordingDistance}
            />

            <div className="map-container">
              <MapContainer
                isTracking={isTracking}
                currentLocation={currentLocation}
                route={route}
                onMapError={handleMapError}
              />
            </div>
          </VStack>

          <TripSummaryModal
            isOpen={showSummary}
            onClose={() => setShowSummary(false)}
            stats={tripStats}
            onSave={handleSaveTrip}
          />
        </Container>
      </div>
    </ChakraProvider>
  );
}

export default App;
