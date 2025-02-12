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
import { MeterProvider,PeriodicExportingMetricReader,ConsoleMetricExporter } from "@opentelemetry/sdk-metrics";
// import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http/build/src/platform/browser";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const setupOtel = () => {
const resource = new Resource({
      [ATTR_SERVICE_NAME]: 'react-client',
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

// registerInstrumentations({
//     instrumentations: [
//       new FetchInstrumentation({
//         propagateTraceHeaderCorsUrls: [
//           new RegExp(/http:\/\/localhost:8080\/.*/),
//         ],
//       }),
//       new DocumentLoadInstrumentation(),
//       new UserInteractionInstrumentation(),
//       new XMLHttpRequestInstrumentation(),
//     ],
// });

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

export default setupOtel;