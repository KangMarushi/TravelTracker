import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Textarea,
  Box,
  Divider,
  useToast
} from '@chakra-ui/react';

const TripSummaryModal = ({ isOpen, onClose, stats, onSave }) => {
  const [tripName, setTripName] = useState('');
  const [tripNotes, setTripNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    if (!tripName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a trip name',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: tripName.trim(),
        notes: tripNotes.trim(),
        stats
      });
      toast({
        title: 'Success',
        description: 'Trip saved successfully',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save trip',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const formatSpeed = (mps) => {
    const kmh = mps * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  };

  if (!stats) return null;
  const safeStats = {
    distance: 0,
    duration: 0,
    averageSpeed: 0,
    maxSpeed: 0,
    elevationGain: 0,
    elevationLoss: 0,
    points: 0,
    route: [],
    ...stats
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Trip Summary</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontWeight="bold" mb={2}>Trip Statistics</Text>
              <VStack spacing={2} align="stretch" bg="gray.50" p={4} borderRadius="md">
                <HStack justify="space-between">
                  <Text>Distance:</Text>
                  <Text fontWeight="medium">{formatDistance(stats.distance)}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text>Duration:</Text>
                  <Text fontWeight="medium">{formatDuration(stats.duration)}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text>Average Speed:</Text>
                  <Text fontWeight="medium">{formatSpeed(safeStats.averageSpeed)}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text>Max Speed:</Text>
                  <Text fontWeight="medium">{formatSpeed(safeStats.maxSpeed)}</Text>
                </HStack>
                {stats.elevationGain > 0 && (
                  <HStack justify="space-between">
                    <Text>Elevation Gain:</Text>
                    <Text fontWeight="medium">{Math.round(stats.elevationGain)}m</Text>
                  </HStack>
                )}
                {stats.elevationLoss > 0 && (
                  <HStack justify="space-between">
                    <Text>Elevation Loss:</Text>
                    <Text fontWeight="medium">{Math.round(stats.elevationLoss)}m</Text>
                  </HStack>
                )}
              </VStack>
            </Box>

            <Divider />

            <Box>
              <Text fontWeight="bold" mb={2}>Save Trip</Text>
              <VStack spacing={4}>
                <Input
                  placeholder="Trip Name"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                />
                <Textarea
                  placeholder="Trip Notes (optional)"
                  value={tripNotes}
                  onChange={(e) => setTripNotes(e.target.value)}
                />
                <Button
                  colorScheme="blue"
                  onClick={handleSave}
                  isLoading={saving}
                  width="full"
                >
                  Save Trip
                </Button>
              </VStack>
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default TripSummaryModal; 