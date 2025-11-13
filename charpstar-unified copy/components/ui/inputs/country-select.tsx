"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/inputs";
import { getCountriesWithPriority } from "@/lib/helpers";
import { useEffect, useState } from "react";

export interface Region {
  name: string;
  shortCode: string;
}

export interface CountryRegion {
  countryName: string;
  countryShortCode: string;
  regions: Region[];
}

interface CountrySelectProps {
  priorityOptions?: string[];
  whitelist?: string[];
  blacklist?: string[];
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

function CountrySelect({
  priorityOptions = [],

  onChange = () => {},
  className,
  placeholder = "Country",
  value,
  onValueChange,
  disabled = false,
}: CountrySelectProps) {
  const [countries, setCountries] = useState<CountryRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    //@ts-expect-error - Dynamic import for country-region-data module
    import("country-region-data/dist/data-umd.js")
      .then((countryRegionData) => {
        if (mounted) {
          setCountries(
            getCountriesWithPriority(
              countryRegionData.default || countryRegionData,
              priorityOptions
            )
          );
          setIsLoading(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load country data:", error);
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [priorityOptions]);

  const handleValueChange = (newValue: string) => {
    onChange(newValue);
    onValueChange?.(newValue);
  };

  if (isLoading) {
    return (
      <Select value={value} onValueChange={handleValueChange} disabled={true}>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Loading countries..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {countries.map(({ countryName, countryShortCode }) => (
          <SelectItem key={countryShortCode} value={countryShortCode}>
            {countryName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default CountrySelect;
