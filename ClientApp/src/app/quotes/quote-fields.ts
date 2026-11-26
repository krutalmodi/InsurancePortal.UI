import { FormControl, FormGroup, Validators } from '@angular/forms';
import { QuoteLookupType } from './quote-lookup.service';

export interface Field {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  min?: number;
  optional?: boolean;
  lookup?: QuoteLookupType;
  valueBy?: 'id' | 'code';
  dependsOn?: string;
  options?: { value: number; label: string }[];
  showIf?: { key: string; equals: FieldValue };
  uiOnly?: boolean;
  toPayload?: (value: FieldValue) => FieldValue;
}
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ value: from + i, label: String(from + i) }));
const currentYear = new Date().getFullYear();
const vehicleYears = range(1990, currentYear).reverse();
const zeroToTen = range(0, 10);
const yearsBuilt = range(1900, currentYear).reverse();
const ages = range(18, 100);
const annualMileage = [0, 1000, 3000, 5000, 8000, 10000, 15000, 20000, 35000].map((value) => ({
  value,
  label: value.toLocaleString('en-US'),
}));
export type FieldValue = string | number | boolean | null;
export const addressFields: Field[] = [
  { key: 'streetAddress1', label: 'Street address', type: 'text' },
  { key: 'streetAddress2', label: 'Address line 2', type: 'text', optional: true },
  { key: 'unitNumber', label: 'Unit / suite', type: 'text', optional: true },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'postalCode', label: 'Postal / ZIP code', type: 'text' },
  { key: 'countryId', label: 'Country', type: 'select' },
  { key: 'provinceId', label: 'Province / state', type: 'select' },
  { key: 'locationTypeId', label: 'Location type', type: 'select' },
];
export const productFields: Record<string, Field[]> = {
  Auto: [
    { key: 'vin', label: 'VIN', type: 'text' },
    { key: 'vehicleMakeId', label: 'Vehicle make', type: 'select', lookup: 'vehicle-makes' },
    {
      key: 'vehicleModelId',
      label: 'Vehicle model',
      type: 'select',
      lookup: 'vehicle-models',
      dependsOn: 'vehicleMakeId',
    },
    { key: 'vehicleColorId', label: 'Vehicle color', type: 'select', lookup: 'vehicle-colors' },
    {
      key: 'vehicleTypeId',
      label: 'Vehicle type',
      type: 'select',
      lookup: 'vehicle-types',
      optional: true,
    },
    { key: 'year', label: 'Vehicle year', type: 'select', options: vehicleYears },
    { key: 'mileage', label: 'Mileage', type: 'number', min: 0 },
    {
      key: 'drivingRecord',
      label: 'Driving record',
      type: 'select',
      lookup: 'driving-record-types',
      valueBy: 'code',
    },
    { key: 'numberOfDrivers', label: 'Number of drivers', type: 'select', options: zeroToTen },
    {
      key: 'estimatedAnnualMileage',
      label: 'Estimated annual mileage',
      type: 'select',
      options: annualMileage,
    },
    {
      key: 'atFaultAccidents',
      label: 'At-fault accidents',
      type: 'select',
      options: zeroToTen,
      optional: true,
    },
    {
      key: 'speedingTickets',
      label: 'Speeding tickets',
      type: 'select',
      options: zeroToTen,
      optional: true,
    },
  ],
  Home: [
    { key: 'squareFootage', label: 'Square footage', type: 'number', min: 1 },
    { key: 'yearBuilt', label: 'Year built', type: 'select', options: yearsBuilt },
    { key: 'homeType', label: 'Home type', type: 'select', lookup: 'home-types', valueBy: 'code' },
    { key: 'homeValue', label: 'Home value', type: 'number', min: 1 },
    { key: 'numberOfOccupants', label: 'Number of occupants', type: 'select', options: zeroToTen },
    { key: 'hasSecuritySystem', label: 'Security system', type: 'boolean' },
    { key: 'hasFireAlarm', label: 'Fire alarm', type: 'boolean' },
  ],
  Health: [
    { key: 'age', label: 'Age', type: 'select', options: ages },
    {
      key: 'healthStatus',
      label: 'Health status',
      type: 'select',
      lookup: 'health-statuses',
      valueBy: 'code',
    },
    {
      key: 'coverageType',
      label: 'Coverage type',
      type: 'select',
      lookup: 'coverage-types',
      valueBy: 'code',
    },
    { key: 'dependents', label: 'Number of dependents', type: 'select', options: zeroToTen },
    { key: 'hasPreexistingConditions', label: 'Pre-existing conditions', type: 'boolean' },
    {
      key: 'preexistingCondition',
      label: 'Pre-existing condition',
      type: 'select',
      lookup: 'health-statuses',
      valueBy: 'code',
      showIf: { key: 'hasPreexistingConditions', equals: true },
      uiOnly: true,
    },
    {
      key: 'smoker',
      label: 'Smoking status',
      type: 'select',
      lookup: 'smoking-statuses',
      valueBy: 'code',
      toPayload: (value) => value === 'CurrentSmoker',
    },
  ],
};
export function makeForm(fields: Field[]): FormGroup {
  const controls: Record<string, FormControl<FieldValue>> = {};
  for (const field of fields) {
    const control = new FormControl<FieldValue>(null, [
      ...(field.optional ? [] : [Validators.required]),
      ...(field.min === undefined ? [] : [Validators.min(field.min)]),
    ]);
    if (field.showIf) control.disable();
    controls[field.key] = control;
  }
  return new FormGroup(controls);
}
