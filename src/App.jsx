import React, { useState } from 'react';
import { ChakraProvider, Container, VStack, Heading, Alert, AlertIcon } from '@chakra-ui/react';
import TripControls from './components/TripControls';
import MapContainer from './components/MapContainer';
import TripSummaryModal from './components/TripSummaryModal';
import ErrorBoundary from './components/ErrorBoundary';
import useTripTracker from './hooks/useTripTracker';
import './App.css';

function App() {
  const [showSummary, setShowSummary] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    isTracking,
    isPaused,
    recordingMode,
    recordingInterval,
    recordingDistance,
    currentLocation,
    currentAddress,
    isLoadingAddress,
    geoError,
    route,
    elapsed,
    tripStats,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    setRecordingMode,
    setRecordingInterval,
    setRecordingDistance
  } = useTripTracker();

  const handleStop = () => {
    stopTracking();
    setShowSummary(true);
  };

  const handleSaveTrip = async (tripData) => {
    setIsSaving(true);
    try {
      // Save trip data to localStorage
      const savedTrips = JSON.parse(localStorage.getItem('trips') || '[]');
      savedTrips.push({
        ...tripData,
        id: Date.now(),
        date: new Date().toISOString()
      });
      localStorage.setItem('trips', JSON.stringify(savedTrips));
      setShowSummary(false);
    } catch (error) {
      console.error('Error saving trip:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMapError = (error) => {
    console.error('Map error:', error);
    setMapError(error.message);
  };

  return (
    <ErrorBoundary>
      <ChakraProvider>
        <div className="app-container">
          <Container maxW="container.xl" py={4} height="100vh" display="flex" flexDirection="column">
            <VStack spacing={4} align="stretch" flex="1" minH="0">
              <Heading size="lg" color="blue.600">Travel Tracker</Heading>

              {mapError && (
                <Alert status="error" variant="subtle" borderRadius="md">
                  <AlertIcon />
                  {mapError}
                </Alert>
              )}

              <TripControls
                isTracking={isTracking}
                isPaused={isPaused}
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
                onPause={pauseTracking}
                onResume={resumeTracking}
                onRecordingModeChange={setRecordingMode}
                onIntervalChange={setRecordingInterval}
                onDistanceChange={setRecordingDistance}
              />

              <div className="map-container" style={{ flex: 1, minHeight: '400px' }}>
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
              isSaving={isSaving}
            />
          </Container>
        </div>
      </ChakraProvider>
    </ErrorBoundary>
  );
}

export default App;
