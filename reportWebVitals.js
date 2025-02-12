// const reportWebVitals = onPerfEntry => {
//   if (onPerfEntry && onPerfEntry instanceof Function) {
//     import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
//       getCLS(onPerfEntry);
//       getFID(onPerfEntry);
//       getFCP(onPerfEntry);
//       getLCP(onPerfEntry);
//       getTTFB(onPerfEntry);
//     });
//   }
// };

// export default reportWebVitals;

import { onCLS, onFCP, onLCP, onTTFB, onINP } from "web-vitals";
import { Resource } from "@opentelemetry/resources";
import { MeterProvider,PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";

const reportWebVitals = () => {
  console.log("✅ WebVitals function executed");

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: 'react-apigee',
    [ATTR_SERVICE_VERSION]: '1.0.0',
});
// Create OTLP Metric Exporter
const exporter = new OTLPMetricExporter();

// Set up a periodic metric reader
const metricReader = new PeriodicExportingMetricReader({
  exporter,
  exportIntervalMillis: 10000, // Export metrics every 10 seconds
});

// Initialize MeterProvider
const meterProvider = new MeterProvider({
  resource: resource,
  readers: [metricReader],
});

  const meter = meterProvider.getMeter("web-vitals-metrics");
  

  // Define metric histograms
  const vitalsMetrics = {
    cls: meter.createHistogram("web_vitals_cls", { description: "Cumulative Layout Shift", unit: "score" }),
    fid: meter.createHistogram("web_vitals_fid", { description: "First Input Delay", unit: "ms" }),
    fcp: meter.createHistogram("web_vitals_fcp", { description: "First Contentful Paint", unit: "ms" }),
    lcp: meter.createHistogram("web_vitals_lcp", { description: "Largest Contentful Paint", unit: "ms" }),
    ttfb: meter.createHistogram("web_vitals_ttfb", { description: "Time to First Byte", unit: "ms" }),
    inp: meter.createHistogram("web_vitals_inp", { description: "Interaction to Next Paint", unit: "ms" }),
  };

  const recordMetric = ({ name, value }) => {

    // Normalize metric name to match keys (web vitals sends lowercase)
  const metricKey = name.toLowerCase();

  if (vitalsMetrics[metricKey]) {
      vitalsMetrics[metricKey].record(value);
      console.log(`✅ Web Vital Recorded: ${metricKey} = ${value}ms`);
   } else {
      console.warn(`⚠️ Metric ${metricKey} not found!`);
   }
  };

  // Attach event-based Web Vitals collection
  onCLS(recordMetric);
  onFCP(recordMetric);
  onLCP(recordMetric);
  onTTFB(recordMetric);
  onINP(recordMetric);
};

export default reportWebVitals;
