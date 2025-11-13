//@ts-expect-error - Country region data module doesn't have types
import countryRegionData from "country-region-data/dist/data-umd.js";

export interface Region {
  name: string;
  shortCode: string;
}

export interface CountryRegion {
  countryName: string;
  countryShortCode: string;
  regions: Region[];
}

export function filterCountries(
  countries: CountryRegion[],
  _priorityOptions: string[] = [],
  whitelist: string[] = [],
  blacklist: string[] = []
): CountryRegion[] {
  // _priorityOptions is not used in this function but kept for compatibility
  void _priorityOptions;
  return countries.filter((country) => {
    // Check whitelist first
    if (whitelist.length > 0) {
      return whitelist.includes(country.countryShortCode);
    }

    // Check blacklist
    if (blacklist.includes(country.countryShortCode)) {
      return false;
    }

    return true;
  });
}

export function getCountriesWithPriority(
  countries: CountryRegion[],
  priorityOptions: string[] = []
): CountryRegion[] {
  const filtered = filterCountries(countries);

  if (priorityOptions.length === 0) {
    return filtered;
  }

  const priorityCountries: CountryRegion[] = [];
  const otherCountries: CountryRegion[] = [];

  filtered.forEach((country) => {
    if (priorityOptions.includes(country.countryShortCode)) {
      priorityCountries.push(country);
    } else {
      otherCountries.push(country);
    }
  });

  return [...priorityCountries, ...otherCountries];
}

export function getCountryNameByCode(countryShortCode: string): string {
  const country = countryRegionData.find(
    (c: any) => c.countryShortCode === countryShortCode
  );
  return country ? country.countryName : countryShortCode;
}

export function getCountryCodeByName(countryName: string): string {
  const country = countryRegionData.find(
    (c: any) => c.countryName === countryName
  );
  return country ? country.countryShortCode : countryName;
}
