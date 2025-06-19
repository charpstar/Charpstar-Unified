"use client";

import { useEffect, useState } from "react";

const ANALYTICS_TOUR_KEY = "analytics-tour-completed";

export function useAnalyticsTour() {
  const [hasShownTour, setHasShownTour] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // Check if user has already seen the tour
    const tourCompleted = localStorage.getItem(ANALYTICS_TOUR_KEY);
    console.log("Analytics tour check:", { tourCompleted, hasShownTour });
    if (!tourCompleted) {
      setHasShownTour(false);
    } else {
      setHasShownTour(true);
    }
  }, []);

  const showTourNotification = () => {
    console.log("Attempting to show tour notification:", { hasShownTour });
    if (hasShownTour) {
      console.log("Tour already shown, skipping");
      return;
    }

    console.log("Showing analytics tour notification");
    setShowNotification(true);
  };

  const dismissNotification = () => {
    console.log("Dismissing notification");
    setShowNotification(false);
    // Mark tour as completed
    localStorage.setItem(ANALYTICS_TOUR_KEY, "true");
    setHasShownTour(true);
    console.log("Tour marked as completed");
  };

  return {
    showTourNotification,
    dismissNotification,
    showNotification,
    hasShownTour,
  };
}
