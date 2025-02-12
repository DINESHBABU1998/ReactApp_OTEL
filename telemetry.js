import { Resource } from "@opentelemetry/resources";
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider,BatchSpanProcessor, } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { MeterProvider,PeriodicExportingMetricReader,ConsoleMetricExporter } from "@opentelemetry/sdk-metrics";
import { metrics, trace } from "@opentelemetry/api";

const setupTracer = () => {
    const resource = new Resource({
        [ATTR_SERVICE_NAME]: 'react-client',
        [ATTR_SERVICE_VERSION]: '1.0.0',
    });
    const provider = new WebTracerProvider({
        resource: resource,
    });

    provider.addSpanProcessor(new SimpleSpanProcessor(new OTLPTraceExporter()));
    provider.addSpanProcessor(
        new BatchSpanProcessor(new OTLPTraceExporter()));

    provider.register({
      // Changing default contextManager to use ZoneContextManager - supports asynchronous operations - optional
      contextManager: new ZoneContextManager(),
    });
    
    trace.setGlobalTracerProvider(provider);
    
    const metricExporter = new ConsoleMetricExporter(); 
// new OTLPMetricExporter()   
  // Like the SpanProcessor, the metric reader sends metrics to the exporter
const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    // Default is 60000ms (60 seconds). Set to 10 seconds for demonstration purposes.
    exportIntervalMillis: 10000,
});
   
const meterProvider = new MeterProvider({
    resource: resource,
    readers: [metricReader],
});
    
metrics.setGlobalMeterProvider(meterProvider);

    // Registering instrumentations
    registerInstrumentations({
      instrumentations: [
        new DocumentLoadInstrumentation(),
        new UserInteractionInstrumentation(),
        new XMLHttpRequestInstrumentation(),
        new FetchInstrumentation()
      ],
    });
    // const instrumentations = [
    //   new DocumentLoadInstrumentation(), // Captures document load time
    //   new UserInteractionInstrumentation(), // Tracks user interactions (clicks, inputs)
    //   new FetchInstrumentation(), // Captures fetch API calls
    //   new XMLHttpRequestInstrumentation() // Captures XHR API calls
    //   ];
       
    console.log("✅ OpenTelemetry Auto-Instrumentation Initialized!");  
}

export default setupTracer;