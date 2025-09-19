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
  whitelist = [],
  blacklist = [],
  onChange = () => {},
  className,
  placeholder = "Country",
  value,
  onValueChange,
  disabled = false,
}: CountrySelectProps) {
  const [countries, setCountries] = useState<CountryRegion[]>([]);

  useEffect(() => {
    //@ts-expect-error - Dynamic import for country-region-data module
    import("country-region-data/dist/data-umd").then((countryRegionData) => {
      setCountries(
        getCountriesWithPriority(
          countryRegionData.default || countryRegionData,
          priorityOptions
        )
      );
    });
  }, [priorityOptions, whitelist, blacklist]);

  const handleValueChange = (newValue: string) => {
    onChange(newValue);
    onValueChange?.(newValue);
  };

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
