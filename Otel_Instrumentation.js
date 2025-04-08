import { Resource } from "@opentelemetry/resources";
import {
  SimpleSpanProcessor,
  WebTracerProvider,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-web";
import { metrics, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { getWebAutoInstrumentations } from "@opentelemetry/auto-instrumentations-web";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from "@opentelemetry/sdk-metrics";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { useEffect } from "react";
import { onCLS, onFCP, onLCP, onINP } from "web-vitals";
import { v4 as uuidv4 } from "uuid";

const useOtel = () => {
  useEffect(() => {
    const initializeOtel = async () => {
      const getGeoLocationInfo = async () => {
        try {
          const res = await fetch("https://ipapi.co/json/");
          if (!res.ok) throw new Error("Failed to fetch geolocation");
          const data = await res.json();
          return {
            "user.country": data.country,
            "user.city": data.city,
            "user.region": data.region,
          };
        } catch (err) {
          console.warn("Geolocation fetch failed:", err.message);
          return {};
        }
      };

      const geoInfo = await getGeoLocationInfo();

      const sessionId = sessionStorage.getItem("session_id") || uuidv4();
      sessionStorage.setItem("session_id", sessionId);

      const resource = new Resource({
        [ATTR_SERVICE_NAME]: "react-apigee",
        [ATTR_SERVICE_VERSION]: "1.0.2",
        "session.id": sessionId,
        "browser.screen_width": window.screen.width,
        "browser.screen_height": window.screen.height,
        "page.url": window.location.href,
        "page.title": document.title,
        "page.host": window.location.host,
        "page.path": window.location.pathname,
        "page.origin": window.location.origin,
        "browser.language": window.navigator.language,
        "browser.info":
          navigator.userAgentData?.ua || navigator.userAgent,
        "device.type": /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
          ? window.innerWidth > 768
            ? "tablet"
            : "mobile"
          : "desktop",
        ...geoInfo,
      });

      const tracerProvider = new WebTracerProvider({ resource });

      const traceExporter = new OTLPTraceExporter();
      tracerProvider.addSpanProcessor(new SimpleSpanProcessor(traceExporter));
      tracerProvider.addSpanProcessor(new BatchSpanProcessor(traceExporter));

      tracerProvider.register({
        contextManager: new ZoneContextManager(),
      });

      const tracer = trace.getTracer("react-apigee-tracer");

      trace.setGlobalTracerProvider(tracerProvider);

      window.onerror = function (message, source, lineno, colno, error) {
        const tracer = trace.getTracer("error-tracer");
        const span = tracer.startSpan("Unhandled Error");
        span.setAttribute("error.message", message);
        span.setAttribute("error.source", source);
        span.setAttribute("error.line", lineno);
        span.setAttribute("error.column", colno);
        span.setAttribute(
          "error.stack",
          error?.stack || "No stack available"
        );
        span.setStatus({ code: 2 });
        span.end();
      };

      window.onunhandledrejection = function (event) {
        const tracer = trace.getTracer("error-tracer");
        const span = tracer.startSpan("Unhandled Promise Rejection");
        span.setAttribute("error.reason", event.reason);
        span.setStatus({ code: 2 });
        span.end();
      };

      const exporter = new OTLPMetricExporter();
      const consoleExporter = new ConsoleMetricExporter();
      const metricReader = new PeriodicExportingMetricReader({
        exporter,
        consoleExporter,
        exportIntervalMillis: 10000,
      });

      const meterProvider = new MeterProvider({
        resource,
        readers: [metricReader],
      });

      metrics.setGlobalMeterProvider(meterProvider);

      const meter = meterProvider.getMeter("browser-metrics");

      const ajaxRequestCounter = meter.createCounter("ajax_requests_total", {
        description: "Total number of AJAX requests",
      });

      const ajaxErrorCounter = meter.createCounter("ajax_requests_errors", {
        description: "Total number of AJAX request errors",
      });

      const ajaxDurationHistogram = meter.createHistogram(
        "ajax_requests_duration",
        {
          description: "Duration of AJAX requests",
          unit: "ms",
        }
      );

      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        const startTime = performance.now();
        try {
          const response = await originalFetch(url, options);

          ajaxRequestCounter.add(1, {
            url,
            method: options?.method || "GET",
            "session.id": sessionId,
            ...geoInfo,
          });
          ajaxDurationHistogram.record(performance.now() - startTime, {
            url,
            "session.id": sessionId,
            ...geoInfo,
          });

          if (!response.ok) {
            ajaxErrorCounter.add(1, {
              url,
              method: options?.method || "GET",
              "session.id": sessionId,
              ...geoInfo,
            });
          }

          return response;
        } catch (error) {
          ajaxErrorCounter.add(1, {
            url,
            method: options?.method || "GET",
            "session.id": sessionId,
            ...geoInfo,
          });
          throw error;
        }
      };

      const vitalsMetrics = {
        cls: meter.createHistogram("web_vitals_cls", {
          description: "Cumulative Layout Shift",
          unit: "score",
        }),
        fid: meter.createHistogram("web_vitals_fid", {
          description: "First Input Delay",
          unit: "ms",
        }),
        fcp: meter.createHistogram("web_vitals_fcp", {
          description: "First Contentful Paint",
          unit: "ms",
        }),
        lcp: meter.createHistogram("web_vitals_lcp", {
          description: "Largest Contentful Paint",
          unit: "ms",
        }),
        inp: meter.createHistogram("web_vitals_inp", {
          description: "Interaction to Next Paint",
          unit: "ms",
        }),
      };

      const recordWebVital = ({ name, value }) => {
        const span = tracer.startSpan(`WebVital: ${name}`);
        span.setAttribute("web_vital.name", name);
        span.setAttribute("web_vital.value", value);
        span.setAttribute("web_vital.unit", name === "CLS" ? "score" : "ms");
        span.setStatus({ code: 1 }); // Mark as OK
        span.end();
        const metricKey = name.toLowerCase();
        if (vitalsMetrics[metricKey]) {
          vitalsMetrics[metricKey].record(value, {
            path: window.location.pathname,
            "session.id": sessionId,
            ...geoInfo,
          });
          console.log(
            `Web Vital Recorded: ${metricKey} = ${value}ms (Path: ${window.location.pathname})`
          );
        } else {
          console.warn(`Metric ${metricKey} not found!`);
        }
      };

      onCLS(recordWebVital);
      onFCP(recordWebVital);
      onLCP(recordWebVital);
      onINP(recordWebVital);

      let pageViews = parseInt(localStorage.getItem("page_views") || "0", 10);
      pageViews += 1;
      localStorage.setItem("page_views", pageViews);

      const pageViewCounter = meter.createCounter("page_views_total", {
        description: "Total number of page views",
      });

      pageViewCounter.add(pageViews, {
        path: window.location.pathname,
        "session.id": sessionId,
        ...geoInfo,
      });

      const pageLoadDuration = meter.createHistogram("page_load_duration", {
        description: "Measures the time it takes to load the page",
        unit: "ms",
      });

      if (performance.getEntriesByType) {
        const [pageLoadTiming] = performance.getEntriesByType("navigation");
        if (pageLoadTiming) {
          const loadTime =
            pageLoadTiming.loadEventEnd - pageLoadTiming.startTime;
          pageLoadDuration.record(loadTime, {
            path: window.location.pathname,
            "session.id": sessionId,
            ...geoInfo,
          });
          console.log(`Page load time recorded: ${loadTime.toFixed(2)} ms`);
        }
      }

      const errorCounter = meter.createCounter("frontend_errors", {
        description: "Counts frontend errors",
      });

      window.onerror = function (error, source, lineno, colno, message) {
        let output = document.getElementById("result");
        if (output) {
          output.innerHTML += `Message : ${error}<br>`;
          output.innerHTML += `Url : ${source}<br>`;
          output.innerHTML += `Line number : ${lineno}<br>`;
          output.innerHTML += `Column number : ${colno}<br>`;
          output.innerHTML += `Error Object : ${error}`;
        }

        errorCounter.add(1, {
          type: "js_error",
          error,
          source,
          lineno,
          colno,
          message,
          "session.id": sessionId,
          ...geoInfo,
        });
      };

      return () => {
        meterProvider.shutdown();
      };
    };

    initializeOtel();
  }, []);

  registerInstrumentations({
    instrumentations: [
      getWebAutoInstrumentations({
        "@opentelemetry/instrumentation-document-load": {
          enabled: true,
          applyCustomAttributesOnSpan: {
            resourceFetch: (span, resource) => {
              if (resource.renderBlockingStatus) {
                span.setAttribute(
                  "resource.is_blocking",
                  resource.renderBlockingStatus === "BLOCKING"
                );
              }
            },
          },
        },
        "@opentelemetry/instrumentation-user-interaction": {
          enabled: true,
          eventNames: [
            "click",
            "load",
            "loadeddata",
            "loadedmetadata",
            "loadstart",
            "error",
          ],
          shouldPreventSpanCreation: (event, element, span) => {
            span.setAttributes({
              "element.id": element.id,
              "element.className": element.className,
              "element.type": element.type,
              "element.innerHTML": element.innerHTML,
              "event.type": event.type,
            });
            if (element.nodeName === "INPUT") {
              span.setAttribute("element.input.value", element.value);
            }
            if (element.nodeName === "A") {
              span.setAttribute("element.link.href", element.href);
            }
          },
        },
        "@opentelemetry/instrumentation-fetch": {
          propagateTraceHeaderCorsUrls: /.*/,
          clearTimingResources: false,
          applyCustomAttributesOnSpan: (span, request, response) => {
            const startTime = performance.now();
            if (response) {
              const duration = performance.now() - startTime;
              span.setAttribute("http.response_time", duration);
              span.setAttribute("http.status_code", response.status);
              span.setAttribute("http.method", request.method);
            }
          },
        },
        "@opentelemetry/instrumentation-xml-http-request": {
          enabled: true,
          ignoreUrls: ["/localhost:8081/sockjs-node"],
          clearTimingResources: true,
          propagateTraceHeaderCorsUrls: [/.+/g],
          applyCustomAttributesOnSpan: (span, request, response) => {
            const startTime = performance.now();
            if (response) {
              const duration = performance.now() - startTime;
              span.setAttribute("http.response_time", duration);
              span.setAttribute("http.status_code", response.status);
              span.setAttribute("http.method", request.method);
            }
          },
        },
      }),
    ],
  });
};

export default useOtel;
