"use client";

import { useEffect, useState } from "react";

const ANALYTICS_TOUR_KEY = "analytics-tour-completed";

export function useAnalyticsTour() {
  const [hasShownTour, setHasShownTour] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // Check if user has already seen the tour
    const tourCompleted = localStorage.getItem(ANALYTICS_TOUR_KEY);

    if (!tourCompleted) {
      setHasShownTour(false);
    } else {
      setHasShownTour(true);
    }
  }, []);

  const showTourNotification = () => {
    if (hasShownTour) {
      return;
    }

    setShowNotification(true);
  };

  const dismissNotification = () => {
    setShowNotification(false);
    // Mark tour as completed
    localStorage.setItem(ANALYTICS_TOUR_KEY, "true");
    setHasShownTour(true);
  };

  return {
    showTourNotification,
    dismissNotification,
    showNotification,
    hasShownTour,
  };
}
