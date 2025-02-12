import { Resource } from "@opentelemetry/resources";
import { SimpleSpanProcessor,WebTracerProvider,BatchSpanProcessor, } from "@opentelemetry/sdk-trace-web";
import { metrics, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
// import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
// import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
// import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
// import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { MeterProvider,PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { useEffect } from 'react';

const useOtel = () => {
const resource = new Resource({
      [ATTR_SERVICE_NAME]: 'react-test',
      [ATTR_SERVICE_VERSION]: '1.0.0',
});

const tracerProvider = new WebTracerProvider({
    resource: resource,
});

const traceExporter = new OTLPTraceExporter();
const spanProcessor = new SimpleSpanProcessor(traceExporter);

tracerProvider.addSpanProcessor(spanProcessor);
tracerProvider.addSpanProcessor(
    new BatchSpanProcessor(traceExporter),
);

tracerProvider.register({
    contextManager: new ZoneContextManager(),
});

trace.setGlobalTracerProvider(tracerProvider);

useEffect(() => {

    const resource = new Resource({
          [ATTR_SERVICE_NAME]: 'react-cawa',
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
    
    metrics.setGlobalMeterProvider(meterProvider);
    
      // Create a meter
      const meter = meterProvider.getMeter('browser-metrics');
      
    //   const pageLoadCounter = meter.createCounter('page_loads', {description: 'Counts the number of page loads',});
    //   pageLoadCounter.add(1);
    // //   const pageViews = localStorage.getItem("page_views") || 0;
    // //   localStorage.setItem("page_views", Number(pageViews) + 1);

    // const pageViewCounter = meter.createCounter('page_views_total', {
    //     description: 'Total number of page views',
    //         });
         
    //         // **Increment Counter**
        
    //         pageViewCounter.add(1, { path: window.location.pathname });
         
    //         console.log(`Page View Recorded`);

            console.log("Tracking Page Views...");

            // Retrieve current page views count from localStorage
            let pageViews = parseInt(localStorage.getItem("page_views") || "0", 10);
        
            // Increment and update localStorage
            pageViews += 1;
            localStorage.setItem("page_views", pageViews);
            
            console.log(`Updated Total Page Views: ${pageViews}`);
        
            // **Create Counter Metric**
            const pageViewCounter = meter.createCounter('page_views_total', {
              description: 'Total number of page views',
            });
        
            // **Record the total page views**
            pageViewCounter.add(pageViews, { path: window.location.pathname });
        

    //   console.log(`Total no of page loads: ${pageViews}`);


      // Create a histogram to measure page load duration
      const pageLoadDuration = meter.createHistogram('page_load_duration', {
        description: 'Measures the time it takes to load the page',
        unit: 'ms',
      });
  
      // Measure page load time using Performance API
      if (performance.getEntriesByType) {
        const [pageLoadTiming] = performance.getEntriesByType('navigation');
        if (pageLoadTiming) {
          const loadTime = pageLoadTiming.loadEventEnd - pageLoadTiming.startTime;
          pageLoadDuration.record(loadTime);
          console.log(`Page load time recorded: ${loadTime.toFixed(2)} ms`);
        }
      }
      
      return () => {
        // Clean up MeterProvider when component unmounts
        meterProvider.shutdown();
      };
    }, []);


registerInstrumentations({
    instrumentations: [
        getWebAutoInstrumentations({
            '@opentelemetry/instrumentation-document-load': {},
            '@opentelemetry/instrumentation-user-interaction': {},
            '@opentelemetry/instrumentation-fetch': {},
            '@opentelemetry/instrumentation-xml-http-request': {},
        }),
    ],
});

};

export default useOtel;