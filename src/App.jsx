import React, { useState, useEffect } from 'react';
import { ChakraProvider, Container, Heading, VStack } from '@chakra-ui/react';
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

  return (
    <ChakraProvider>
      <Container maxW="container.md" py={10}>
        <VStack spacing={4} align="stretch">
          <Heading size="lg" color="blue.600">Travel Tracker</Heading>

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

          <MapContainer
            isTracking={isTracking}
            currentLocation={currentLocation}
            route={route}
          />
        </VStack>

        <TripSummaryModal
          isOpen={showSummary}
          onClose={() => setShowSummary(false)}
          stats={tripStats}
          onSave={handleSaveTrip}
        />
      </Container>
    </ChakraProvider>
  );
}

export default App;
