import { LoadedSetupResult } from '../types/results';

export interface ReportDay {
  readonly month: number;
  readonly day: number;
  readonly label: string;
}

export interface PdfLabels {
  title: string;
  subtitle: string;
  appName: string;
  labelLocation: string;
  labelTimezone: string;
  labelYear: string;
  labelInterval: string;
  labelIrradiance: string;
  labelPointsPerZone: string;
  labelThreshold: string;
  labelSetupsCompared: string;
  labelComputedAt: string;
  sectionAnnual: string;
  sectionMonthly: string;
  sectionDaily: string;
  sectionHeatmaps: string;
  subLegend: string;
  subAnnualTotals: string;
  subMonthlyTotals: string;
  subHourlyProduction: string;
  subHourlyData: string;
  subDailyTotals: string;
  colHour: string;
  colSetup: string;
  monthsShort: string[];
  unitMin: string;
  irradianceGeometric: string;
  irradianceOpenMeteo: string;
  zeroSymbol: string;
}

export interface GenerateReportOptions {
  readonly results: LoadedSetupResult[];
  readonly year: number;
  readonly intervalMinutes: number;
  readonly irradianceSource: string;
  readonly density: number;
  readonly threshold: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly appVersion: string;
  readonly computedAt: number;
  readonly selectedDays: ReportDay[];
  readonly labels: PdfLabels;
  readonly simulationCode: string;
}