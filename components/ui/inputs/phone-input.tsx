import * as React from "react";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import * as RPNInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";

import { Button } from "@/components/ui/display/button";

import { Input } from "@/components/ui/inputs/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/interactive";
import { ScrollArea } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

type PhoneInputProps = Omit<
  React.ComponentProps<"input">,
  "onChange" | "value" | "ref"
> &
  Omit<RPNInput.Props<typeof RPNInput.default>, "onChange"> & {
    onChange?: (value: RPNInput.Value) => void;
  };

const PhoneInput: React.ForwardRefExoticComponent<PhoneInputProps> =
  React.forwardRef<React.ElementRef<typeof RPNInput.default>, PhoneInputProps>(
    ({ className, onChange, value, ...props }, ref) => {
      return (
        <RPNInput.default
          ref={ref}
          className={cn("flex", className)}
          flagComponent={FlagComponent}
          countrySelectComponent={CountrySelect}
          inputComponent={InputComponent}
          smartCaret={false}
          value={value || undefined}
          /**
           * Handles the onChange event.
           *
           * react-phone-number-input might trigger the onChange event as undefined
           * when a valid phone number is not entered. To prevent this,
           * the value is coerced to an empty string.
           *
           * @param {E164Number | undefined} value - The entered value
           */
          onChange={(value) => onChange?.(value || ("" as RPNInput.Value))}
          {...props}
        />
      );
    }
  );
PhoneInput.displayName = "PhoneInput";

const InputComponent = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => (
  <Input
    className={cn("rounded-e-lg rounded-s-none", className)}
    {...props}
    ref={ref}
  />
));
InputComponent.displayName = "InputComponent";

type CountryEntry = { label: string; value: RPNInput.Country | undefined };

type CountrySelectProps = {
  disabled?: boolean;
  value: RPNInput.Country;
  options: CountryEntry[];
  onChange: (country: RPNInput.Country) => void;
  name?: string;
  tabIndex?: number;
};

const CountrySelect = ({
  disabled,
  value: selectedCountry,
  options: countryList,
  onChange,
}: CountrySelectProps) => {
  const [searchValue, setSearchValue] = React.useState("");

  // Filter countries based on search
  const filteredCountries = countryList.filter(({ label }) =>
    label.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="flex gap-1 rounded-e-none rounded-s-lg border-r-0 px-3 focus:z-10"
        >
          <FlagComponent
            country={selectedCountry}
            countryName={selectedCountry}
          />
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <div className="p-2">
          <Input
            placeholder="Search country..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="mb-2"
          />
          <ScrollArea className="h-72">
            <div className="space-y-1">
              {filteredCountries.map(({ value, label }) =>
                value ? (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      onChange(value);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer ${
                      value === selectedCountry ? "bg-accent" : ""
                    }`}
                  >
                    <FlagComponent country={value} countryName={label} />
                    <span className="flex-1 text-left">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      +{RPNInput.getCountryCallingCode(value)}
                    </span>
                    {value === selectedCountry && (
                      <CheckIcon className="h-4 w-4" />
                    )}
                  </button>
                ) : null
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const FlagComponent = ({ country, countryName }: RPNInput.FlagProps) => {
  const Flag = flags[country];

  return (
    <span className="flex h-4 w-6 overflow-hidden rounded-sm bg-foreground/20 [&_svg:not([class*='size-'])]:size-full">
      {Flag && <Flag title={countryName} />}
    </span>
  );
};

export { PhoneInput };
